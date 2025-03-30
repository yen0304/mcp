import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// 建立 MCP server
const server = new McpServer({
  name: 'Demo',
  version: '1.0.0',
});

// 註冊加法工具
server.tool('add', { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: 'text', text: String(a + b) }],
}));

// 註冊動態問候資源
server.resource(
  'greeting',
  new ResourceTemplate('greeting://{name}', { list: undefined }),
  async (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `Hello, ${name}!`,
      },
    ],
  }),
);

// 註冊回聲工具
server.tool('echo', { message: z.string() }, async ({ message }) => ({
  content: [{ type: 'text', text: `Tool echo: ${message}` }],
}));

// 註冊回聲提示
server.prompt('echo', { message: z.string() }, ({ message }) => ({
  messages: [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Please process this message: ${message}`,
      },
    },
  ],
}));

// 最後才連接 transport
const transport = new StdioServerTransport();
server.connect(transport);
