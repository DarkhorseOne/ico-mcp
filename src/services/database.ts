import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { IcoRegistration, DataVersion, SearchQuery } from '../types/ico';

export class DatabaseService {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
  private dbPath: string = '';

  async initialize(dbPath?: string) {
    // Default to absolute path relative to project root
    if (!dbPath) {
      const projectRoot = path.resolve(__dirname, '../..');
      const dataDir = path.join(projectRoot, 'data');
      
      // Ensure data directory exists
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      dbPath = path.join(dataDir, 'ico.db');
    }
    this.dbPath = dbPath;
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await this.createTables();
  }

  private async createTables() {
    if (!this.db) throw new Error('Database not initialized');

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

  async insertDataVersion(version: Omit<DataVersion, 'id' | 'createdAt'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

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