#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { DatabaseService } from '../services/database';
import { IcoService } from '../services/ico-service';
import icoRoutes from './routes/ico';
import { logger } from '../utils/logger';

export class ApiServer {
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
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes() {
    this.app.use('/api/ico', icoRoutes(this.icoService));
    
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  async start(port: number = 3000, dbPath?: string) {
    await this.db.initialize(dbPath);
    
    this.app.listen(port, () => {
      logger.info(`API server listening on port ${port}`);
    });
  }

  async stop() {
    await this.db.close();
  }
}

async function main() {
  const server = new ApiServer();
  const port = parseInt(process.env.PORT || '3000');
  
  try {
    await server.start(port);
  } catch (error) {
    logger.error('Failed to start API server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}