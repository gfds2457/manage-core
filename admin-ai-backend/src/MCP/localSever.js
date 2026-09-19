import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec } from 'child_process'
const server = new McpServer({
  name: "localMcp",
  version: "1.0.0"
})
server.registerTool("open_cursor", { description: "打开cursor软件" }, () => {
  const path = "d:/cursor/Cursor.exe"
  exec(`start""${path}`, (err) => {
    if (err) {
      console.log("启动失败", err)
    } else {
      console.log("启动成功")
    }
  })
  return {
    content: [
      {
        type: "text",
        text: "打开成功"
      }
    ]
  }
})
const transport = new StdioServerTransport()
await server.connect(transport)