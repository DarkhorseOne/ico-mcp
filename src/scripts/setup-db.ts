#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import crypto from 'crypto';
import { DatabaseService } from '../services/database';
import { IcoRegistration } from '../types/ico';
import { logger } from '../utils/logger';

// Get absolute paths relative to project root
const projectRoot = path.resolve(__dirname, '../..');
const CSV_FILE_PATH = path.join(projectRoot, 'register-of-data-controllers.csv');
const DB_PATH = path.join(projectRoot, 'data', 'ico.db');

async function setupDatabase() {
  const db = new DatabaseService();
  
  try {
    logger.info('Starting database setup...');
    
    // Initialize database
    await db.initialize(DB_PATH);
    logger.info('Database initialized');
    
    // Check if CSV file exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
      throw new Error(`CSV file not found: ${CSV_FILE_PATH}`);
    }
    
    // Get file stats for version tracking
    const stats = fs.statSync(CSV_FILE_PATH);
    const fileContent = fs.readFileSync(CSV_FILE_PATH);
    const fileSha256 = crypto.createHash('sha256').update(fileContent).digest('hex');
    
    logger.info(`Processing CSV file: ${CSV_FILE_PATH}`);
    logger.info(`File size: ${stats.size} bytes`);
    logger.info(`File SHA256: ${fileSha256}`);
    
    // Clear existing data
    await db.clearRegistrations();
    logger.info('Cleared existing registrations');
    
    // Parse and import CSV data
    let recordCount = 0;
    const records: IcoRegistration[] = [];
    
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row: any) => {
          try {
            const registration: IcoRegistration = {
              registrationNumber: row.Registration_number || '',
              organisationName: row.Organisation_name || '',
              organisationAddressLine1: row.Organisation_address_line_1 || '',
              organisationAddressLine2: row.Organisation_address_line_2 || '',
              organisationAddressLine3: row.Organisation_address_line_3 || '',
              organisationAddressLine4: row.Organisation_address_line_4 || '',
              organisationAddressLine5: row.Organisation_address_line_5 || '',
              organisationPostcode: row.Organisation_postcode || '',
              publicAuthority: row.Public_authority || '',
              startDateOfRegistration: row.Start_date_of_registration || '',
              endDateOfRegistration: row.End_date_of_registration || '',
              tradingNames: row.Trading_names || '',
              paymentTier: row.Payment_tier || '',
              dpoTitle: row.DPO_or_Person_responsible_for_DP_Title || '',
              dpoFirstName: row.DPO_or_Person_responsible_for_DP_First_name || '',
              dpoLastName: row.DPO_or_Person_responsible_for_DP_Last_name || '',
              dpoOrganisation: row.DPO_or_Person_responsible_for_DP_Organisation || '',
              dpoEmail: row.DPO_or_Person_responsible_for_DP_Email || '',
              dpoPhone: row.DPO_or_Person_responsible_for_DP_Phone || '',
              dpoAddressLine1: row.DPO_or_Person_responsible_for_DP_Address_line_1 || '',
              dpoAddressLine2: row.DPO_or_Person_responsible_for_DP_Address_line_2 || '',
              dpoAddressLine3: row.DPO_or_Person_responsible_for_DP_Address_line_3 || '',
              dpoAddressLine4: row.DPO_or_Person_responsible_for_DP_Address_line_4 || '',
              dpoAddressLine5: row.DPO_or_Person_responsible_for_DP_Address_line_5 || '',
              dpoPostcode: row.DPO_or_Person_responsible_for_DP_Postcode || '',
              publicRegisterEntryUrl: row.Public_register_entry_URL || ''
            };
            
            if (registration.registrationNumber && registration.organisationName) {
              records.push(registration);
              recordCount++;
              
              if (recordCount % 1000 === 0) {
                logger.info(`Processed ${recordCount} records...`);
              }
            }
          } catch (error) {
            logger.error('Error processing row:', error);
          }
        })
        .on('end', () => {
          logger.info(`Finished reading CSV. Total records: ${recordCount}`);
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });
    
    // Batch insert records
    logger.info('Starting database import...');
    for (let i = 0; i < records.length; i++) {
      await db.insertRegistration(records[i]);
      
      if ((i + 1) % 1000 === 0) {
        logger.info(`Imported ${i + 1}/${records.length} records...`);
      }
    }
    
    // Save data version
    await db.insertDataVersion({
      downloadDate: new Date().toISOString(),
      fileSha256,
      fileSize: stats.size,
      recordCount,
      downloadUrl: 'local-csv-file',
      status: 'active'
    });
    
    logger.info(`Database setup completed successfully!`);
    logger.info(`Total records imported: ${recordCount}`);
    
  } catch (error) {
    logger.error('Error during database setup:', error);
    throw error;
  } finally {
    await db.close();
  }
}

async function main() {
  try {
    await setupDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}