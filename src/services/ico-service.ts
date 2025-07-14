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
    return await this.db.searchRegistrations({ limit });
  }

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