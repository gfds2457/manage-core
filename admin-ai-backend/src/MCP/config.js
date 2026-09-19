import { apiKey } from "../env.js"
export const mcpList = [
  {
    name: "mymcp",
    type: "streamableHttp",
    url: "http://localhost:3001/mcp",
  },
  {
    name: "Chrome",
    type: "stdio",
    command: "npx",
    args: [
      "chrome-devtools-mcp@latest",
      "--channel=canary",
      "--headless=true",
      "--isolated=true"
    ],
  },
  {
    name: "web_search",
    type: "streamableHttp",
    url: "https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp",
    headers: {
      "Authorization": `Bearer ${apiKey}`
    }
  }
]