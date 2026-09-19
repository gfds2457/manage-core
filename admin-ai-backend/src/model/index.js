/**
 * 图片生成模型调用示例 / 冒烟脚本
 *
 * 注意：模型地址、模型名、鉴权信息全部来自 src/.env，禁止在此硬编码。
 * 用法：node src/model/index.js
 */
import { OpenAI } from "openai/client.js";
import { apiKey, imageBaseURL, imageModelName, validateConfig } from "../env.js";

async function main() {
  // 缺失配置直接给出明确提示，避免发出必然失败的请求
  validateConfig();

  const openai = new OpenAI({
    apiKey,
    baseURL: imageBaseURL,
  });

  const res = await openai.request({
    // 请求头 openai.request 内部自动写好
    method: "post",
    path: "/services/aigc/multimodal-generation/generation",
    // 文档中的 data 对应 body 属性
    body: {
      model: imageModelName,
      input: {
        messages: [
          {
            role: "user",
            content: [{ text: "一间有着精致窗户的花店，漂亮的木质门，摆放着花朵" }],
          },
        ],
      },
      parameters: {
        size: "2K",
        n: 1,
        watermark: false,
        thinking_mode: true,
      },
    },
  });

  console.log(JSON.stringify(res, null, 2));
}

main().catch((err) => {
  console.error(`图片生成调用失败: ${err.message}`);
  process.exit(1);
});
