import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({
  name: "remoteMcp",
  version: "1.0.0",
})
const transport = new StdioClientTransport({
  command: "npx",
  args: [
    "chrome-devtools-mcp@latest",
    "--channel=canary",
    "--headless=true",
    "--isolated=true"
  ],
})
client.connect(transport)
const tools = await client.listTools()
console.log(tools)