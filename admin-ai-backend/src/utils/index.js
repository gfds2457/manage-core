import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { modelName } from "../env.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { query } from "../mysql.js";

const userFeatureCache = new Map();
const CACHE_TTL = 60 * 60 * 1000;
// 读取对话记录
export const readConversation = () => {
  const conversation = fs.readFileSync(
    path.join(__dirname, "../..", "conversation.json"),
    "utf-8",
  );
  return JSON.parse(conversation);
};
// 写入对话记录
export const writeConversation = (conversation) => {
  fs.writeFileSync(
    path.join(__dirname, "../..", "conversation.json"),
    JSON.stringify(conversation, null, 2),
    "utf-8",
  );
};
// 总结对话，生成标题
export const summaryMessage = async (openai, messages) => {
  try {
    const res = await openai.chat.completions.create(
      {
        model: modelName,
        messages: [{
          role: "system",
          content: "帮我总结下面的对话记录，生成一个一定不能为空的不超过15个字符的标题",
        }, ...messages,],
      },
    );
    if (res && res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) {
      return res.choices[0].message.content;
    }
    return "未命名对话";
  } catch (err) {
    console.error("summaryMessage error:", err.message);
    return "未命名对话";
  }
};
// 获取所有对话
export const getAllChat = async (userId) => {
  // 【MySQL替换】从数据库查询用户的所有对话，替代 readConversation()
  const sessions = await query(`
    SELECT convert_id, title, created_at, updated_at 
    FROM chat_session 
    WHERE user_id = ? 
    ORDER BY updated_at DESC
  `, [userId]);

  const userConversation = {};
  for (const session of sessions) {
    // 【MySQL替换】查询每个对话的消息列表
    const messages = await query(`
      SELECT role, content, tool_call_id, card_name, arguments 
      FROM chat_message 
      WHERE convert_id = ? 
      ORDER BY created_at ASC
    `, [session.convert_id]);

    userConversation[session.convert_id] = {
      title: session.title,
      list: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        tool_call_id: msg.tool_call_id,
        cardName: msg.card_name,
        arguments: msg.arguments ? JSON.parse(msg.arguments) : null
      }))
    };
  }
  return userConversation
}
// 获取用户特点
export const getUserFeature = async (userId, openai) => {
  const cached = userFeatureCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("使用缓存的用户特点:", userId);
    return cached.value;
  }

  const userConversation = await getAllChat(userId)
  console.log("得到的所有对话", userConversation)

  const allMessages = []
  for (const convertId in userConversation) {
    const conversation = userConversation[convertId]
    if (conversation.list && conversation.list.length > 0) {
      allMessages.push(...conversation.list)
    }
  }

  if (allMessages.length === 0) {
    console.log("用户没有历史对话，跳过分析");
    userFeatureCache.set(userId, { value: "", timestamp: Date.now() });
    return "";
  }

  console.log("经过处理后得到的对话", allMessages)

  const completion = await openai.chat.completions.create({
    model: modelName,
    messages: [{
      role: "system",
      content: "帮我分析以下对话，总结出用户身份,喜好,状态(情感,身体),用户行为模式等，要求简洁明了,不能超过50个字符"
    }, ...allMessages]
  });

  const userFeature = completion.choices?.[0]?.message?.content || "";
  console.log("获得用户特点完成:", userFeature);

  userFeatureCache.set(userId, { value: userFeature, timestamp: Date.now() });

  const templatePath = path.join(__dirname, "../../context/context.template.md");
  const contextPath = path.join(__dirname, "../../context/context.md");
  try {
    const template = fs.readFileSync(templatePath, "utf8");
    const updatedData = template.replace(/\$\{userFeature\}/g, userFeature);
    fs.writeFileSync(contextPath, updatedData);
    console.log("上下文文件更新成功:", contextPath);
  } catch (err) {
    console.error("更新上下文文件失败:", err.message);
  }

  return userFeature
}
