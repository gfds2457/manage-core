import express from "express";
import cors from "cors";
import * as fs from "fs";
import {
  apiKey,
  baseURL,
  modelName,
  imageBaseURL,
  imageModelName,
  imageGeneratePath,
  imageSize,
  imageCount,
  imageWatermark,
  imageThinkingMode,
  port,
  contextDir,
  validateConfig,
  getConfigSummary,
} from "./env.js";
import OpenAI from "openai";
import {
  summaryMessage,
  getUserFeature
} from "./utils/index.js";
import { toolList, toolHandleMap, frontList } from "./utils/toolList.js"
import { prepareRagContext, initKnowledgeBase } from "./rag/index.js"
import { kbRouter } from "./routes/kb.js"
import { healthRouter } from "./routes/health.js"
import { query, initTables } from "./mysql.js"
import { linkMcpAndTools } from "./MCP/mcpClient.js"
import { mcpList } from "./MCP/config.js"
import multer from 'multer'

// 启动即校验模型配置：缺失参数直接抛出明确提示，避免带病运行
try {
  validateConfig();
} catch (err) {
  console.error(`\n[启动失败] ${err.message}\n`);
  process.exit(1);
}

// express() 不接收配置对象：传参会被忽略，写成 express({}) 只是让人误以为
// 这里配置过什么（如 trust proxy / 视图引擎），排查时白找一圈
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 健康检测接口：前端页面加载时预检测后端是否在线，提前提示用户（需求 4）
// 只要进程存活恒返回 200，依赖异常通过 body.status=degraded 表达
app.use("/health", healthRouter);

// 知识库增量更新接口：业务侧写库成功后回调，异步刷新对应单条知识的向量
// 路由内部自带鉴权，除 /kb/* 外的接口不受影响
app.use("/kb", kbRouter);

//配置multer库
const storage = multer.memoryStorage()
/** 单张图片大小上限，超出时 multer 抛 LIMIT_FILE_SIZE，由文件末尾的兜底中间件转成 JSON 提示 */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const upload = multer({
  storage,
  limits: {
    // memoryStorage 下文件内容全在内存里，不设上限时一个超大文件就能把进程内存吃满
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
})
// mcp服务
/** 单个 MCP 服务端的连接超时：握手卡住时不能让整个 HTTP 服务起不来 */
const MCP_CONNECT_TIMEOUT_MS = 8000
let mcpObj = { ClientMap: {}, toolsMap: {}, toolList: [] }
try {
  // 必须加超时：linkMcpAndTools 内部对 stdio / streamableHttp 都没有自身超时，
  // 某个 MCP 服务端握手卡住时这个 await 会一直挂着，后面的 app.listen() 永远不执行
  // —— HTTP 服务（含 /health）根本起不来，而这属于「挂住」不是拒绝，try/catch 兜不住
  mcpObj = await Promise.race([
    linkMcpAndTools(mcpList),
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`MCP 连接超时（${MCP_CONNECT_TIMEOUT_MS}ms）`)),
        MCP_CONNECT_TIMEOUT_MS,
      )
      if (typeof timer.unref === "function") timer.unref()
    }),
  ])
  // 只打数量与工具名：整份序列化会把各 MCP 服务端的地址、端点与工具 schema 全写进日志
  console.log(
    `MCP连接成功: 服务端 ${Object.keys(mcpObj.ClientMap || {}).length} 个, ` +
    `工具 ${(mcpObj.toolList || []).length} 个 [${(mcpObj.toolList || []).map(t => t?.function?.name).filter(Boolean).join(", ")}]`
  )
} catch (err) {
  // 连接失败不阻断启动：问答主链路不依赖 MCP，缺工具比服务起不来影响小得多
  console.error("MCP连接失败，相关工具将不可用:", err.message)
}
/** context.md 内容缓存，按 mtime 失效 */
let contextCache = { mtimeMs: 0, text: "" };

/**
 * 读取提示词模板。
 *
 * 只读 context.template.md（不可变模板），绝不读 context.md ——
 * 后者是 getUserFeature() 按用户就地重写的产物：
 *   1. 写完之后模板里的 ${userFeature} 占位符就没了，再读它等于画像永远注入不进去；
 *   2. 文件里留着的是「最后一个写入的用户」的画像，读了就会把它注入到
 *      其他所有用户的 system 提示词里，属于跨用户数据泄露。
 * 这个替换由每次请求自己渲染，不落盘。
 *
 * 按 mtime 缓存：readFileSync 是同步 IO，会阻塞事件循环，
 * 而问答串流期间每个请求都要读一次模板，命中缓存可避免这块固定开销。
 * 读取失败不抛出：模板缺失属于可疑配置，但不该把整轮问答直接打断。
 * @returns {string}
 */
function readContextTemplate() {
  const filePath = `${contextDir}/context.template.md`;
  try {
    const { mtimeMs } = fs.statSync(filePath);
    if (mtimeMs !== contextCache.mtimeMs) {
      contextCache = { mtimeMs, text: fs.readFileSync(filePath, "utf-8") };
    }
    return contextCache.text;
  } catch (err) {
    console.error(
      `读取上下文模板失败(${filePath}):`, err.message,
      "—— 本次问答将不注入自定义上下文；该文件是可提交的不可变模板，不要改成按用户渲染的 context.md",
    );
    return "";
  }
}

function getSystemMessage(userFeature = "") {
  const context = readContextTemplate();
  // 用函数式替换：userFeature 来自用户数据，若其中出现 $& / $1 这类替换模式，
  // 字符串形式的 replace 会把它当成特殊指令，导致模板内容被改写甚至丢失
  const resolvedContext = context.replace(/\$\{userFeature\}/g, () => userFeature);
  return {
    role: "system",
    content: `你是一个后台数据助手\n\n上下文：\n${resolvedContext}`,
  };
}
const openai = new OpenAI({
  apiKey,
  baseURL
});

/**
 * 解析模型返回的工具入参 JSON。
 * 模型的 arguments 是流式拼接出来的字符串，不保证是合法 JSON
 * （长参数被截断、直接回一段自然语言都会出现），
 * 裸 JSON.parse 会抛 SyntaxError 把整轮流式响应打断。
 * @param {{ function?: { name?: string, arguments?: string } }} tool
 * @returns {object}
 */
function parseToolArguments(tool) {
  const raw = tool?.function?.arguments;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    // 模型可能返回数组或字面量，统一收敛成对象，避免下游按 key 取值时拿到 undefined
    return parsed && typeof parsed === "object" ? parsed : { value: parsed };
  } catch (err) {
    // 只记长度不记原文：raw 由模型依据用户消息生成，同样属于用户数据；
    // 解析失败时它往往是超大 JSON，整份打进日志还会淹没真正有用的报错
    console.error(
      `[tool] 解析工具 ${tool?.function?.name} 参数失败:`,
      err.message,
      `原始值长度: ${typeof raw === "string" ? raw.length : 0}`,
    );
    return {};
  }
}

/**
 * 安全解析数据库中存的历史 arguments 字段。
 * 该字段是历史写入的字符串，不保证是合法 JSON；
 * 解析失败按 null 处理，而不是让整个历史接口 500。
 * @param {unknown} raw
 * @returns {object|null}
 */
function parseStoredArguments(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("解析历史 arguments 失败:", err.message);
    return null;
  }
}

/** 单条消息最多携带的图片数，防止一次请求把内存与 LONGTEXT 撑爆 */
const MAX_IMAGES_PER_MESSAGE = 5;

/** 历史消息保留策略：条数超过 MAX 时裁剪到只留最新 KEEP 条 */
const MAX_HISTORY_MESSAGES = 20;
const KEEP_HISTORY_MESSAGES = 10;

/**
 * 等待用户画像的最长时间。
 * 超过就走「本次不注入画像」：首字响应的体感比画像更重要，
 * 而画像只影响回答风格，缺了不会让回答不可用。
 */
const PROFILE_WAIT_MS = 1500;

/**
 * 收敛请求体里的图片数组。
 *
 * files 直接来自 req.body，可能是字符串或对象而不是数组
 * （前端版本不一致、调用方手写请求都会出现），不校验就 forEach 会抛 TypeError，
 * 被 /chat 外层吞成通用的「AI 服务不可用」，排查时完全看不出是入参问题。
 * 数量与元素类型也一并收敛：图片以 base64 传输，
 * 超大数组会在 express.json 的 50mb 限额内把整份内容读进内存并写进 LONGTEXT。
 *
 * @param {unknown} raw
 * @returns {string[]}
 */
function normalizeFiles(raw) {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    console.warn(`[chat] files 字段类型异常(${typeof raw})，已按空数组处理`);
    return [];
  }
  const files = raw.filter(item => typeof item === "string" && item.length > 0);
  if (files.length !== raw.length) {
    console.warn(`[chat] files 中有 ${raw.length - files.length} 项非字符串，已丢弃`);
  }
  if (files.length > MAX_IMAGES_PER_MESSAGE) {
    console.warn(`[chat] 图片数量 ${files.length} 超出上限，仅保留前 ${MAX_IMAGES_PER_MESSAGE} 张`);
  }
  return files.slice(0, MAX_IMAGES_PER_MESSAGE);
}

/**
 * 把落库的 user 消息还原成回传给模型的 content。
 *
 * 带图片的那条消息在库里存的是 JSON.stringify({ text, images })，
 * images 里是完整的 data:image/...;base64 串（单张可达 10MB）。
 * 原样当字符串回传，会让下一轮请求把几 MB 的 base64 当作纯文本正文发出去：
 * 图片既没作为图片传达给模型，请求还会直接顶爆上下文上限被接口拒绝
 * —— 发过一次图之后这个会话就再也聊不动了。
 * 这里只取文本部分，图片由当轮请求的实时入参承载。
 *
 * @param {string} content
 * @returns {string}
 */
function extractHistoryText(content) {
  if (typeof content !== "string" || !content.startsWith("{")) return content;
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
      return parsed.text;
    }
  } catch {
    // 不是 JSON，按普通文本处理
  }
  return content;
}

/**
 * 执行一次工具调用，返回可直接回传给模型的文本结果。
 *
 * 所有失败路径都收敛成文本结果而不是抛异常：
 * 单个工具挂掉不该让整轮对话失败，模型拿到「工具执行失败」后还能改口作答。
 *
 * @param {{ id: string, function: { name: string, arguments: string } }} tool
 * @returns {Promise<string>}
 */
async function runTool(tool) {
  const name = tool.function.name;
  const args = parseToolArguments(tool);

  // 工具名由模型生成，不能用 obj[name] 直接判定存在性：
  // 'constructor' / 'toString' 这类原型链上的键会命中医问，绕过「工具不存在」的兜底，
  // 甚至把继承来的函数当工具执行。必须用自身属性判断。
  if (Object.hasOwn(mcpObj.toolsMap, name)) {
    const serverName = mcpObj.toolsMap[name];
    const client = mcpObj.ClientMap?.[serverName]?.client;
    if (!client) {
      console.error(`[tool] MCP 服务 ${serverName} 未连接，无法调用工具 ${name}`);
      return `工具 ${name} 暂时不可用：其依赖的 MCP 服务未连接`;
    }
    try {
      const mcpRes = await client.callTool({ name, arguments: args });
      return mcpRes?.content?.[0]?.text || JSON.stringify(mcpRes) || "";
    } catch (err) {
      console.error(`[tool] MCP 工具 ${name} 调用失败:`, err.message);
      return `工具 ${name} 调用失败，请稍后重试`;
    }
  }

  if (Object.hasOwn(toolHandleMap, name) && typeof toolHandleMap[name] === "function") {
    try {
      const result = await toolHandleMap[name](args);
      // 本地工具若返回非字符串（对象/数字/undefined），统一序列化，
      // 避免把对象直接绑进 SQL 参数导致驱动报错。
      // JSON.stringify(undefined) 返回的是 undefined 而不是字符串，
      // 直接落库会被 mysql2 以「Bind parameters must not contain undefined」拒绝，
      // 把整轮对话打成通用的 CHAT_FAILED，所以这里补一个空串兜底
      return typeof result === "string" ? result : (JSON.stringify(result) ?? "");
    } catch (err) {
      console.error(`[tool] 本地工具 ${name} 调用失败:`, err.message);
      return `工具 ${name} 调用失败，请稍后重试`;
    }
  }

  // 模型点到了并不存在的工具：把「工具不存在」当成执行结果回给模型，
  // 让它自己改口作答。抛异常会让整轮对话直接失败，对用户毫无帮助。
  console.warn(`[tool] 模型请求了未注册的工具: ${name}`);
  return `工具 ${name} 不存在，无法执行`;
}

/**
 * 收敛客户端传来的模型名。
 *
 * 该字段最终会原样传给上游的 chat.completions.create，因此必须限定在
 * 服务端已知的两个模型上：不设白名单时，任何调用方都能借这一个字段
 * 切到任意上游模型（产生不可控的费用与行为差异），而本项目只配置了
 * 对话模型与图片模型两条分支（见 main() 里 `model === imageModelName`）。
 * 非法值不报错、直接回落到默认对话模型：前端传了旧值或空值时仍能正常问答。
 *
 * @param {unknown} requested
 * @returns {string}
 */
function resolveModel(requested) {
  if (typeof requested === "string") {
    const trimmed = requested.trim();
    // 相等判断必须基于服务端配置值，不能看请求里传了什么
    if (trimmed === imageModelName || trimmed === modelName) return trimmed;
  }
  if (requested) {
    console.warn(
      `[chat] 请求指定了未授权的模型，已回落默认模型: ${typeof requested === "string" ? requested.slice(0, 64) : typeof requested
      }`,
    );
  }
  return modelName;
}

/**
 * SSE 写出封装。
 *
 * 客户端中途断开（关页面、切走、主动取消）时，Node 的 res 会触发 close
 * 并销毁 socket。若继续写：
 *   - main() 会跑完剩余的模型调用与写库，白白产生费用与脏数据；
 *   - 后续每次 res.write 都打在已销毁的 socket 上；
 *   - /chat 外层的 catch 还会把错误事件写给同一个死连接。
 * 这里统一记录连接状态，写之前先判断。
 *
 * @param {import("express").Response} res
 * @returns {{ readonly closed: boolean, write: (payload: object) => void, end: (payload?: object) => void }}
 */
function createSseWriter(res) {
  let closed = false;
  res.on("close", () => {
    closed = true;
  });

  const isDead = () => closed || res.writableEnded;

  return {
    get closed() {
      return isDead();
    },
    write(payload) {
      if (isDead()) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    },
    end(payload) {
      if (isDead()) return;
      if (payload) res.write(`data: ${JSON.stringify(payload)}\n\n`);
      res.end();
    },
  };
}

/**
 * 发起一次流式对话并消费完整响应。
 *
 * 两次模型调用（首次 / 带工具结果重试）此前各写一份，入参完全一致却已出现行为偏差：
 * 首次累积 tool_calls，第二次完全没有，导致模型基于工具结果再次请求工具时被静默丢弃。
 * 抽成同一个函数，两处共用，避免后续再出现同类不一致。
 *
 * @param {{
 *   model: string,
 *   messages: object[],
 *   tools: object[],
 *   onChunk?: (chunk: object) => void,
 *   shouldStop?: () => boolean,
 * }} options
 * @returns {Promise<{ content: string, toolCalls: object[], finishReason: string|null }>}
 */
async function streamChat({ model, messages, tools, onChunk, shouldStop }) {
  const stream = await openai.chat.completions.create({
    //相当于body请求体
    model,
    messages,
    tools,
    stream: true,
  });

  let content = "";
  const toolCalls = [];
  let finishReason = null;

  for await (const chunk of stream) {
    // 客户端已断开：主动中断上游流，别让模型把剩下的内容生成完
    if (typeof shouldStop === "function" && shouldStop()) {
      stream.controller?.abort?.();
      break;
    }
    if (!chunk.choices || !chunk.choices[0]) {
      continue;
    }
    const delta = chunk.choices[0].delta || {};

    // 工具调用：arguments 是分片下发的，按 index 归并后再逐段拼接
    if (Array.isArray(delta.tool_calls)) {
      for (const tool of delta.tool_calls) {
        // 缺失 index 时续接到「最后一个」而不是新开一个槽位：
        // 部分 OpenAI 兼容网关（baseURL 可配，不保证是官方实现）
        // 只在首帧给 index，续帧不带；按 toolCalls.length 新开会把一个调用的
        // arguments 拆成好几条，每条都解析失败，工具被静默丢弃
        const index = tool.index ?? Math.max(toolCalls.length - 1, 0);
        if (!toolCalls[index]) {
          toolCalls[index] = {
            index,
            id: "",
            type: "function",
            function: { name: "", arguments: "" },
          };
        }
        const target = toolCalls[index];
        if (tool.id) target.id = tool.id;
        if (tool.function?.name) target.function.name = tool.function.name;
        if (tool.function?.arguments) target.function.arguments += tool.function.arguments;
      }
    }

    content += delta.content || "";
    finishReason = chunk.choices[0].finish_reason || finishReason;

    // 工具调用那一帧只带 finish_reason、没有正文，原实现也没有转发给前端
    if (finishReason === "tool_calls") break;
    if (typeof onChunk === "function") onChunk(chunk);
    if (finishReason) break;
  }

  return { content, toolCalls: toolCalls.filter(Boolean), finishReason };
}

/**
 * 读取某个会话的全部消息行。
 *
 * 这段「按 convert_id 查 chat_message」在 /title、/singleChat、main() 里各写了一份，
 * 且已经开始跑偏（有的裸 JSON.parse、有的用 parseStoredArguments）。
 * 统一到一处，安全解析与排序规则才不会各修各的。
 *
 * ORDER BY 带 id 兜底：created_at 是 DATETIME（秒级精度），
 * 同一秒内写入的 user / tool / assistant 几行没有稳定相对顺序，
 * 只按 created_at 排会导致历史顺序错乱、按序裁剪时删掉新消息留下旧消息。
 *
 * @param {string} convertId
 * @param {number|null} [excludeId] 需要排除的消息 id
 * @returns {Promise<Array<{ role: string, content: string, tool_call_id: string|null, cardName: string|null, arguments: object|null }>>}
 */
async function fetchConvertMessages(convertId, excludeId = null) {
  // excludeId 用于排除「本轮刚写入的那条提问」：
  // 用户消息在 /chat 入口就已落库（前端要立刻凭它生成标题），
  // 若读取上下文时不排除，它会作为历史重复注入一次
  const rows = await query(`
    SELECT role, content, tool_call_id, card_name, arguments
    FROM chat_message
    WHERE convert_id = ?${excludeId ? " AND id <> ?" : ""}
    ORDER BY created_at ASC, id ASC
  `, excludeId ? [convertId, excludeId] : [convertId]);

  return rows.map(msg => ({
    role: msg.role,
    content: msg.content,
    tool_call_id: msg.tool_call_id,
    cardName: msg.card_name,
    arguments: parseStoredArguments(msg.arguments),
  }));
}

//调用模型
// 说明：入参里不再带 userId —— 该方法全程只用 convertId 定位会话，
// userId 仅用于 /chat 的入口校验与建表，传进来不会被使用。
async function main(keyword = "你好", convertId, sse, userFeature = "", model = modelName, files = [], turn = null) {
  // files 已在 /chat 入口收敛过（用户消息在那里就要落库），这里不再重复处理

  if (model === imageModelName) {
    console.log("调用图片生成模型:", model);
    // 本轮的用户消息已在 /chat 入口写入，此处不再重复插入
    try {
      // 图片生成走独立网关，地址、路径与模型名均来自 .env，不再硬编码。
      // 局部变量名与模块级的 openai 区分开，避免在后续维护中误以为改的是对话客户端
      const imageClient = new OpenAI({
        apiKey,
        baseURL: imageBaseURL
      });
      const content = [{ "type": "text", "text": keyword }];
      files.forEach(imgBase64 => {
        content.push({ "type": "image", "image": imgBase64 });
      });
      const imageRes = await imageClient.request({
        method: "post",
        path: imageGeneratePath,
        body: {
          "model": imageModelName,
          "input": {
            "messages": [
              {
                "role": "user",
                "content": content
              }
            ]
          },
          // 生成参数统一走配置中心，调参数不用改业务代码
          "parameters": {
            "size": imageSize,
            "n": imageCount,
            "watermark": imageWatermark,
            "thinking_mode": imageThinkingMode
          }
        }
      });
      // 只记录取到的结果与必要状态：整份响应里带签名后的图片直链与接入点信息
      const imageUrl = imageRes.output?.choices?.[0]?.message?.content?.[0]?.image || "";
      console.log(`图片生成完成: ${imageUrl ? "已返回图片地址" : "未返回图片地址"}`);
      if (imageUrl) {
        sse.write({ imageUrl });
        await query(`INSERT INTO chat_message (convert_id, role, content) VALUES (?, ?, ?)`, [convertId, "assistant", `![生成的图片](${imageUrl})`]);
        // 只有真正拿到图片才算这一轮成功。
        // 否则会在 /chat 收尾时判定为失败，把入口写入的这条提问一并回滚
        if (turn) turn.answered = true;
      } else {
        // 网关返回 200 但没给图片地址：对用户而言同样是失败，
        // 按错误事件回给前端，而不是发一个空图片地址让界面留白
        console.warn("图片生成未返回图片地址，本轮按失败处理");
        sse.write({
          imageUrl: "",
          error: "图片生成失败，请稍后重试",
          code: "IMAGE_FAILED",
        });
      }
    } catch (err) {
      // 详情只进服务端日志：网关报错里带内网地址与接入点信息
      console.error("图片生成失败:", err);
      sse.write({
        imageUrl: "",
        error: "图片生成失败，请稍后重试",
        code: "IMAGE_FAILED",
      });
    }
    sse.end({ done: true });
    return;
  }

  // 执行独立操作，加快响应速度
  console.log("开始并行执行初始化操作");
  const [ragResult, singleChatList] = await Promise.all([
    // 检索链路：query改写 -> Embedding -> 向量检索 -> Prompt组装
    // 全链路已内置兜底，异常时返回降级结果而非抛出，保证问答主流程不中断
    prepareRagContext(keyword).catch(err => {
      console.error("RAG 检索链路异常，降级为无检索模式:", err.message);
      return {
        prompt: "请只根据以下资料回答用户的问题。如果资料里没有，请说‘我不知道’。",
        sources: [],
        hasContext: false,
        degraded: true,
        notice: "知识库检索暂不可用，已降级为通用回答",
        query: keyword,
        rewritten: false,
      };
    }),
    //携带上下文历史，如果查询不到直接返回空数组
    (async () => {
      console.log("步骤1: 读取数据库消息并且转换为消息列表");
      // 排除本轮提问：它已在 /chat 入口落库，会在下面单独拼进消息列表
      const messages = await fetchConvertMessages(convertId, turn ? turn.userMessageId : null);
      // 历史里的 tool 消息只有 tool_call_id，没有与之配对的 assistant.tool_calls
      // （chat_message 表未存 tool_calls）。这种「孤儿 tool 消息」回传给模型会被接口
      // 直接以 400 拒绝，导致续聊必然失败。卡片类消息只用于前端渲染卡片，
      // 普通工具结果也早已并进持久化的 assistant 回复里，因此这里整体不回传。
      const list = messages
        .filter(msg => msg.role !== "tool")
        .map(msg => ({
          role: msg.role,
          // 只回传文本：带图消息在库里是 { text, images } 的 JSON，
          // 直接回传会把 MB 级 base64 当正文发出去
          content: extractHistoryText(msg.content),
        }));

      // 步骤2：用户消息的落库已提前到 /chat 入口（前端要立刻凭它生成标题），
      // 这里只负责把它拼进本轮上下文
      const userMsg = { role: "user", content: keyword };
      if (files && files.length > 0) {
        userMsg.content = [];
        files.forEach(imgBase64 => {
          userMsg.content.push({ "type": "image", "image": imgBase64 });
        });
        userMsg.content.push({ "type": "text", "text": keyword });
      }
      list.push(userMsg);
      return list;
    })()
  ]);
  console.log("上下文全部请求完成");

  // 读取历史期间客户端可能已经断开：继续跑模型调用与写库纯属浪费
  if (sse.closed) {
    console.log("客户端已断开，终止本次问答");
    return;
  }

  // 把检索来源与降级提示先行推送给前端，便于溯源排查（需求：可查看检索来源）
  sse.write({
    type: "rag_sources",
    sources: ragResult.sources,
    hasContext: ragResult.hasContext,
    degraded: ragResult.degraded,
    notice: ragResult.notice,
    rewrittenQuery: ragResult.query,
  });
  // 大模型初始化
  console.log("步骤4: 调用大模型API");
  const allTools = [...toolList, ...mcpObj.toolList]
  // 只打印工具名，不整份序列化：每个请求都打一遍完整 schema 会淹没日志，
  // 且 schema 里可能带第三方接口描述，排障时并不需要
  console.log(`当前可用工具 ${allTools.length} 个: ${allTools.map(t => t?.function?.name).filter(Boolean).join(", ")}`)
  // RAG 提示词紧跟在主 system 消息之后、历史消息之前。
  // 原实现把它整个塞在历史（含 tool_calls / tool 结果）后面，
  // 而不少模型服务端要求 system 消息必须位于对话开头，
  // 夹在工具结果之后会被直接 400 —— 一旦检索命中，每次问答都会失败。
  const messages = () => [
    getSystemMessage(userFeature),
    { role: "system", content: ragResult.prompt },
    ...singleChatList,
  ];

  const first = await streamChat({
    model,
    messages: messages(),
    tools: allTools,
    // 逐帧转发给前端，前端据此做打字机效果
    onChunk: (chunk) => sse.write(chunk),
    shouldStop: () => sse.closed,
  });
  console.log("大模型API调用成功，流式接收完毕");
  const resObj = { role: "assistant", content: first.content, tool_calls: first.toolCalls };

  // 判断是否需要调用工具
  // 本轮响应是否已经收尾。用它统一决定结尾的 done + sse.end()，
  // 避免每个分支各写一遍、漏掉任何一条路径
  let answered = false;

  if (resObj.tool_calls && resObj.tool_calls.length > 0) {
    // 卡片类工具只负责把参数推给前端渲染卡片，不参与模型推理。
    // 注意不能因为它存在就跳过其余工具：一轮里同时返回卡片与普通工具是完全可能的，
    // 原实现用 if/else 二选一，普通工具的结果既不返回也不落库，用户的问题被静默丢弃。
    const cardTools = resObj.tool_calls.filter((tool) => frontList.includes(tool.function.name));
    // 普通工具：并行跑完本轮全部调用，再统一发起第二次模型调用。
    // 一轮可能返回多个 tool_call，逐个发起第二次调用既多余又违反协议
    // （tool 消息必须与 assistant.tool_calls 一一对应地成组出现）。
    const callTools = resObj.tool_calls.filter((tool) => !frontList.includes(tool.function.name));

    // 按 function calling 协议，每条 tool 消息都必须紧跟在带有对应 tool_calls 的
    // assistant 消息之后。此前只 push 了工具结果、没 push 这条 assistant 消息，
    // 第二次调用会因「tool 消息缺少前序 tool_calls」被模型接口以 400 拒绝。
    //
    // tool_calls 只带 callTools：卡片工具不会产生 tool 回执（见下），
    // 若把它们的 id 一并写进 assistant 消息，就出现「有 tool_call 却无对应 tool 消息」，
    // 上游同样按协议违规 400 —— 一轮里同时命中卡片与普通工具时每次都失败。
    // callTools 为空（纯卡片轮）时这条消息本身也不需要，直接不 push。
    if (callTools.length > 0) {
      singleChatList.push({
        role: "assistant",
        content: resObj.content || "",
        tool_calls: callTools.map((tool) => ({
          id: tool.id,
          type: "function",
          function: {
            name: tool.function.name,
            arguments: tool.function.arguments,
          },
        })),
      });
    }

    for (const cardTool of cardTools) {
      const cardName = cardTool.function.name;
      const cardArgs = parseToolArguments(cardTool);
      const cardObj = {
        role: "tool",
        content: "",
        cardName,
        arguments: cardArgs,
        id: cardTool.id,
      };
      // 只记录卡片名与参数长度：cardArgs 由模型依据用户消息生成，
      // 打成整份日志等于把用户数据长期留存到日志系统
      console.log(`推送卡片: ${cardName} (参数 ${JSON.stringify(cardArgs).length} 字节)`);
      sse.write(cardObj);
      // 插入工具卡片消息到数据库
      await query(`
        INSERT INTO chat_message (convert_id, role, content, card_name, arguments)
        VALUES (?, ?, ?, ?, ?)
      `, [convertId, "tool", "", cardName, JSON.stringify(cardArgs)]);
      answered = true;
    }

    const toolResults = await Promise.all(
      callTools.map(async (tool) => ({
        tool,
        // 各工具之间彼此独立，串行 await 会让耗时变成所有延迟之和
        result: await runTool(tool),
      })),
    );

    for (const { tool, result: toolResult } of toolResults) {
      await query(`
        INSERT INTO chat_message (convert_id, role, content, tool_call_id)
        VALUES (?, ?, ?, ?)
      `, [convertId, "tool", toolResult, tool.id]);
      // 将工具调用结果添加到内存列表用于第二次大模型调用
      singleChatList.push({ role: "tool", content: toolResult, tool_call_id: tool.id });
    }

    if (toolResults.length > 0 && !sse.closed) {
      const second = await streamChat({
        model,
        messages: messages(),
        tools: allTools,
        onChunk: (chunk) => sse.write(chunk),
        shouldStop: () => sse.closed,
      });
      resObj.content = second.content;

      if (second.content.trim()) {
        if (sse.closed) {
          // 客户端中途断开时 streamChat 会因 shouldStop() 提前跳出循环，
          // 返回的是「已收到的半截内容」。把它当最终答复落库，
          // 下次打开会话看到的是半句话，且它会作为历史继续喂给模型。
          console.warn("客户端已断开，截断的回答不落库");
        } else {
          // 插入AI最终回复到数据库
          await query(`
            INSERT INTO chat_message (convert_id, role, content)
            VALUES (?, ?, ?)
          `, [convertId, "assistant", second.content]);
          answered = true;
        }
      } else {
        // 模型拿到工具结果后又一次要求调工具（多步工具链）或干脆没吐正文。
        // 此时不能落库一条空的 assistant 消息，也不能直接说「完成」——
        // 交给末尾的 empty 分支给前端一个明确信号
        console.warn(
          `第二次模型调用未返回正文（finishReason=${second.finishReason}，` +
          `再次请求工具 ${second.toolCalls.length} 个），本轮按空响应收尾`
        );
      }
    }
  } else if (resObj.content) {
    if (sse.closed) {
      // 同第二次调用：断开后拿到的是截断内容，落库即脏数据
      console.warn("客户端已断开，截断的回答不落库");
    } else {
      // 插入AI普通回复到数据库
      await query(`
        INSERT INTO chat_message (convert_id, role, content)
        VALUES (?, ?, ?)
      `, [convertId, "assistant", resObj.content]);

      answered = true;
    }
  }

  // 把本轮是否产出有效回答告诉调用方：
  // 为 false 时 /chat 会回滚入口写入的那条用户消息（需求：请求失败的消息不落库）
  if (turn) turn.answered = answered;

  if (answered) {
    sse.end({ done: true })
  } else {
    // 模型既没输出正文也没要求调用工具（例如只回了空 delta）。
    // 这条路径此前没有任何 res.end()，SSE 连接会一直挂着，
    // 前端永远停在「AI 正在输入」直到超时 —— 必须显式收尾。
    console.warn("模型未返回任何内容，主动结束本次流式响应");
    sse.end({ done: true, empty: true })
  }

  // 异步执行消息清理，不阻塞响应
  setImmediate(async () => {
    try {
      // 排序带 id 兜底：created_at 只有秒级精度，同一秒内的多行顺序不稳定，
      // 只按 created_at 排会把「保留最新几条」变成随机删除
      const allMessages = await query(`
        SELECT id FROM chat_message
        WHERE convert_id = ?
        ORDER BY created_at ASC, id ASC
      `, [convertId]);
      if (allMessages.length > MAX_HISTORY_MESSAGES) {
        const removeNum = allMessages.length - KEEP_HISTORY_MESSAGES;
        const deleteIds = allMessages.slice(0, removeNum).map(msg => msg.id);
        // 占位符按 id 数量动态生成：值走参数绑定，
        // 且额外带上 convert_id 条件，避免任何情况下误删到别的会话
        await query(
          `DELETE FROM chat_message WHERE convert_id = ? AND id IN (${deleteIds.map(() => "?").join(",")})`,
          [convertId, ...deleteIds],
        );
        console.log(`清理了 ${removeNum} 条旧消息`);
      }
    } catch (err) {
      console.error("消息清理失败:", err.message);
    }
  });

  return;
}
// 获取用户特点
app.post("/userFeature", async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.json({
      success: false,
      message: "userId不能为空",
    });
  }
  try {
    const userFeature = await getUserFeature(userId, openai);
    // 画像内容由用户对话与模型输出派生，属用户数据；只记录长度与是否命中
    console.log(
      `获取用户特点成功: ${userFeature ? `长度 ${String(userFeature).length}` : "为空"}`,
    );
    res.json({
      success: true,
      data: userFeature
    });
  } catch (err) {
    console.error("获取用户特点失败:", err.message);
    // 对外只给稳定文案：err.message 可能来自模型网关，含内网地址等实现细节
    res.json({
      success: false,
      message: "获取用户画像失败，请稍后重试",
      data: ""
    });
  }
});
// 获得所有对话
app.post("/all", async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.json({
      success: false,
      message: "userId不能为空",
    });
  }
  // 异步处理器必须自带 try/catch：Express 5 会把未捕获的拒绝交给错误中间件，
  // 但连接已经在等待响应，前端只会看到请求悬挂到超时
  try {
    const sessions = await query(`
      SELECT convert_id, title, created_at, updated_at
      FROM chat_session
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `, [userId]);

    const chatList = sessions.map(session => ({
      title: session.title || "未命名对话",
      convertId: session.convert_id
    }));

    // 只记条数：会话标题由用户对话生成，属用户数据，不打进长期留存的日志
    console.log(`获取所有对话成功，共 ${chatList.length} 条`);
    res.json(chatList);
  } catch (err) {
    console.error("获取所有对话失败:", err);
    res.status(500).json({ success: false, message: "获取对话列表失败，请稍后重试" });
  }
});
// 发送消息
app.post("/chat", async (req, res) => {
  // 请求体里的 userFeature 有意不接收：它会原样拼进 system 消息，
  // 收下等于把 system 角色的提示词写权限交给客户端（提示词注入 / 越权设定），
  // 改由服务端按 userId 取值（getUserFeature 内部带缓存）
  const { keyword, userId, convertId, files } = req.body;
  // 请求体里的 model 也不直接采信：它会被原样传给上游 chat.completions.create，
  // 不设白名单等于把「调用哪个模型」交给客户端（成本与行为都不可控）。
  // 只允许显式指定为对话模型或图片模型，其余一律回落到默认对话模型。
  const model = resolveModel(req.body.model);
  // 只记录长度与条数等元信息，不打印 keyword 原文：
  // 聊天内容是用户隐私，服务端日志会被长期留存与集中采集，
  // 排障需要的「这条请求多大、带没带附件」用元信息已经足够
  console.log("收到/chat请求:", {
    keywordLength: typeof keyword === "string" ? keyword.length : 0,
    userId,
    convertId,
    model,
    files: files ? files.length : 0,
  });
  if (!userId) {
    return res.json({ success: false, message: "userId不能为空" });
  }
  if (!convertId) {
    return res.json({ success: false, message: "convertId不能为空" });
  }

  try {
    // 越权写入防护（IDOR）：main() 全程用 convertId 定位会话，
    // 不校验归属的话，任何调用方拿到别人的 convertId 就能往对方会话里追加消息、
    // 触发模型回复并写库。与 /singleChat、/title 的校验口径保持一致。
    // 该查询必须放在 writeHead 之前 —— 一旦切到 SSE 响应头就再也回不了 JSON 了
    const owned = await query(
      `SELECT convert_id FROM chat_session WHERE convert_id = ? AND user_id = ?`,
      [convertId, userId],
    );
    if (!owned || owned.length === 0) {
      return res.status(403).json({ success: false, message: "会话不存在或无权访问" });
    }
  } catch (err) {
    console.error("校验会话归属失败:", err);
    return res.status(500).json({ success: false, message: "服务暂时不可用，请稍后重试" });
  }

  // 本轮的落库状态。用户消息在这里就写入，因此失败时必须能把它回滚掉
  const turn = { userMessageId: null, answered: false };
  const normalizedFiles = normalizeFiles(files);
  // 收敛一次 keyword：它既要落库也要拼进上下文，
  // 客户端没传时用 "你好" 兜底，避免 undefined 直接进 SQL 报错
  const safeKeyword = typeof keyword === "string" ? keyword : "你好";

  // 用户消息提前到「返回响应头之前」写入，理由有二：
  // 1. 前端收到响应头即视为消息已成功送达，并立刻请求生成会话标题，
  //    标题生成侧必须已经能读到这条提问；
  // 2. 本轮一旦失败，下面会把它删掉 —— 失败的提问不该留在数据库里。
  try {
    const userContent = normalizedFiles.length > 0
      ? JSON.stringify({ text: safeKeyword, images: normalizedFiles })
      : safeKeyword;
    const inserted = await query(`
      INSERT INTO chat_message (convert_id, role, content)
      VALUES (?, ?, ?)
    `, [convertId, "user", userContent]);
    turn.userMessageId = inserted.insertId;
  } catch (err) {
    console.error("写入用户消息失败:", err);
    return res.status(500).json({ success: false, message: "服务暂时不可用，请稍后重试" });
  }

  /**
   * 回滚本轮写入的用户消息。
   *
   * 带 convert_id 与 role 双重条件：id 是自增主键，理论上已经唯一，
   * 但这里多加两道约束，确保任何情况下都不会误删别的会话或别的角色的数据。
   * 幂等：answered 为 true（本轮已产出有效回答）时直接返回。
   */
  const rollbackUserMessage = async () => {
    if (turn.answered || !turn.userMessageId) return;
    try {
      await query(
        `DELETE FROM chat_message WHERE id = ? AND convert_id = ? AND role = 'user'`,
        [turn.userMessageId, convertId],
      );
      console.log(`本轮未产出回答，已回滚用户消息 id=${turn.userMessageId}`);
    } catch (err) {
      console.error("回滚用户消息失败:", err.message);
    }
  };

  // 用户画像：只等一个很短的期限。
  // 它是锦上添花的提示词增强，而缓存未命中时 getUserFeature 内部要额外调一次模型
  // （实测数秒），让用户点完发送干等这么久，直接违背「操作响应无延迟」。
  // 超时不取消、也不报错：那个请求继续跑，跑完会把结果写进缓存，下一次即命中。
  let userFeature = "";
  try {
    const profile = getUserFeature(userId, openai);
    // 先挂上拒绝处理：超时后这个 promise 仍在飞，
    // 失败时若无人接管会变成未捕获拒绝
    profile.catch(err => console.warn("获取用户画像失败(后台):", err.message));

    userFeature = String(
      await Promise.race([
        profile,
        new Promise((resolve) => {
          const timer = setTimeout(() => resolve(""), PROFILE_WAIT_MS);
          if (typeof timer.unref === "function") timer.unref();
        }),
      ]) || "",
    ).slice(0, 200);

    if (!userFeature) {
      console.log(`用户画像未在 ${PROFILE_WAIT_MS}ms 内就绪，本次不注入，后台继续生成`);
    }
  } catch (err) {
    console.warn("获取用户画像失败，本次不注入画像:", err.message);
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
  });
  // 立刻下发响应头：前端据此判定「消息已成功送达」并马上发起标题生成，
  // 不必等到模型吐出第一个 token（检索链路本身就要跑好几秒）
  res.flushHeaders();
  const sse = createSseWriter(res);
  try {
    await main(safeKeyword, convertId, sse, userFeature, model, normalizedFiles, turn);
  } catch (error) {
    console.error("main函数执行失败:", error);
    // 对外的错误文案保持稳定：error.message 可能来自模型网关或数据库驱动，
    // 含内网地址、SQL 片段等信息。详细原因只留在服务端日志里。
    // 前端收到该事件后会展示兜底气泡，用户消息则在本轮收尾时被回滚。
    // 走 sse.end 而非裸 res.write：连接已被客户端关掉时不应再往死 socket 上写
    sse.end({ error: "AI 服务暂时不可用，请稍后重试", code: "CHAT_FAILED" });
  }

  // 统一收尾：main 抛错、图片生成失败、模型空响应、客户端中途断开这几种情况
  // 都算「本轮没有产出有效回答」，此时把入口写入的用户消息删掉。
  // 此前用户消息无条件落库，一次失败的提问会留下只有提问、没有回答的孤儿记录，
  // 下次打开会话还会被当作上下文喂给模型
  await rollbackUserMessage();
});
// 新建对话
app.post("/new", async (req, res) => {
  // 拿到传进来的userId
  const { userId } = req.body;
  // 缺 userId 时原先会拼出 "undefined1726..." 这样的会话 ID 并入库，
  // 产生一条谁都认领不了的脏数据，必须前置拦截
  if (!userId) {
    return res.json({
      success: false,
      message: "userId不能为空",
    });
  }
  if (typeof userId !== "string" || userId.length > 64) {
    return res.json({
      success: false,
      message: "userId 格式不合法",
    });
  }

  try {
    // 生成对话ID并插入数据库，替代 readConversation() 和 writeConversation()
    const convertId = userId + Date.now();
    await query(`
      INSERT INTO chat_session (user_id, convert_id, title)
      VALUES (?, ?, ?)
    `, [userId, convertId, ""]);

    res.json({
      success: true,
      message: "创建成功",
      data: convertId,
    });
  } catch (err) {
    console.error("新建对话失败:", err);
    res.status(500).json({ success: false, message: "新建对话失败，请稍后重试" });
  }
});
// 获得标题
app.post("/title", async (req, res) => {
  const { userId, convertId } = req.body;
  // 不整份打印 req.body：与 /chat 的口径一致，只记录必要标识，
  // 避免 userId / convertId 等标识信息连同其它字段被长期留存
  console.log("收到/title请求:", { userId, convertId });
  if (!userId || !convertId) {
    return res.json([]);
  }
  try {
    // 从数据库查询该会话，替代 readConversation()
    // 带上 user_id 条件：userId 此前只接收不使用，等于任何调用方
    // 拿到一个 convertId 就能读出别人的会话标题并触发标题生成
    const sessions = await query(`
      SELECT convert_id, title
      FROM chat_session
      WHERE convert_id = ? AND user_id = ?
    `, [convertId, userId]);

    if (!sessions || sessions.length === 0) {
      console.log("用户不存在或没有对话:", convertId);
      return res.json([]);
    }

    console.log("对话数量:", sessions.length);
    const returnList = [];
    for (const session of sessions) {
      const _id = session.convert_id;
      if (session.title && session.title !== "") {
        console.log(`对话 ${_id} 已有标题:`, session.title);
        returnList.push({
          title: session.title,
          convertId: _id,
        });
      } else {
        console.log(`对话 ${_id} 没有标题，需要生成`);
        try {
          // 查询对话的消息列表
          const messages = await fetchConvertMessages(_id);

          const idConvertList = messages
            // 只取对话正文：tool 消息是卡片/工具结果，且带图消息的 content
            // 是含 MB 级 base64 的 JSON，直接当正文送去生成标题会顶爆上下文
            .filter(msg => msg.role === "user" || msg.role === "assistant")
            .map(msg => ({
              role: msg.role,
              content: extractHistoryText(msg.content)
            }));

          if (!idConvertList || idConvertList.length === 0) {
            console.log(`对话 ${_id} 列表为空`);
            returnList.push({
              title: "空对话",
              convertId: _id,
            });
            continue;
          }
          const filterMessages = idConvertList.filter(
            (msg) => msg.role !== "system",
          );
          if (filterMessages.length === 0) {
            console.log(`对话 ${_id} 过滤后为空`);
            returnList.push({
              title: "空对话",
              convertId: _id,
            });
            continue;
          }
          console.log(`对话 ${_id} 开始调用API生成标题，消息数:`, filterMessages.length);
          const title = await summaryMessage(openai, filterMessages);

          // 【MySQL替换】更新数据库中的标题，替代 idConvert.title = title 和 writeConversation()
          await query(`
            UPDATE chat_session 
            SET title = ? 
            WHERE convert_id = ?
          `, [title, _id]);

          console.log(`对话 ${_id} 生成标题成功:`, title);
          returnList.push({
            title: title,
            convertId: _id,
          });
        } catch (err) {
          console.error(`处理对话 ${_id} 失败:`, err.message);
          returnList.push({
            title: "未命名对话",
            convertId: _id,
          });
        }
      }
    }
    console.log("标题请求处理完成，返回数量:", returnList.length);
    res.json(returnList);
  } catch (err) {
    console.error("生成标题失败:", err);
    res.status(500).json({
      success: false,
      message: "生成标题失败，请稍后重试",
    });
  }
})
// 获得单条对话
app.post("/singleChat", async (req, res) => {
  // 验证userId是否为空
  const { userId, convertId } = req.body;
  if (!userId) {
    return res.json({
      success: false,
      message: "userId不能为空",
    });
  }
  if (!convertId) {
    return res.json({
      success: false,
      message: "convertId不能为空",
    });
  }

  try {
    // 从数据库查询对话信息，替代 readConversation()
    const session = await query(`
      SELECT title FROM chat_session
      WHERE user_id = ? AND convert_id = ?
    `, [userId, convertId]);

    if (!session || session.length === 0) {
      return res.json({
        success: false,
        message: "对话不存在",
      });
    }

    const singleChat = {
      title: session[0].title,
      // 与 /chat 的历史加载共用同一条查询：
      // 排序、安全解析 arguments 的规则只在一处维护
      list: await fetchConvertMessages(convertId)
    };

    res.json({
      success: true,
      data: singleChat,
    });
  } catch (err) {
    console.error("获取单条对话失败:", err);
    res.status(500).json({ success: false, message: "获取对话详情失败，请稍后重试" });
  }
});
// 转化图片格式
app.post("/changeImg", upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.json({
      success: false,
      message: "请上传图片"
    })
  }
  const file = req.file.buffer
  const fileBase64 = file.toString('base64')
  const fileData = `data:${req.file.mimetype};base64,${fileBase64}`
  res.json({
    success: true,
    data: fileData
  })
})

/**
 * 兜底错误中间件，必须注册在所有路由之后。
 * multer 的体积超限（LIMIT_FILE_SIZE）等中间件异常不会进入业务 try/catch，
 * 没有它时 Express 会返回一页 HTML 报错，前端按 JSON 解析会再抛一次异常，
 * 用户看到的是「网络异常」，排查方向完全被带偏。
 */
app.use((err, req, res, next) => {
  // SSE 已经开始写响应体时不能再改状态码，交给默认处理
  if (res.headersSent) return next(err);

  const tooLarge = err?.code === "LIMIT_FILE_SIZE";
  console.error("[server] 请求处理异常:", err?.message || err);

  res.status(tooLarge ? 413 : 500).json({
    success: false,
    message: tooLarge
      ? `图片过大，请上传 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB 以内的文件`
      : "服务内部错误，请稍后重试",
  });
});

// 监听端口取自配置中心，与 /health 对外汇报的 runtime.port 同源；
// 前端 .env 的 VITE_AI_API_BASE_URL 需要指向同一个端口
app.listen(port, async () => {
  console.log(`服务器运行成功，监听端口 ${port}`);
  console.log("[配置] 当前生效配置:", JSON.stringify(getConfigSummary()));
  // 建表失败必须终止启动：会话与消息表是全部接口的硬依赖，
  // 缺表时服务「看起来在跑」，实际每个接口都返回 500，
  // 用户侧只会看到「AI 服务暂时不可用」，排查成本极高。
  // 直接退出则前端预检会拿到 ERR_CONNECTION_REFUSED，提示明确可执行。
  try {
    await initTables();
  } catch (error) {
    console.error(
      `\n[启动失败] 数据库表初始化未完成，服务无法对外提供问答能力。` +
      `\n  请检查 MySQL 是否可用、DB_* 配置是否正确（详见 src/.env 与 src/.env.example）。` +
      `\n  原始错误: ${error?.message || error}\n`,
    );
    process.exit(1);
  }

  // 知识库初始化：首次全量入库，后续仅做增量更新
  // 初始化失败不阻断服务启动，问答会自动降级为无检索模式
  const kbResult = await initKnowledgeBase();
  if (kbResult?.ok) {
    console.log(
      `知识库初始化完成：模式=${kbResult.mode} 写入=${kbResult.upserted} 删除=${kbResult.deleted} ` +
      `未变化=${kbResult.unchanged} 片段总数=${kbResult.vectorCount}`
    );
  } else {
    console.error("知识库初始化未完成，问答将以无检索模式运行");
  }
});
