#!/usr/bin/env node

import { logger } from './utils/logger';

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'api':
      logger.info('Starting REST API server...');
      const { ApiServer } = await import('./api/server');
      const apiServer = new ApiServer();
      await apiServer.start();
      break;
      
    case 'mcp-http':
      logger.info('Starting HTTP MCP server...');
      const { HttpMcpServer } = await import('./mcp/http-server');
      const httpMcpServer = new HttpMcpServer();
      await httpMcpServer.start();
      break;
      
    case 'mcp-stdio':
      logger.info('Starting stdio MCP server...');
      const { SimpleStdioMcpServer } = await import('./mcp/simple-stdio-server');
      const stdioMcpServer = new SimpleStdioMcpServer();
      await stdioMcpServer.start();
      break;
      
    case 'setup-db':
      logger.info('Setting up database...');
      const setupDb = await import('./scripts/setup-db');
      break;
      
    default:
      console.log('Usage: npm run dev [api|mcp-http|mcp-stdio|setup-db]');
      console.log('');
      console.log('Commands:');
      console.log('  api        - Start REST API server');
      console.log('  mcp-http   - Start HTTP MCP server');
      console.log('  mcp-stdio  - Start stdio MCP server');
      console.log('  setup-db   - Setup database from CSV file');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Application failed to start:', error);
    process.exit(1);
  });
}