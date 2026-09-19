import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs"
import { mcpList } from "./config.js"
import { linkMcpAndTools } from "./mcpClient.js"

const filePath = fileURLToPath(import.meta.url)
const __dirname = path.dirname(filePath)
const imgPath = path.join(__dirname, "../src/assets/icons/edit.svg")
const app = express();
const port = 3001
app.use(cors());
app.use(express.json())


//mcp接口
app.post("/mcp", async (req, res) => {
  const server = new McpServer({
    name: "myMcp",
    version: "1.0.0"
  })
  server.registerPrompt("baseContext", {
    title: "基础上下文",
    description: "角色，上下文，输出输出要求",
    argsSchema: z.object({
      defaultUserFeature: z.string().describe("用户特征")
    })
  }, (args) => {
    const { defaultUserFeature } = args
    const contextPath = path.join(__dirname, "../../context/context.md")
    const context = fs.readFileSync(contextPath, "utf-8")
    return {
      content: [
        {
          type: "text",
          text: context
        }
      ]
    }
  })
  server.registerResource("图片", `image://${imgPath}`, {
    title: "icon",
    description: "icon",
    mimeType: "image/svg"
  }, (uri) => {
    const buf = fs.readFileSync(imgPath)
    return {
      contents: [
        {
          url: uri.href,
          blob: buf.toString('base64')
        }
      ]
    }
  })
  const transport = new StreamableHTTPServerTransport()
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
})
// 启动服务器
app.listen(port, () => {
  console.log("服务器运行成功");
})
const { ClientMap } = await linkMcpAndTools(mcpList)
const webSearchTools = await ClientMap["web_search"].client.listTools()
console.log(webSearchTools) 