import { Anthropic } from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import readline from 'readline/promises';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { ServerConnection, Config, ServerConfig } from './types';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { console } from 'inspector';

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
      let command: string;
      let args: string[] = [];
      if (serverConfig.command === 'npx') {
        command = 'npx';
        args = [...(serverConfig.args || [])];
      } else {
        const serverPath = path.resolve(process.cwd(), serverConfig.path);
        const isJs = serverPath.endsWith('.js');
        const isPy = serverPath.endsWith('.py');

        if (!isJs && !isPy) {
          throw new Error('Server script must be a .js or .py file');
        }

        command = isPy ? (process.platform === 'win32' ? 'python' : 'python3') : process.execPath;
        args = [serverPath];
      }

      const mcp = new Client({
        name: `mcp-client-${serverConfig.name}`,
        version: '1.0.0',
      });

      const transport = new StdioClientTransport({
        command,
        args,
      });

      mcp.connect(transport);

      const toolsResult = await mcp.listTools();
      const tools: Tool[] = toolsResult.tools.map((tool) => ({
        name: `${serverConfig.name}_${tool.name}`,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      this.servers.set(serverConfig.name, {
        mcp,
        transport,
        tools,
      });

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

    // 合併所有伺服器的工具
    const allTools = Array.from(this.servers.values()).flatMap((s) => s.tools);
    const toolNames = allTools.map((tool) => tool.name);
    console.log('Available tools:', toolNames);
    const response = await this.anthropic.messages.create({
      // model: 'claude-3-5-sonnet-20241022',
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 1000,
      messages,
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      })),
    });

    const finalText = [];

    for (const content of response.content) {
      if (content.type === 'text') {
        finalText.push(content.text);
      } else if (content.type === 'tool_use') {
        const [serverName, toolName] = content.name.split('_');
        const server = this.servers.get(serverName);

        if (!server) {
          finalText.push(`[Error: Server "${serverName}" not found]`);
          continue;
        }

        const toolArgs = content.input as { [x: string]: unknown } | undefined;

        const result = await server.mcp.callTool({
          name: toolName,
          arguments: toolArgs,
        });

        finalText.push(`[Calling tool ${content.name} with args ${JSON.stringify(toolArgs)}]`);
        messages.push({
          role: 'user',
          content: result.content as string,
        });

        const followUpResponse = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages,
        });

        finalText.push(
          followUpResponse.content[0].type === 'text' ? followUpResponse.content[0].text : '',
        );
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
          rl.write('\nResponse:\n');
          rl.write(response);
          rl.write('\n');
        }
      }
    } catch (error) {
      rl.write('\nError during chat loop:\n');
      rl.write(String(error));
      rl.write('\n');
    } finally {
      rl.close();
    }
  }

  async cleanup() {
    for (const [serverName, server] of this.servers) {
      try {
        await server.mcp.close();
        console.log(`Disconnected from server "${serverName}"`);
      } catch (e) {
        console.error(`Error disconnecting from server "${serverName}":`, e);
      }
    }
  }
}

async function main() {
  const configPath = './mcp-server.json';
  const mcpClient = new MCPClient();
  try {
    await mcpClient.loadConfig(configPath);
    await mcpClient.connectToServers();
    await mcpClient.chatLoop();
  } catch (error) {
    console.error('Error:', error);
    console.error('Please check your configuration and server scripts.');
    console.error('Make sure the server scripts are executable and accessible.');
  } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}

main();
