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