#!/usr/bin/env node

import express from 'express';
import { DatabaseService } from '../services/database';
import { IcoService } from '../services/ico-service';
import { MCP_TOOLS } from './tools';
import { logger } from '../utils/logger';

export class HttpMcpServer {
  private app: express.Application;
  private db: DatabaseService;
  private icoService: IcoService;

  constructor() {
    this.app = express();
    this.db = new DatabaseService();
    this.icoService = new IcoService(this.db);
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
  }

  private setupRoutes() {
    this.app.post('/initialize', this.handleInitialize.bind(this));
    this.app.post('/tools/list', this.handleToolsList.bind(this));
    this.app.post('/tools/call', this.handleToolCall.bind(this));
  }

  private async handleInitialize(req: express.Request, res: express.Response) {
    res.json({
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "ico-mcp-server",
        version: "1.0.0"
      }
    });
  }

  private async handleToolsList(req: express.Request, res: express.Response) {
    res.json({
      tools: MCP_TOOLS
    });
  }

  private async handleToolCall(req: express.Request, res: express.Response) {
    const { name, arguments: args } = req.body;

    try {
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

      res.json({
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: -1,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  async start(port: number = 3001, dbPath?: string) {
    await this.db.initialize(dbPath);
    
    this.app.listen(port, () => {
      logger.info(`HTTP MCP server listening on port ${port}`);
    });
  }

  async stop() {
    await this.db.close();
  }
}

async function main() {
  const server = new HttpMcpServer();
  const port = parseInt(process.env.PORT || '3001');
  
  try {
    await server.start(port);
  } catch (error) {
    logger.error('Failed to start HTTP MCP server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}