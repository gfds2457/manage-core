import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// 格式转换
const openaiToolType = (mcpTools) => {
  return mcpTools.map((item) => {
    return {
      type: "function",
      function: {
        name: item.name,
        description: item.description,
        parameters: {
          ...item.inputSchema,
          required: item.inputSchema?.required || []
        }
      }
    }
  })
}
// 客户端连接服务端，并且列出对应服务端里的工具
export const linkMcpAndTools = async (mcpList) => {
  // 存储每个服务端的client和client的transport对象
  let ClientMap = {}
  // 存储每个服务端的工具名称
  let toolsMap = {}
  // 要交给openai的tools值
  let toolList = []
  for (let i = 0; i < mcpList.length; i++) {
    // 1.拿到对应的client和transport并存储
    const McpServer = mcpList[i]
    const { type, url, command, args, headers } = McpServer
    // 创建对应client和transport
    const client = new Client({
      name: McpServer.name,
      version: "1.0.0"
    })
    let transport = null
    if (type === "streamableHttp") {
      transport = new StreamableHTTPClientTransport(url, {
        requestInit: {
          headers: headers || {},
        }
      })
    } else if (type === "stdio") {
      transport = new StdioClientTransport({
        command,
        args: args || [],
      })
    } else {
      throw new Error(`不支持的MCP类型: ${type}`)
    }
    // 连接transport,并存储client与transport
    await client.connect(transport)
    ClientMap[McpServer.name] = { client, transport }
    // 2.拿到每个服务端的工具
    const mcpTools = (await client.listTools()).tools || []
    // 3.转化listTool返回的结构,让其适配于openai的tools属性值格式
    const mcpToOpenai = openaiToolType(mcpTools)
    mcpToOpenai.forEach(item => {
      // 4.以服务端的名称为key值，将每个服务端的工具名称存储到toolsMap中
      toolsMap[item.function.name] = McpServer.name
      //要交给openai的tools值
      toolList.push(item)
    });
  }
  return {
    ClientMap,
    toolsMap,
    toolList
  }
} 
