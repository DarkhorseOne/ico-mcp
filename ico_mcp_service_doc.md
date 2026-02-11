# ICO数据库查询MCP服务开发文档

## 项目概述

本项目旨在开发一个查询ICO（Information Commissioner's Office）数据库的MCP（Model Context Protocol）服务，提供传统的REST API服务以及完善的MCP服务支持。

### 技术栈
- **数据库**: SQLite
- **开发语言**: TypeScript
- **运行时**: Node.js
- **部署**: Docker + Docker Compose

### 主要功能
1. 传统REST API服务
2. HTTP模式MCP服务
3. stdio模式MCP服务
4. 定期数据更新脚本
5. Docker化部署

## 项目结构

```
ico-mcp-service/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   └── ico.ts
│   │   └── server.ts
│   ├── mcp/
│   │   ├── http-server.ts
│   │   ├── stdio-server.ts
│   │   └── tools.ts
│   ├── services/
│   │   ├── database.ts
│   │   └── ico-service.ts
│   ├── types/
│   │   └── ico.ts
│   └── utils/
│       └── logger.ts
├── scripts/
│   ├── download-data.ts
│   └── setup-db.ts
├── data/
│   └── ico.db
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

## 数据库设计

### ICO注册表 (ico_registrations)

```sql
CREATE TABLE ico_registrations (
    registration_number TEXT PRIMARY KEY,
    organisation_name TEXT NOT NULL,
    organisation_address_line_1 TEXT,
    organisation_address_line_2 TEXT,
    organisation_address_line_3 TEXT,
    organisation_address_line_4 TEXT,
    organisation_address_line_5 TEXT,
    organisation_postcode TEXT,
    public_authority TEXT,
    start_date_of_registration DATE,
    end_date_of_registration DATE,
    trading_names TEXT,
    payment_tier TEXT,
    dpo_title TEXT,
    dpo_first_name TEXT,
    dpo_last_name TEXT,
    dpo_organisation TEXT,
    dpo_email TEXT,
    dpo_phone TEXT,
    dpo_address_line_1 TEXT,
    dpo_address_line_2 TEXT,
    dpo_address_line_3 TEXT,
    dpo_address_line_4 TEXT,
    dpo_address_line_5 TEXT,
    dpo_postcode TEXT,
    public_register_entry_url TEXT
);

CREATE INDEX idx_organisation_name ON ico_registrations(organisation_name);
CREATE INDEX idx_registration_number ON ico_registrations(registration_number);
CREATE INDEX idx_postcode ON ico_registrations(organisation_postcode);
CREATE INDEX idx_end_date ON ico_registrations(end_date_of_registration);
```

### 数据版本表 (data_versions)

```sql
CREATE TABLE data_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    download_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_sha256 TEXT NOT NULL UNIQUE,
    file_size INTEGER,
    record_count INTEGER,
    download_url TEXT,
    status TEXT DEFAULT 'active', -- active, archived
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_download_date ON data_versions(download_date);
CREATE INDEX idx_sha256 ON data_versions(file_sha256);
CREATE INDEX idx_status ON data_versions(status);
```

## 核心代码实现

### 1. 数据类型定义 (src/types/ico.ts)

```typescript
export interface IcoRegistration {
  registrationNumber: string;
  organisationName: string;
  organisationAddressLine1?: string;
  organisationAddressLine2?: string;
  organisationAddressLine3?: string;
  organisationAddressLine4?: string;
  organisationAddressLine5?: string;
  organisationPostcode?: string;
  publicAuthority: string;
  startDateOfRegistration: string;
  endDateOfRegistration: string;
  tradingNames?: string;
  paymentTier: string;
  dpoTitle?: string;
  dpoFirstName?: string;
  dpoLastName?: string;
  dpoOrganisation?: string;
  dpoEmail?: string;
  dpoPhone?: string;
  dpoAddressLine1?: string;
  dpoAddressLine2?: string;
  dpoAddressLine3?: string;
  dpoAddressLine4?: string;
  dpoAddressLine5?: string;
  dpoPostcode?: string;
  publicRegisterEntryUrl?: string;
}

export interface SearchQuery {
  organisationName?: string;
  registrationNumber?: string;
  postcode?: string;
  publicAuthority?: string;
  paymentTier?: string;
  limit?: number;
  offset?: number;
}

export interface DataVersion {
  id: number;
  downloadDate: string;
  fileSha256: string;
  fileSize: number;
  recordCount: number;
  downloadUrl: string;
  status: 'active' | 'archived';
  createdAt: string;
}

export interface DataUpdateResult {
  updated: boolean;
  currentVersion: DataVersion;
  message: string;
}
```

### 2. 数据库服务 (src/services/database.ts)

```typescript
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import { IcoRegistration, DataVersion } from '../types/ico';

export class DatabaseService {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
  private dbPath: string = '';

  async initialize(dbPath: string = './data/ico.db') {
    this.dbPath = dbPath;
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await this.createTables();
  }

  private async createTables() {
    if (!this.db) throw new Error('Database not initialized');

    // Create ICO registrations table
    const createIcoTableQuery = `
      CREATE TABLE IF NOT EXISTS ico_registrations (
        registration_number TEXT PRIMARY KEY,
        organisation_name TEXT NOT NULL,
        organisation_address_line_1 TEXT,
        organisation_address_line_2 TEXT,
        organisation_address_line_3 TEXT,
        organisation_address_line_4 TEXT,
        organisation_address_line_5 TEXT,
        organisation_postcode TEXT,
        public_authority TEXT,
        start_date_of_registration DATE,
        end_date_of_registration DATE,
        trading_names TEXT,
        payment_tier TEXT,
        dpo_title TEXT,
        dpo_first_name TEXT,
        dpo_last_name TEXT,
        dpo_organisation TEXT,
        dpo_email TEXT,
        dpo_phone TEXT,
        dpo_address_line_1 TEXT,
        dpo_address_line_2 TEXT,
        dpo_address_line_3 TEXT,
        dpo_address_line_4 TEXT,
        dpo_address_line_5 TEXT,
        dpo_postcode TEXT,
        public_register_entry_url TEXT
      );
    `;

    // Create data versions table
    const createVersionTableQuery = `
      CREATE TABLE IF NOT EXISTS data_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        download_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        file_sha256 TEXT NOT NULL UNIQUE,
        file_size INTEGER,
        record_count INTEGER,
        download_url TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await this.db.exec(createIcoTableQuery);
    await this.db.exec(createVersionTableQuery);
    await this.createIndexes();
  }

  private async createIndexes() {
    if (!this.db) return;

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_organisation_name ON ico_registrations(organisation_name)',
      'CREATE INDEX IF NOT EXISTS idx_registration_number ON ico_registrations(registration_number)',
      'CREATE INDEX IF NOT EXISTS idx_postcode ON ico_registrations(organisation_postcode)',
      'CREATE INDEX IF NOT EXISTS idx_end_date ON ico_registrations(end_date_of_registration)',
      'CREATE INDEX IF NOT EXISTS idx_download_date ON data_versions(download_date)',
      'CREATE INDEX IF NOT EXISTS idx_sha256 ON data_versions(file_sha256)',
      'CREATE INDEX IF NOT EXISTS idx_status ON data_versions(status)'
    ];

    for (const index of indexes) {
      await this.db.exec(index);
    }
  }

  async insertRegistration(registration: IcoRegistration): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const query = `
      INSERT OR REPLACE INTO ico_registrations 
      (registration_number, organisation_name, organisation_address_line_1, 
       organisation_address_line_2, organisation_address_line_3, organisation_address_line_4,
       organisation_address_line_5, organisation_postcode, public_authority,
       start_date_of_registration, end_date_of_registration, trading_names,
       payment_tier, dpo_title, dpo_first_name, dpo_last_name, dpo_organisation,
       dpo_email, dpo_phone, dpo_address_line_1, dpo_address_line_2,
       dpo_address_line_3, dpo_address_line_4, dpo_address_line_5,
       dpo_postcode, public_register_entry_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      registration.registrationNumber,
      registration.organisationName,
      registration.organisationAddressLine1,
      registration.organisationAddressLine2,
      registration.organisationAddressLine3,
      registration.organisationAddressLine4,
      registration.organisationAddressLine5,
      registration.organisationPostcode,
      registration.publicAuthority,
      registration.startDateOfRegistration,
      registration.endDateOfRegistration,
      registration.tradingNames,
      registration.paymentTier,
      registration.dpoTitle,
      registration.dpoFirstName,
      registration.dpoLastName,
      registration.dpoOrganisation,
      registration.dpoEmail,
      registration.dpoPhone,
      registration.dpoAddressLine1,
      registration.dpoAddressLine2,
      registration.dpoAddressLine3,
      registration.dpoAddressLine4,
      registration.dpoAddressLine5,
      registration.dpoPostcode,
      registration.publicRegisterEntryUrl
    ]);
  }

  async clearRegistrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.run('DELETE FROM ico_registrations');
  }

  async getRecordCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.get('SELECT COUNT(*) as count FROM ico_registrations');
    return result.count;
  }

  async searchRegistrations(query: SearchQuery): Promise<IcoRegistration[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM ico_registrations WHERE 1=1';
    const params: any[] = [];

    if (query.organisationName) {
      sql += ' AND organisation_name LIKE ?';
      params.push(`%${query.organisationName}%`);
    }

    if (query.registrationNumber) {
      sql += ' AND registration_number = ?';
      params.push(query.registrationNumber);
    }

    if (query.postcode) {
      sql += ' AND organisation_postcode LIKE ?';
      params.push(`%${query.postcode}%`);
    }

    if (query.publicAuthority) {
      sql += ' AND public_authority = ?';
      params.push(query.publicAuthority);
    }

    if (query.paymentTier) {
      sql += ' AND payment_tier = ?';
      params.push(query.paymentTier);
    }

    sql += ' ORDER BY organisation_name';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    if (query.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }

    const rows = await this.db.all(sql, params);
    return rows.map(this.mapRowToRegistration);
  }

  // Data version management methods
  async insertDataVersion(version: Omit<DataVersion, 'id' | 'createdAt'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    // Mark all previous versions as archived
    await this.db.run("UPDATE data_versions SET status = 'archived'");

    const result = await this.db.run(`
      INSERT INTO data_versions (download_date, file_sha256, file_size, record_count, download_url, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `, [
      version.downloadDate,
      version.fileSha256,
      version.fileSize,
      version.recordCount,
      version.downloadUrl
    ]);

    return result.lastID!;
  }

  async getCurrentDataVersion(): Promise<DataVersion | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get("SELECT * FROM data_versions WHERE status = 'active' ORDER BY download_date DESC LIMIT 1");
    return row ? this.mapRowToDataVersion(row) : null;
  }

  async getLatestFileSha256(): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get("SELECT file_sha256 FROM data_versions WHERE status = 'active' ORDER BY download_date DESC LIMIT 1");
    return row ? row.file_sha256 : null;
  }

  async getAllDataVersions(): Promise<DataVersion[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.all("SELECT * FROM data_versions ORDER BY download_date DESC");
    return rows.map(this.mapRowToDataVersion);
  }

  private mapRowToRegistration(row: any): IcoRegistration {
    return {
      registrationNumber: row.registration_number,
      organisationName: row.organisation_name,
      organisationAddressLine1: row.organisation_address_line_1,
      organisationAddressLine2: row.organisation_address_line_2,
      organisationAddressLine3: row.organisation_address_line_3,
      organisationAddressLine4: row.organisation_address_line_4,
      organisationAddressLine5: row.organisation_address_line_5,
      organisationPostcode: row.organisation_postcode,
      publicAuthority: row.public_authority,
      startDateOfRegistration: row.start_date_of_registration,
      endDateOfRegistration: row.end_date_of_registration,
      tradingNames: row.trading_names,
      paymentTier: row.payment_tier,
      dpoTitle: row.dpo_title,
      dpoFirstName: row.dpo_first_name,
      dpoLastName: row.dpo_last_name,
      dpoOrganisation: row.dpo_organisation,
      dpoEmail: row.dpo_email,
      dpoPhone: row.dpo_phone,
      dpoAddressLine1: row.dpo_address_line_1,
      dpoAddressLine2: row.dpo_address_line_2,
      dpoAddressLine3: row.dpo_address_line_3,
      dpoAddressLine4: row.dpo_address_line_4,
      dpoAddressLine5: row.dpo_address_line_5,
      dpoPostcode: row.dpo_postcode,
      publicRegisterEntryUrl: row.public_register_entry_url
    };
  }

  private mapRowToDataVersion(row: any): DataVersion {
    return {
      id: row.id,
      downloadDate: row.download_date,
      fileSha256: row.file_sha256,
      fileSize: row.file_size,
      recordCount: row.record_count,
      downloadUrl: row.download_url,
      status: row.status,
      createdAt: row.created_at
    };
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }

  getDbPath(): string {
    return this.dbPath;
  }
}
```

### 3. ICO服务 (src/services/ico-service.ts)

```typescript
import { DatabaseService } from './database';
import { IcoRegistration, SearchQuery, DataVersion } from '../types/ico';

export class IcoService {
  constructor(private db: DatabaseService) {}

  async searchRegistrations(query: SearchQuery): Promise<IcoRegistration[]> {
    return await this.db.searchRegistrations(query);
  }

  async getRegistrationByNumber(registrationNumber: string): Promise<IcoRegistration | null> {
    const results = await this.db.searchRegistrations({ registrationNumber });
    return results.length > 0 ? results[0] : null;
  }

  async getRegistrationsByOrganisation(organisationName: string, limit: number = 10): Promise<IcoRegistration[]> {
    return await this.db.searchRegistrations({ organisationName, limit });
  }

  async getRegistrationsByPostcode(postcode: string, limit: number = 10): Promise<IcoRegistration[]> {
    return await this.db.searchRegistrations({ postcode, limit });
  }

  async getActiveRegistrations(limit: number = 100): Promise<IcoRegistration[]> {
    // Get registrations that haven't expired
    const today = new Date().toISOString().split('T')[0];
    return await this.db.searchRegistrations({ limit });
  }

  // Data version related methods
  async getCurrentDataVersion(): Promise<DataVersion | null> {
    return await this.db.getCurrentDataVersion();
  }

  async getAllDataVersions(): Promise<DataVersion[]> {
    return await this.db.getAllDataVersions();
  }

  async getDataStats(): Promise<{ recordCount: number; currentVersion: DataVersion | null }> {
    const recordCount = await this.db.getRecordCount();
    const currentVersion = await this.db.getCurrentDataVersion();
    
    return {
      recordCount,
      currentVersion
    };
  }
}
``` limit });
  }

  async getActiveRegistrations(limit: number = 100): Promise<IcoRegistration[]> {
    // Get registrations that haven't expired
    const today = new Date().toISOString().split('T')[0];
    return await this.db.searchRegistrations({ limit });
  }
}
```

### 4. REST API服务 (src/api/server.ts)

```typescript
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

  async start(port: number = 26002, dbPath?: string) {
    await this.db.initialize(dbPath);
    
    this.app.listen(port, () => {
      logger.info(`API server listening on port ${port}`);
    });
  }

  async stop() {
    await this.db.close();
  }
}
```

### 5. REST API路由 (src/api/routes/ico.ts)

```typescript
import { Router } from 'express';
import { IcoService } from '../../services/ico-service';
import { SearchQuery } from '../../types/ico';

export default function icoRoutes(icoService: IcoService) {
  const router = Router();

  // 搜索注册记录
  router.get('/search', async (req, res) => {
    try {
      const query: SearchQuery = {
        organisationName: req.query.organisationName as string,
        registrationNumber: req.query.registrationNumber as string,
        postcode: req.query.postcode as string,
        publicAuthority: req.query.publicAuthority as string,
        paymentTier: req.query.paymentTier as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      const results = await icoService.searchRegistrations(query);
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 根据注册号获取记录
  router.get('/:registrationNumber', async (req, res) => {
    try {
      const registration = await icoService.getRegistrationByNumber(req.params.registrationNumber);
      if (!registration) {
        return res.status(404).json({
          success: false,
          error: 'Registration not found'
        });
      }

      res.json({
        success: true,
        data: registration
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 根据组织名称搜索
  router.get('/organisation/:name', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const results = await icoService.getRegistrationsByOrganisation(req.params.name, limit);
      
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 根据邮编搜索
  router.get('/postcode/:postcode', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const results = await icoService.getRegistrationsByPostcode(req.params.postcode, limit);
      
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
```

### 6. MCP工具定义 (src/mcp/tools.ts)

```typescript
export const MCP_TOOLS = [
  {
    name: "search_ico_registrations",
    description: "Search ICO registrations by various criteria",
    inputSchema: {
      type: "object",
      properties: {
        organisationName: {
          type: "string",
          description: "Organisation name to search for (partial match)"
        },
        registrationNumber: {
          type: "string",
          description: "Exact registration number"
        },
        postcode: {
          type: "string",
          description: "Postcode to search for (partial match)"
        },
        publicAuthority: {
          type: "string",
          description: "Whether it's a public authority (Y/N)"
        },
        paymentTier: {
          type: "string",
          description: "Payment tier (e.g., 'Tier 1', 'Tier 2')"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10
        },
        offset: {
          type: "number",
          description: "Number of results to skip",
          default: 0
        }
      }
    }
  },
  {
    name: "get_ico_registration",
    description: "Get a specific ICO registration by registration number",
    inputSchema: {
      type: "object",
      properties: {
        registrationNumber: {
          type: "string",
          description: "The registration number to look up"
        }
      },
      required: ["registrationNumber"]
    }
  },
  {
    name: "get_registrations_by_organisation",
    description: "Get ICO registrations for a specific organisation",
    inputSchema: {
      type: "object",
      properties: {
        organisationName: {
          type: "string",
          description: "Name of the organisation"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10
        }
      },
      required: ["organisationName"]
    }
  },
  {
    name: "get_registrations_by_postcode",
    description: "Get ICO registrations for a specific postcode area",
    inputSchema: {
      type: "object",
      properties: {
        postcode: {
          type: "string",
          description: "Postcode to search for"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10
        }
      },
      required: ["postcode"]
    }
  }
];
```

### 7. HTTP模式MCP服务器 (src/mcp/http-server.ts)

```typescript
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
    // MCP protocol endpoints
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
          message: error.message
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
```

### 8. stdio模式MCP服务器 (src/mcp/stdio-server.ts)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DatabaseService } from '../services/database';
import { IcoService } from '../services/ico-service';
import { MCP_TOOLS } from './tools';
import { logger } from '../utils/logger';

export class StdioMcpServer {
  private server: Server;
  private db: DatabaseService;
  private icoService: IcoService;

  constructor() {
    this.server = new Server(
      {
        name: "ico-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.db = new DatabaseService();
    this.icoService = new IcoService(this.db);
    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler('tools/list', async () => {
      return { tools: MCP_TOOLS };
    });

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

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
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        logger.error('Tool call error:', error);
        throw error;
      }
    });
  }

  async start(dbPath?: string) {
    await this.db.initialize(dbPath);
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    logger.info('stdio MCP server started');
  }

  async stop() {
    await this.db.close();
  }
}
```

### 10. REST API路由更新 (src/api/routes/ico.ts)

```typescript
import { Router } from 'express';
import { IcoService } from '../../services/ico-service';
import { SearchQuery } from '../../types/ico';

export default function icoRoutes(icoService: IcoService) {
  const router = Router();

  // 搜索注册记录
  router.get('/search', async (req, res) => {
    try {
      const query: SearchQuery = {
        organisationName: req.query.organisationName as string,
        registrationNumber: req.query.registrationNumber as string,
        postcode: req.query.postcode as string,
        publicAuthority: req.query.publicAuthority as string,
        paymentTier: req.query.paymentTier as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      const results = await icoService.searchRegistrations(query);
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 根据注册号获取记录
  router.get('/:registrationNumber', async (req, res) => {
    try {
      const registration = await icoService.getRegistrationByNumber(req.params.registrationNumber);
      if (!registration) {
        return res.status(404).json({
          success: false,
          error: 'Registration not found'
        });
      }

      res.json({
        success: true,
        data: registration
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 根据组织名称搜索
  router.get('/organisation/:name', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const results = await icoService.getRegistrationsByOrganisation(req.params.name, limit);
      
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 根据邮编搜索
  router.get('/postcode/:postcode', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const results = await icoService.getRegistrationsByPostcode(req.params.postcode, limit);
      
      res.json({
        success: true,
        data: results,
        count: results.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 获取数据版本信息
  router.get('/meta/version', async (req, res) => {
    try {
      const currentVersion = await icoService.getCurrentDataVersion();
      const stats = await icoService.getDataStats();
      
      res.json({
        success: true,
        data: {
          currentVersion,
          recordCount: stats.recordCount
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // 获取所有数据版本历史
  router.get('/meta/versions', async (req, res) => {
    try {
      const versions = await icoService.getAllDataVersions();
      
      res.json({
        success: true,
        data: versions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
```

### 11. 自动重载服务 (src/services/reload-service.ts)

```typescript
import { EventEmitter } from 'events';
import { DatabaseService } from './database';
import { IcoService } from './ico-service';
import { DataDownloader } from '../../scripts/download-data';
import { logger } from '../utils/logger';

export class ReloadService extends EventEmitter {
  private db: DatabaseService;
  private icoService: IcoService;
  private downloader: DataDownloader;
  private isReloading: boolean = false;

  constructor() {
    super();
    this.db = new DatabaseService();
    this.icoService = new IcoService(this.db);
    this.downloader = new DataDownloader();
  }

  async initialize(dbPath?: string) {
    await this.db.initialize(dbPath);
  }

  async checkAndReload(): Promise<void> {
    if (this.isReloading) {
      logger.info('Reload already in progress, skipping...');
      return;
    }

    try {
      this.isReloading = true;
      this.emit('reloadStart');
      
      logger.info('Checking for data updates...');
      const result = await this.downloader.checkAndUpdateData();
      
      if (result.updated) {
        logger.info('Data was updated, reloading database connection...');
        
        // Close current database connection
        await this.db.close();
        
        // Reinitialize with the new database
        await this.db.initialize();
        
        this.emit('reloadComplete', result);
        logger.info('Database reload completed successfully');
      } else {
        this.emit('reloadSkipped', result);
        logger.info('No update needed, skipping reload');
      }
    } catch (error) {
      logger.error('Error during reload:', error);
      this.emit('reloadError', error);
      throw error;
    } finally {
      this.isReloading = false;
    }
  }

  getIcoService(): IcoService {
    return this.icoService;
  }

  async close() {
    await this.db.close();
  }
}
```

### 12. 更新MCP工具定义 (src/mcp/tools.ts)

```typescript
export const MCP_TOOLS = [
  {
    name: "search_ico_registrations",
    description: "Search ICO registrations by various criteria",
    inputSchema: {
      type: "object",
      properties: {
        organisationName: {
          type: "string",
          description: "Organisation name to search for (partial match)"
        },
        registrationNumber: {
          type: "string",
          description: "Exact registration number"
        },
        postcode: {
          type: "string",
          description: "Postcode to search for (partial match)"
        },
        publicAuthority: {
          type: "string",
          description: "Whether it's a public authority (Y/N)"
        },
        paymentTier: {
          type: "string",
          description: "Payment tier (e.g., 'Tier 1', 'Tier 2')"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10
        },
        offset: {
          type: "number",
          description: "Number of results to skip",
          default: 0
        }
      }
    }
  },
  {
    name: "get_ico_registration",
    description: "Get a specific ICO registration by registration number",
    inputSchema: {
      type: "object",
      properties: {
        registrationNumber: {
          type: "string",
          description: "The registration number to look up"
        }
      },
      required: ["registrationNumber"]
    }
  },
  {
    name: "get_registrations_by_organisation",
    description: "Get ICO registrations for a specific organisation",
    inputSchema: {
      type: "object",
      properties: {
        organisationName: {
          type: "string",
          description: "Name of the organisation"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10
        }
      },
      required: ["organisationName"]
    }
  },
  {
    name: "get_registrations_by_postcode",
    description: "Get ICO registrations for a specific postcode area",
    inputSchema: {
      type: "object",
      properties: {
        postcode: {
          type: "string",
          description: "Postcode to search for"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10
        }
      },
      required: ["postcode"]
    }
  },
  {
    name: "get_data_version",
    description: "Get current data version and statistics",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "get_all_data_versions",
    description: "Get all data version history",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];
```

### 13. 定时任务脚本 (scripts/cron-update.ts)

```typescript
#!/usr/bin/env node

import { DataDownloader } from './download-data';
import { logger } from '../src/utils/logger';

async function cronUpdate() {
  const downloader = new DataDownloader();
  
  try {
    logger.info('=== Starting scheduled data update ===');
    const result = await downloader.checkAndUpdateData();
    
    if (result.updated) {
      logger.info(`Data successfully updated: ${result.message}`);
      
      // 可以在这里添加通知逻辑，比如发送邮件或Slack消息
      // await sendNotification(`ICO data updated: ${result.message}`);
    } else {
      logger.info('No update needed');
    }
    
    logger.info('=== Scheduled update completed ===');
    process.exit(0);
  } catch (error) {
    logger.error('Scheduled update failed:', error);
    
    // 可以在这里添加错误通知逻辑
    // await sendErrorNotification(`ICO data update failed: ${error.message}`);
    
    process.exit(1);
  }
}

// Run the update
cronUpdate();
```

### 14. package.json

```json
{
  "name": "ico-mcp-service",
  "version": "1.0.0",
  "description": "ICO Database Query MCP Service",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "start:api": "node dist/api/server.js",
    "start:mcp-http": "node dist/mcp/http-server.js",
    "start:mcp-stdio": "node dist/mcp/stdio-server.js",
    "dev": "ts-node src/index.ts",
    "dev:api": "ts-node src/api/server.ts",
    "dev:mcp-http": "ts-node src/mcp/http-server.ts",
    "dev:mcp-stdio": "ts-node src/mcp/stdio-server.ts",
    "download-data": "ts-node scripts/download-data.ts",
    "cron-update": "ts-node scripts/cron-update.ts",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.4.0",
    "express": "^4.18.2",
    "sqlite": "^5.1.1",
    "sqlite3": "^5.1.6",
    "csv-parser": "^3.0.0",
    "cors": "^2.8.5",
    "adm-zip": "^0.5.10",
    "jsdom": "^23.0.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/cors": "^2.8.17",
    "@types/csv-parser": "^1.4.0",
    "@types/adm-zip": "^0.5.5",
    "@types/jsdom": "^21.1.6",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.8",
    "eslint": "^8.54.0",
    "@typescript-eslint/eslint-plugin": "^6.12.0",
    "@typescript-eslint/parser": "^6.12.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 15. Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create data directory
RUN mkdir -p /app/data /app/temp

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S ico -u 1001
RUN chown -R ico:nodejs /app
USER ico

# Expose ports
EXPOSE 26002 3001

# Default command
CMD ["npm", "start"]
```

### 16. docker-compose.yml

```yaml
version: '3.8'

services:
  ico-api:
    build: .
    container_name: ico-api-server
    ports:
      - "26002:26002"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/ico.db
      - LOG_LEVEL=info
    restart: unless-stopped
    command: npm run start:api

  ico-mcp-http:
    build: .
    container_name: ico-mcp-http-server
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/ico.db
      - LOG_LEVEL=info
    restart: unless-stopped
    command: npm run start:mcp-http

  ico-cron:
    build: .
    container_name: ico-cron-updater
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/ico.db
      - LOG_LEVEL=info
    restart: unless-stopped
    command: >
      sh -c "
        # Install cron
        apk add --no-cache dcron &&
        # Add cron job (every day at 2 AM)
        echo '0 2 * * * cd /app && npm run cron-update' | crontab - &&
        # Start cron daemon
        crond -f
      "

volumes:
  data:
    driver: local
  logs:
    driver: local
```

### 17. crontab 配置示例

如果不使用Docker，可以在系统中设置crontab：

```bash
# 每天凌晨2点执行数据更新
0 2 * * * cd /path/to/ico-mcp-service && npm run cron-update >> /var/log/ico-update.log 2>&1

# 每6小时检查一次更新
0 */6 * * * cd /path/to/ico-mcp-service && npm run cron-update >> /var/log/ico-update.log 2>&1
```

### 18. 日志工具 (src/utils/logger.ts)

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ico-mcp-service' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

## 部署和使用

### 初始化项目

```bash
# 克隆项目
git clone <repository-url>
cd ico-mcp-service

# 安装依赖
npm install

# 构建项目
npm run build

# 初始下载数据
npm run download-data
```

### Docker部署

```bash
# 构建和启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### API使用示例

```bash
# 搜索组织
curl "http://localhost:26002/api/ico/search?organisationName=Microsoft&limit=5"

# 获取特定注册
curl "http://localhost:26002/api/ico/ZA081798"

# 获取数据版本信息
curl "http://localhost:26002/api/ico/meta/version"
```

### MCP客户端配置

```json
{
  "mcpServers": {
    "ico": {
      "command": "node",
      "args": ["dist/mcp/stdio-server.js"],
      "cwd": "/path/to/ico-mcp-service"
    }
  }
}
```

## 注意事项

1. **数据库文件外挂**: 数据库文件通过Docker volume外挂，确保数据持久化
2. **定时更新**: 通过cron定时检查数据更新，避免频繁下载
3. **SHA256校验**: 只有在文件真正更新时才重新下载和处理
4. **错误处理**: 完善的错误处理和日志记录
5. **性能优化**: 批量插入数据，建立合适的索引
6. **API限流**: 生产环境建议添加API限流和认证机制

这个服务提供了完整的ICO数据查询功能，支持多种部署模式和使用方式，能够自动保持数据最新状态。.main === module) {
  main();
}
``` IcoRegistration } from '../src/types/ico';
import { logger } from '../src/utils/logger';

const ICO_DATA_URL = 'https://ico.org.uk/media/action/download_dataset/data-protection-register-live.csv';

export class DataDownloader {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  async downloadAndUpdateData() {
    try {
      logger.info('Starting data download...');
      
      // Initialize database
      await this.db.initialize();
      
      // Download CSV data
      const csvData = await this.downloadCsvData();
      
      // Parse and import data
      await this.parseAndImportData(csvData);
      
      logger.info('Data update completed successfully');
    } catch (error) {
      logger.error('Error during data update:', error);
      throw error;
    } finally {
      await this.db.close();
    }
  }

  private async downloadCsvData(): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      
      https.get(ICO_DATA_URL, (response) => {
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve(data);
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  private async parseAndImportData(csvData: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const records: IcoRegistration[] = [];
      
      const stream = require('stream');
      const readable = new stream.Readable();
      readable.push(csvData);
      readable.push(null);

      readable
        .pipe(csv())
        .on('data', (row: any) => {
          const registration: IcoRegistration = {
            registrationNumber: row.Registration_number,
            organisationName: row.Organisation_name,
            organisationAddressLine1: row.Organisation_address_line_1,
            organisationAddressLine2: row.Organisation_address_line_2,
            organisationAddressLine3: row.Organisation_address_line_3,
            organisationAddressLine4: row.Organisation_address_line_4,
            organisationAddressLine5: row.Organisation_address_line_5,
            organisationPostcode: row.Organisation_postcode,
            publicAuthority: row.Public_authority,
            startDateOfRegistration: row.Start_date_of_registration,
            endDateOfRegistration: row.End_date_of_registration,
            tradingNames: row.Trading_names,
            paymentTier: row.Payment_tier,
            dpoTitle: row.DPO_or_Person_responsible_for_DP_Title,
            dpoFirstName: