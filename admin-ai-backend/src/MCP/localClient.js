import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const client = new Client({
  name: "open_cursor",
  version: "1.0.0"
})
const transport = new StdioClientTransport({
  command: "node",
  args: [
    path.join(__dirname, "localSever.js")
  ]
})
await client.connect(transport)
const res = await client.callTool({
  name: "open_cursor"
})
console.log(res)
