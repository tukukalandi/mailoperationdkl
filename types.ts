export interface MasterDataRow {
  officeId: string;
  officeName: string;
  officeType: string;
  officeJurisdiction: string;
  headOfficeName: string;
  subDivisionName: string;
  areaType: string; // Column G: Urban/Rural
}

// Raw row from Excel before joining with Master Data
export interface RawBookingRow {
  officeId: string; // Col A
  officeName: string; // Col B
  productName: string; // Col C
  articles: number; // Col D
  postage: number; // Col E
  vas: number; // Col F
  tax: number; // Col G
  prepaidFm: number; // Col H
  prepaidPs: number; // Col I
  prepaidSs: number; // Col J
  totalAmount: number; // Col K (Revenue)
  avgWeight: number; // Col L
}

export interface BookingDataRow extends RawBookingRow {
  // Enriched fields from Master Data
  subDivision?: string;
  headOffice?: string;
  officeType?: string;
  officeJurisdiction?: string;
  areaType?: string;
}

export interface AnalysisSummary {
  subDivisionName: string;
  articleCount: number;
  postageAmount: number;
  totalRevenue: number;
}

export interface OfficeSummary {
  officeName: string;
  articleCount: number;
  postageAmount: number;
  totalRevenue: number;
}

export enum ProductGroup {
  ALL = 'Total Revenue',
  DOMESTIC = 'Domestic Mail Revenue',
  PARCEL = 'Parcel Revenue',
  INTERNATIONAL = 'International Mail Revenue'
}

export interface FilterState {
  officeId: string;
  officeName: string;
  productName: string;
}

export interface TargetDataRow {
  slNo: string;
  officeName: string;
  officeId: string;
  // Parcel specific
  speedPostParcelDomestic?: number;
  indiaPostParcelRetail?: number;
  indiaPostParcelContractual?: number;
  // International specific
  internationalMailRevenue?: number;
  // Domestic specific
  domesticMailRevenue?: number;
  // Common
  totalTarget: number;
}

export interface InternationalReport {
  id?: string;
  month: string;
  data: RawBookingRow[];
  updatedAt: any;
}
