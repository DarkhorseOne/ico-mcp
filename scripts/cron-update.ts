#!/usr/bin/env ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { logger } from '../src/utils/logger';

const execAsync = promisify(exec);

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
const LOCK_FILE = path.join(PROJECT_ROOT, 'data', 'update.lock');
const MAX_LOCK_AGE = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

async function checkLockFile(): Promise<boolean> {
  if (!fs.existsSync(LOCK_FILE)) {
    return false;
  }
  
  const stats = fs.statSync(LOCK_FILE);
  const age = Date.now() - stats.mtime.getTime();
  
  if (age > MAX_LOCK_AGE) {
    // Lock file is too old, remove it
    fs.unlinkSync(LOCK_FILE);
    logger.warn('Removed stale lock file');
    return false;
  }
  
  return true;
}

function createLockFile(): void {
  // Ensure data directory exists
  const dataDir = path.dirname(LOCK_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(LOCK_FILE, process.pid.toString());
}

function removeLockFile(): void {
  if (fs.existsSync(LOCK_FILE)) {
    fs.unlinkSync(LOCK_FILE);
  }
}

async function runCommand(command: string, description: string): Promise<void> {
  logger.info(`${description}...`);
  
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: PROJECT_ROOT });
    
    if (stdout) {
      logger.info(stdout);
    }
    
    if (stderr) {
      logger.warn(stderr);
    }
    
    logger.info(`${description} completed successfully`);
  } catch (error) {
    logger.error(`${description} failed:`, error);
    throw error;
  }
}

async function updateData(): Promise<void> {
  try {
    // Check if another update is running
    if (await checkLockFile()) {
      logger.info('Another update is already running, exiting');
      return;
    }
    
    // Create lock file
    createLockFile();
    
    logger.info('Starting ICO data update process...');
    
    // Step 1: Download latest data
    await runCommand('npm run download-data -- --force', 'Downloading latest ICO data');
    
    // Step 2: Build the project (in case of TypeScript changes)
    await runCommand('npm run build', 'Building project');
    
    // Step 3: Update database
    await runCommand('npm run setup-db', 'Updating database');
    
    logger.info('ICO data update completed successfully!');
    
  } catch (error) {
    logger.error('Data update failed:', error);
    throw error;
  } finally {
    // Always remove lock file
    removeLockFile();
  }
}

async function main(): Promise<void> {
  try {
    // Handle command line arguments
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.log(`
Usage: npm run cron-update [options]

Options:
  --dry-run  Show what would be done without actually doing it
  --help     Show this help message

Description:
  Automated update script for ICO data. This script:
  1. Downloads the latest ICO Register of Data Controllers CSV
  2. Builds the project
  3. Updates the database with new data
  
  This script is designed to be run via cron job for regular updates.
  It includes lock file protection to prevent multiple simultaneous updates.

Examples:
  npm run cron-update                   # Perform full update
  npm run cron-update -- --dry-run      # Show what would be done
  npm run cron-update -- --help         # Show this help

Cron Schedule Examples:
  # Daily at 2 AM
  0 2 * * * cd /path/to/ico-mcp && npm run cron-update >> logs/cron.log 2>&1
  
  # Weekly on Sundays at 1 AM
  0 1 * * 0 cd /path/to/ico-mcp && npm run cron-update >> logs/cron.log 2>&1
`);
      process.exit(0);
    }
    
    if (process.argv.includes('--dry-run')) {
      logger.info('DRY RUN: The following actions would be performed:');
      logger.info('1. Download latest ICO data (--force)');
      logger.info('2. Build project (npm run build)');
      logger.info('3. Update database (npm run setup-db)');
      logger.info('Lock file would be created at:', LOCK_FILE);
      return;
    }
    
    // Run the update
    await updateData();
    
  } catch (error) {
    logger.error('Cron update failed:', error);
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  logger.info('Received SIGINT, cleaning up...');
  removeLockFile();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, cleaning up...');
  removeLockFile();
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main();
}