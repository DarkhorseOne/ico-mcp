#!/usr/bin/env node

import { DatabaseService } from '../services/database';
import { IcoService } from '../services/ico-service';
import { MCP_TOOLS } from './tools';
import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Get absolute path for logs directory
const projectRoot = path.resolve(__dirname, '../..');
const logsDir = path.join(projectRoot, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Stdio-specific logger that ONLY writes to files, never to stdout or stderr
// This is critical for MCP clients like LM Studio that monitor stderr
const stdioLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ico-mcp-stdio-server' },
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'mcp-stdio.log') }),
    // NO console transport - MCP clients monitor stderr and consider any output as errors
  ],
});

export class SimpleStdioMcpServer {
  private db: DatabaseService;
  private icoService: IcoService;

  constructor() {
    this.db = new DatabaseService();
    this.icoService = new IcoService(this.db);
  }

  private async processMessage(message: any): Promise<any> {
    if (!message.method) {
      return { 
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: 'Method not found' } 
      };
    }

    try {
      switch (message.method) {
        case 'initialize':
          return {
            jsonrpc: "2.0",
            id: message.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: { name: "ico-mcp-server", version: "1.0.0" }
            }
          };

        case 'tools/list':
          return {
            jsonrpc: "2.0",
            id: message.id,
            result: { tools: MCP_TOOLS }
          };

        case 'tools/call':
          const { name, arguments: args } = message.params;
          let result;
          
          switch (name) {
            case 'search_ico_registrations':
              result = await this.icoService.searchRegistrations(args);
              break;
            case 'get_ico_registration':
              result = await this.icoService.getRegistrationByNumber(args.registrationNumber);
              break;
            case 'get_registrations_by_organisation':
              result = await this.icoService.getRegistrationsByOrganisation(args.organisationName, args.limit);
              break;
            case 'get_registrations_by_postcode':
              result = await this.icoService.getRegistrationsByPostcode(args.postcode, args.limit);
              break;
            case 'get_data_version':
              result = await this.icoService.getDataStats();
              break;
            case 'get_all_data_versions':
              result = await this.icoService.getAllDataVersions();
              break;
            default:
              throw new Error(`Unknown tool: ${name}`);
          }

          return {
            jsonrpc: "2.0",
            id: message.id,
            result: {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            }
          };

        default:
          return {
            jsonrpc: "2.0",
            id: message.id,
            error: { code: -32601, message: 'Method not found' }
          };
      }
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -1,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async start(dbPath?: string) {
    await this.db.initialize(dbPath);
    stdioLogger.info('Database initialized for stdio MCP server');
    
    process.stdin.setEncoding('utf8');
    
    let buffer = '';
    process.stdin.on('data', async (chunk) => {
      buffer += chunk;
      let lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            const response = await this.processMessage(message);
            process.stdout.write(JSON.stringify(response) + '\n');
          } catch (error) {
            stdioLogger.error('Error processing message:', error);
          }
        }
      }
    });
    
    // Server started - no logging to stdout in stdio mode
  }

  async stop() {
    await this.db.close();
  }
}

async function main() {
  const server = new SimpleStdioMcpServer();
  try {
    await server.start();
  } catch (error) {
    // Log to file
    stdioLogger.error('Failed to start simple stdio MCP server:', error);
    
    // Only output to stderr for truly fatal errors that prevent startup
    if (error instanceof Error && (
      error.message.includes('ENOENT') || 
      error.message.includes('SQLITE_CANTOPEN') ||
      error.message.includes('permission denied')
    )) {
      process.stderr.write(`Fatal error: ${error.message}\n`);
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}