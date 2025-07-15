#!/usr/bin/env node

/**
 * ICO MCP HTTP Bridge
 * 
 * This bridge allows MCP clients to communicate with the ICO MCP HTTP server
 * using stdio protocol. It converts MCP stdio messages to HTTP requests and
 * forwards responses back to the client.
 * 
 * Usage:
 * 1. Start the ICO MCP HTTP server: npm run start:mcp-http
 * 2. Configure MCP client to use this bridge as stdio server: npm run start:http-bridge
 * 
 * HTTP Endpoints:
 * - POST /initialize - Initialize MCP connection
 * - POST /tools/list - List available tools
 * - POST /tools/call - Execute a tool
 * 
 * Environment variables:
 * - MCP_HTTP_SERVER_URL: HTTP server URL (default: http://localhost:3001)
 * - MCP_RECONNECT_DELAY: Retry delay in ms (default: 2000)
 * - MCP_MAX_RETRY_ATTEMPTS: Max retry attempts (default: 3)
 */

const axios = require('axios');
const readline = require('readline');

// Configuration
const SERVER_URL = process.env.MCP_HTTP_SERVER_URL || 'http://localhost:3001';
const RECONNECT_DELAY = parseInt(process.env.MCP_RECONNECT_DELAY || '2000');
const MAX_RETRY_ATTEMPTS = parseInt(process.env.MCP_MAX_RETRY_ATTEMPTS || '3');

// Connection state
let retryCount = 0;

// Create readline interface for stdin/stdout communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
  crlfDelay: Infinity
});

// HTTP client
const httpClient = axios.create({
  baseURL: SERVER_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Handle errors by sending JSON-RPC error response
function sendError(id, message, code = -32603) {
  const errorResponse = {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message
    }
  };
  console.log(JSON.stringify(errorResponse));
}

// Simple HTTP request with retry
async function makeHttpRequest(method, url, data = null) {
  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      let response;
      if (method === 'GET') {
        response = await httpClient.get(url);
      } else if (method === 'POST') {
        response = await httpClient.post(url, data);
      } else {
        throw new Error(`Unsupported HTTP method: ${method}`);
      }
      
      // Reset retry count on success
      retryCount = 0;
      return response;
    } catch (error) {
      // Silent error handling for MCP client compatibility
      
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = RECONNECT_DELAY * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw new Error(`Request failed after ${MAX_RETRY_ATTEMPTS + 1} attempts: ${error.message}`);
      }
    }
  }
}

// Process a single MCP request
async function processRequest(data) {
  // No stderr logging for MCP client compatibility
  let request;
  
  try {
    request = JSON.parse(data);
  } catch (error) {
    // Silent error handling for MCP client compatibility
    sendError(null, 'Invalid JSON');
    return;
  }

  const { id, method, params } = request;

  // Check if this is a notification (no id field)
  const isNotification = !('id' in request);

  try {
    // Handle notifications (no response required)
    if (isNotification) {
      switch (method) {
        case 'notifications/initialized':
          // Silent notification handling
          break;
        case 'notifications/cancelled':
          // Silent notification handling
          break;
        default:
          // Silent notification handling
          break;
      }
      return; // Don't send a response for notifications
    }

    // Handle requests (response required)
    switch (method) {
      case 'initialize':
        // Respond immediately to initialization
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'ico-mcp-http-bridge',
              version: '1.0.0'
            }
          }
        }));
        break;

      case 'tools/list':
        try {
          const response = await makeHttpRequest('POST', '/tools/list', {});
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: response.data
          }));
        } catch (error) {
          sendError(id, `Failed to get tools: ${error.message}`);
        }
        break;

      case 'tools/call':
        try {
          const { name, arguments: args } = params;
          const response = await makeHttpRequest('POST', '/tools/call', { name, arguments: args });
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: response.data
          }));
        } catch (error) {
          sendError(id, `Tool execution failed: ${error.message}`);
        }
        break;

      case 'resources/list':
        // Return empty resources list (same as stdio server)
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { resources: [] }
        }));
        break;

      case 'prompts/list':
        // Return empty prompts list (same as stdio server)
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { prompts: [] }
        }));
        break;

      case 'bridge/status':
        // Get connection status
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            server_url: SERVER_URL,
            retry_count: retryCount,
            max_retries: MAX_RETRY_ATTEMPTS,
            reconnect_delay: RECONNECT_DELAY
          }
        }));
        break;

      default:
        sendError(id, `Unknown method: ${method}`, -32601);
        break;
    }
  } catch (error) {
    sendError(id, `Request processing failed: ${error.message}`);
  }
}

// Main execution
async function main() {
  // Silent startup for MCP client compatibility

  // Process requests line by line
  rl.on('line', async (line) => {
    if (line.trim()) {
      await processRequest(line.trim());
    }
  });
  
  // Handle graceful shutdown
  rl.on('close', () => {
    setTimeout(() => process.exit(0), 100);
  });
  
  process.on('SIGINT', () => {
    rl.close();
  });
  
  process.on('SIGTERM', () => {
    rl.close();
  });
  
  // Bridge is ready - no logging to stdout in stdio mode
}

// Start the bridge
main().catch(error => {
  // Only fatal errors to stderr
  process.stderr.write(`Fatal error: ${error.message}\n`);
  process.exit(1);
});