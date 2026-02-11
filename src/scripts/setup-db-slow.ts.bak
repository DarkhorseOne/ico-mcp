#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { Database } from 'sqlite3';
import { logger } from '../utils/logger';

// Fast CSV parsing function
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  result.push(current);
  return result;
}

// Get absolute paths relative to project root
const projectRoot = path.resolve(__dirname, '../..');
const CSV_FILE_PATH = path.join(projectRoot, 'register-of-data-controllers.csv');
const DB_PATH = path.join(projectRoot, 'data', 'ico.db');

async function setupDatabaseFast() {
  const startTime = Date.now();
  
  try {
    logger.info('Starting FAST database setup...');
    
    // Check if CSV file exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`CSV file not found: ${CSV_FILE_PATH}`);
    }
    
    // Get file stats for version tracking
    const stats = fs.statSync(CSV_FILE_PATH);
    logger.info(`Processing CSV file: ${CSV_FILE_PATH}`);
    logger.info(`File size: ${stats.size} bytes`);
    
    // Calculate SHA256 hash efficiently
    const hash = createHash('sha256');
    const stream = fs.createReadStream(CSV_FILE_PATH);
    
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });
    
    const fileSha256 = hash.digest('hex');
    logger.info(`File SHA256: ${fileSha256}`);
    
    // Initialize database connection
    const db = new Database(DB_PATH);
    
    // Create database tables if they don't exist
    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        // Create tables
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

        db.run(createIcoTableQuery);
        db.run(createVersionTableQuery);
        logger.info('Database tables created/verified');
        
        // Create indexes
        db.run('CREATE INDEX IF NOT EXISTS idx_organisation_name ON ico_registrations(organisation_name)');
        db.run('CREATE INDEX IF NOT EXISTS idx_registration_number ON ico_registrations(registration_number)');
        db.run('CREATE INDEX IF NOT EXISTS idx_postcode ON ico_registrations(organisation_postcode)');
        db.run('CREATE INDEX IF NOT EXISTS idx_end_date ON ico_registrations(end_date_of_registration)');
        db.run('CREATE INDEX IF NOT EXISTS idx_download_date ON data_versions(download_date)');
        db.run('CREATE INDEX IF NOT EXISTS idx_sha256 ON data_versions(file_sha256)');
        db.run('CREATE INDEX IF NOT EXISTS idx_status ON data_versions(status)');
        logger.info('Database indexes created/verified');
        
        // Performance optimizations
        db.run('PRAGMA journal_mode = WAL');
        db.run('PRAGMA synchronous = NORMAL');
        db.run('PRAGMA cache_size = 10000');
        db.run('PRAGMA temp_store = MEMORY');
        db.run('PRAGMA mmap_size = 268435456'); // 256MB
        logger.info('Database performance optimizations applied');
        
        // Clear existing data
        db.run('DELETE FROM ico_registrations', (err) => {
          if (err) reject(err);
          else {
            logger.info('Cleared existing registrations');
            resolve();
          }
        });
      });
    });
    
    // Read and parse CSV file line by line
    const fileContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const lines = fileContent.split('\n');
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }
    
    // Parse header to get column indices
    const headers = parseCSVLine(lines[0]);
    const columnMap = new Map<string, number>();
    
    headers.forEach((header, index) => {
      columnMap.set(header, index);
    });
    
    logger.info(`Found ${headers.length} columns in CSV`);
    
    // Prepare batch insert statement
    const insertQuery = `
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
    
    const stmt = db.prepare(insertQuery);
    
    // Process records in batches within a transaction
    const BATCH_SIZE = 1000;
    let recordCount = 0;
    let batchCount = 0;
    let skippedRecords = 0;
    let batchIndex = 0;
    
    const processRecords = async () => {
      return new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          try {
            // Process lines (skip header)
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              
              const values = parseCSVLine(line);
              
              // Extract values using column map
              const getField = (fieldName: string) => {
                const index = columnMap.get(fieldName);
                return index !== undefined ? values[index] || '' : '';
              };
              
              const registrationNumber = getField('Registration_number');
              const organisationName = getField('Organisation_name');
              
              // Skip records without required fields
              if (!registrationNumber || !organisationName) {
                skippedRecords++;
                if (skippedRecords <= 5) {
                  logger.warn(`Skipped line ${i}: reg="${registrationNumber}", org="${organisationName}"`);
                }
                continue;
              }
              
              // Insert record
              stmt.run([
                registrationNumber,
                organisationName,
                getField('Organisation_address_line_1'),
                getField('Organisation_address_line_2'),
                getField('Organisation_address_line_3'),
                getField('Organisation_address_line_4'),
                getField('Organisation_address_line_5'),
                getField('Organisation_postcode'),
                getField('Public_authority'),
                getField('Start_date_of_registration'),
                getField('End_date_of_registration'),
                getField('Trading_names'),
                getField('Payment_tier'),
                getField('DPO_or_Person_responsible_for_DP_Title'),
                getField('DPO_or_Person_responsible_for_DP_First_name'),
                getField('DPO_or_Person_responsible_for_DP_Last_name'),
                getField('DPO_or_Person_responsible_for_DP_Organisation'),
                getField('DPO_or_Person_responsible_for_DP_Email'),
                getField('DPO_or_Person_responsible_for_DP_Phone'),
                getField('DPO_or_Person_responsible_for_DP_Address_line_1'),
                getField('DPO_or_Person_responsible_for_DP_Address_line_2'),
                getField('DPO_or_Person_responsible_for_DP_Address_line_3'),
                getField('DPO_or_Person_responsible_for_DP_Address_line_4'),
                getField('DPO_or_Person_responsible_for_DP_Address_line_5'),
                getField('DPO_or_Person_responsible_for_DP_Postcode'),
                getField('Public_register_entry_URL')
              ]);
              
              recordCount++;
              batchCount++;
              
              // Progress logging
              if (recordCount % 10000 === 0) {
                logger.info(`Processed ${recordCount} records...`);
              }
              
              // Commit batch and start new transaction
              if (batchCount >= BATCH_SIZE) {
                db.run('COMMIT');
                logger.info(`Committed batch of ${BATCH_SIZE} records (batch ${batchIndex})`);
                batchIndex++;
                db.run('BEGIN TRANSACTION');
                batchCount = 0;
              }
            }
            
            // Commit final batch
            db.run('COMMIT', (err) => {
              if (err) {
                reject(err);
              } else {
                logger.info(`Finished processing CSV. Total records: ${recordCount}`);
                logger.info(`Skipped records (missing required fields): ${skippedRecords}`);
                resolve();
              }
            });
            
          } catch (error) {
            db.run('ROLLBACK');
            reject(error);
          }
        });
      });
    };
    
    await processRecords();
    
    // Clean up prepared statement
    stmt.finalize();
    logger.info('Database import completed successfully');
    
    // Insert data version
    const versionQuery = `
      INSERT OR REPLACE INTO data_versions (download_date, file_sha256, file_size, record_count, download_url, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `;
    
    // Archive old versions
    await new Promise<void>((resolve, reject) => {
      db.run("UPDATE data_versions SET status = 'archived'", (err) => {
        if (err) reject(err);
        else {
          logger.info('Archived old data versions');
          resolve();
        }
      });
    });
    
    // Insert new version
    await new Promise<void>((resolve, reject) => {
      db.run(versionQuery, [
        new Date().toISOString(),
        fileSha256,
        stats.size,
        recordCount,
        'local-csv-file'
      ], function(err) {
        if (err) {
          logger.error('Error inserting data version:', err);
          reject(err);
        } else {
          logger.info(`Inserted data version with ID: ${this.lastID}`);
          resolve();
        }
      });
    });
    
    // Close database
    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    logger.info(`FAST database setup completed successfully!`);
    logger.info(`Total records imported: ${recordCount}`);
    logger.info(`Import time: ${duration} seconds`);
    logger.info(`Records per second: ${(recordCount / parseFloat(duration)).toFixed(0)}`);
    
  } catch (error) {
    logger.error('Error during FAST database setup:', error);
    throw error;
  }
}

async function main() {
  try {
    await setupDatabaseFast();
    process.exit(0);
  } catch (error) {
    logger.error('FAST setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}