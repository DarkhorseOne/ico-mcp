#!/usr/bin/env ts-node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../src/utils/logger';

const execAsync = promisify(exec);

// ICO Register of Data Controllers - now uses daily ZIP files
const ICO_BASE_URL = 'https://ico.org.uk/media2/cfnc5zdf/register-of-data-controllers-';
const LOCAL_FILE_PATH = path.join(__dirname, '..', 'register-of-data-controllers.csv');
const TEMP_ZIP_PATH = path.join(__dirname, '..', 'temp-register.zip');

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
}

function generateRecentUrls(daysBack: number = 7): string[] {
  const urls: string[] = [];
  const today = new Date();
  
  for (let i = 0; i < daysBack; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = formatDate(date);
    urls.push(`${ICO_BASE_URL}${dateStr}.zip`);
  }
  
  return urls;
}

async function extractZipFile(zipPath: string, outputDir: string): Promise<string> {
  try {
    // Try to extract using unzip command (available on most systems)
    const { stdout } = await execAsync(`unzip -l "${zipPath}"`);
    
    // Find the CSV file in the zip listing
    // The output format is: "   size  date time   filename"
    const csvMatch = stdout.match(/\s+\d+\s+\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}\s+(.+\.csv)\s*$/m);
    if (!csvMatch) {
      throw new Error('No CSV file found in ZIP archive');
    }
    
    const csvFileName = csvMatch[1];
    logger.info(`Found CSV file in ZIP: ${csvFileName}`);
    
    // Extract the CSV file
    await execAsync(`unzip -o "${zipPath}" -d "${outputDir}"`);
    
    return path.join(outputDir, csvFileName);
  } catch (error) {
    logger.error('Failed to extract ZIP file:', error);
    throw new Error('ZIP extraction failed. Please install unzip utility.');
  }
}

async function testUrlExists(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = https.get(url, { method: 'HEAD' }, (response) => {
      resolve(response.statusCode === 200);
    });
    
    request.on('error', () => {
      resolve(false);
    });
    
    request.setTimeout(5000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function downloadFile(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        if (response.headers.location) {
          logger.info(`Redirecting to: ${response.headers.location}`);
          return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0');
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          process.stdout.write(`\rDownloading: ${percent}% (${downloadedSize}/${totalSize} bytes)`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\nDownload completed successfully!');
        resolve();
      });
      
      file.on('error', (error) => {
        fs.unlink(filepath, () => {}); // Delete the file on error
        reject(error);
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
  });
}

async function main(): Promise<void> {
  try {
    logger.info('Starting ICO data download...');
    logger.info(`Target file: ${LOCAL_FILE_PATH}`);
    
    // Check if file already exists
    if (fs.existsSync(LOCAL_FILE_PATH)) {
      const stats = fs.statSync(LOCAL_FILE_PATH);
      const fileAge = Date.now() - stats.mtime.getTime();
      const daysSinceModified = Math.floor(fileAge / (1000 * 60 * 60 * 24));
      
      logger.info(`Existing file found (${daysSinceModified} days old)`);
      
      if (daysSinceModified < 7) {
        logger.info('File is less than 7 days old, skipping download');
        logger.info('Use --force to download anyway');
        if (!process.argv.includes('--force')) {
          process.exit(0);
        }
      }
    }
    
    // Generate URLs for recent days
    const recentUrls = generateRecentUrls(7);
    logger.info(`Checking for recent ICO data files...`);
    
    let foundUrl: string | null = null;
    for (const url of recentUrls) {
      logger.info(`Checking: ${url}`);
      if (await testUrlExists(url)) {
        foundUrl = url;
        logger.info(`Found available file: ${url}`);
        break;
      }
    }
    
    if (!foundUrl) {
      throw new Error('No recent ICO data files found. Please check the ICO website manually.');
    }
    
    // Download the ZIP file
    logger.info(`Downloading ZIP file from: ${foundUrl}`);
    await downloadFile(foundUrl, TEMP_ZIP_PATH);
    
    // Extract the ZIP file
    logger.info('Extracting ZIP file...');
    const extractedCsvPath = await extractZipFile(TEMP_ZIP_PATH, path.dirname(LOCAL_FILE_PATH));
    
    // Move the extracted CSV to the expected location
    if (extractedCsvPath !== LOCAL_FILE_PATH) {
      fs.renameSync(extractedCsvPath, LOCAL_FILE_PATH);
      logger.info(`Moved CSV file to: ${LOCAL_FILE_PATH}`);
    }
    
    // Clean up ZIP file
    if (fs.existsSync(TEMP_ZIP_PATH)) {
      fs.unlinkSync(TEMP_ZIP_PATH);
      logger.info('Cleaned up temporary ZIP file');
    }
    
    // Verify the file
    const stats = fs.statSync(LOCAL_FILE_PATH);
    logger.info(`File downloaded successfully: ${stats.size} bytes`);
    
    // Check if it's a CSV file by reading the first line
    const firstLine = fs.readFileSync(LOCAL_FILE_PATH, 'utf8').split('\n')[0];
    if (firstLine.includes('Registration_number') || firstLine.includes('Organisation_name')) {
      logger.info('CSV file format verified');
    } else {
      logger.warn('File format may not be correct CSV');
      logger.info(`First line: ${firstLine.substring(0, 100)}...`);
    }
    
    logger.info('ICO data download completed successfully!');
    logger.info('Run "npm run setup-db" to import the data into the database');
    
  } catch (error) {
    logger.error('Error downloading ICO data:', error);
    // Clean up on error
    if (fs.existsSync(TEMP_ZIP_PATH)) {
      fs.unlinkSync(TEMP_ZIP_PATH);
    }
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: npm run download-data [options]

Options:
  --force    Force download even if file exists and is recent
  --help     Show this help message

Description:
  Downloads the latest ICO Register of Data Controllers CSV file from the ICO website.
  The ICO now publishes daily ZIP files containing the CSV data.
  The script will automatically find and download the most recent available file.
  
  By default, the script will skip download if the file exists and is less than 7 days old.
  Use --force to download anyway.

Examples:
  npm run download-data                # Download if file is old or missing
  npm run download-data -- --force     # Force download
  npm run download-data -- --help      # Show this help
`);
  process.exit(0);
}

// Run the main function
if (require.main === module) {
  main();
}