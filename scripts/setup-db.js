#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../src/services/database");
const logger_1 = require("../src/utils/logger");
const CSV_FILE_PATH = './register-of-data-controllers.csv';
const DB_PATH = './data/ico.db';
async function setupDatabase() {
    const db = new database_1.DatabaseService();
    try {
        logger_1.logger.info('Starting database setup...');
        // Initialize database
        await db.initialize(DB_PATH);
        logger_1.logger.info('Database initialized');
        // Check if CSV file exists
        if (!fs_1.default.existsSync(CSV_FILE_PATH)) {
            throw new Error(`CSV file not found: ${CSV_FILE_PATH}`);
        }
        // Get file stats for version tracking
        const stats = fs_1.default.statSync(CSV_FILE_PATH);
        const fileContent = fs_1.default.readFileSync(CSV_FILE_PATH);
        const fileSha256 = crypto_1.default.createHash('sha256').update(fileContent).digest('hex');
        logger_1.logger.info(`Processing CSV file: ${CSV_FILE_PATH}`);
        logger_1.logger.info(`File size: ${stats.size} bytes`);
        logger_1.logger.info(`File SHA256: ${fileSha256}`);
        // Clear existing data
        await db.clearRegistrations();
        logger_1.logger.info('Cleared existing registrations');
        // Parse and import CSV data
        let recordCount = 0;
        const records = [];
        await new Promise((resolve, reject) => {
            fs_1.default.createReadStream(CSV_FILE_PATH)
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                try {
                    const registration = {
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
                            logger_1.logger.info(`Processed ${recordCount} records...`);
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.error('Error processing row:', error);
                }
            })
                .on('end', () => {
                logger_1.logger.info(`Finished reading CSV. Total records: ${recordCount}`);
                resolve();
            })
                .on('error', (error) => {
                reject(error);
            });
        });
        // Batch insert records
        logger_1.logger.info('Starting database import...');
        for (let i = 0; i < records.length; i++) {
            await db.insertRegistration(records[i]);
            if ((i + 1) % 1000 === 0) {
                logger_1.logger.info(`Imported ${i + 1}/${records.length} records...`);
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
        logger_1.logger.info(`Database setup completed successfully!`);
        logger_1.logger.info(`Total records imported: ${recordCount}`);
    }
    catch (error) {
        logger_1.logger.error('Error during database setup:', error);
        throw error;
    }
    finally {
        await db.close();
    }
}
async function main() {
    try {
        await setupDatabase();
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Setup failed:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
//# sourceMappingURL=setup-db.js.map