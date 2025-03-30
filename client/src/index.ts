import { Anthropic } from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import readline from 'readline/promises';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { ServerConnection, Config, ServerConfig } from './types';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set');
}

class MCPClient {
  private anthropic: Anthropic;
  private servers: Map<string, ServerConnection> = new Map();
  private config: Config;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
    this.config = { servers: [] };
  }

  async loadConfig(configPath: string) {
    const configContent = await fs.readFile(configPath, 'utf-8');
    this.config = JSON.parse(configContent);
  }

  async connectToServers() {
    for (const serverConfig of this.config.servers) {
      await this.connectToServer(serverConfig);
    }
  }

  private async connectToServer(serverConfig: ServerConfig) {
    try {
      const serverPath = path.resolve(process.cwd(), serverConfig.path);
      const isJs = serverPath.endsWith('.js');
      const isPy = serverPath.endsWith('.py');

      if (!isJs && !isPy) {
        throw new Error('Server script must be a .js or .py file');
      }

      const command = isPy
        ? process.platform === 'win32'
          ? 'python'
          : 'python3'
        : process.execPath;

      const mcp = new Client({
        name: `mcp-client-${serverConfig.name}`,
        version: '1.0.0',
      });

      const transport = new StdioClientTransport({
        command,
        args: [serverPath],
      });

      mcp.connect(transport);

      const toolsResult = await mcp.listTools();
      const tools = toolsResult.tools.map((tool) => ({
        name: `${serverConfig.name}:${tool.name}`,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      this.servers.set(serverConfig.name, { mcp, transport, tools });

      console.log(
        `Connected to server "${serverConfig.name}" with tools:`,
        tools.map(({ name }) => name),
      );
    } catch (e) {
      console.error(`Failed to connect to server "${serverConfig.name}":`, e);
      throw e;
    }
  }

  async processQuery(query: string) {
    const messages: MessageParam[] = [
      {
        role: 'user',
        content: query,
      },
    ];

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages,
      tools: this.tools,
    });

    const finalText = [];
    const toolResults = [];

    for (const content of response.content) {
      if (content.type === 'text') {
        finalText.push(content.text);
      } else if (content.type === 'tool_use') {
        const toolName = content.name;
        const toolArgs = content.input as { [x: string]: unknown } | undefined;

        const result = await this.mcp.callTool({
          name: toolName,
          arguments: toolArgs,
        });
        toolResults.push(result);
        finalText.push(`[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`);

        messages.push({
          role: 'user',
          content: result.content as string,
        });

        const response = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages,
        });

        finalText.push(response.content[0].type === 'text' ? response.content[0].text : '');
      }
    }

    return finalText.join('\n');
  }

  async chatLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log('\nMCP Client Started!');
      console.log("Type your queries or 'quit' to exit.");

      let isRunning = true;
      while (isRunning) {
        const message = await rl.question('\nQuery: ');
        if (message.toLowerCase() === 'quit') {
          isRunning = false;
        } else {
          const response = await this.processQuery(message);
          console.log('\n' + response);
        }
      }
    } finally {
      rl.close();
    }
  }

  async cleanup() {
    await this.mcp.close();
  }
}

async function main() {
  const configPath = './mcp-server.json';
  const mcpClient = new MCPClient();
  try {
    await mcpClient.loadConfig(configPath);
    await mcpClient.connectToServers();
    await mcpClient.chatLoop();
  } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}

main();
