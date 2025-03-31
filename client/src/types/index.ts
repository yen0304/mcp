import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

interface ServerConfig {
  name: string;
  path: string;
  description?: string;
  command: 'npx' | 'python' | 'node';
  args?: string[];
}

interface Config {
  servers: ServerConfig[];
}

interface ServerConnection {
  mcp: Client;
  transport: StdioClientTransport;
  tools: Tool[];
}

export type { ServerConfig, Config, ServerConnection };
