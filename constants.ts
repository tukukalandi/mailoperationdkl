import { MasterDataRow } from './types';

export const MASTER_DATA: MasterDataRow[] = [
  // Primary HOs & SOs
  { officeId: "26360015", officeName: "Angul H.O", officeType: "P.O", officeJurisdiction: "Angul H.O", headOfficeName: "Angul H.O", subDivisionName: "Angul East Sub Division", areaType: "Urban" },
  { officeId: "26660617", officeName: "Angul Bazar S.O", officeType: "P.O", officeJurisdiction: "Angul Bazar S.O", headOfficeName: "Angul H.O", subDivisionName: "Angul West Sub Division", areaType: "Urban" },
  { officeId: "26660619", officeName: "Athamallik S.O", officeType: "P.O", officeJurisdiction: "Athamallik S.O", headOfficeName: "Angul H.O", subDivisionName: "Angul West Sub Division", areaType: "Rural" },
  { officeId: "26660621", officeName: "Bagedia S.O", officeType: "P.O", officeJurisdiction: "Bagedia S.O", headOfficeName: "Angul H.O", subDivisionName: "Angul West Sub Division", areaType: "Rural" },
  { officeId: "26360016", officeName: "Dhenkanal H.O", officeType: "P.O", officeJurisdiction: "Dhenkanal H.O", headOfficeName: "Dhenkanal H.O", subDivisionName: "Dhenkanal Sub Division", areaType: "Urban" },

  // The 7 Specific Relocated/Renamed BOs (Dec 2025 Updates with Corrected Jurisdictions)
  { officeId: "26107700", officeName: "Kurumula BO", officeType: "B.O", officeJurisdiction: "Khamar S.O", headOfficeName: "Angul H.O", subDivisionName: "Talcher Sub Division", areaType: "Rural" },
  { officeId: "26103729", officeName: "Balijharan BO", officeType: "B.O", officeJurisdiction: "Talcher S.O", headOfficeName: "Angul H.O", subDivisionName: "Talcher Sub Division", areaType: "Rural" },
  { officeId: "26107705", officeName: "Samal BO", officeType: "B.O", officeJurisdiction: "Athamallik S.O", headOfficeName: "Angul H.O", subDivisionName: "Angul West Sub Division", areaType: "Rural" },
  { officeId: "26107701", officeName: "Bania BO", officeType: "B.O", officeJurisdiction: "Gondiapatana S.O", headOfficeName: "Angul H.O", subDivisionName: "Dhenkanal Sub Division", areaType: "Rural" },
  { officeId: "26103584", officeName: "Burubura BO", officeType: "B.O", officeJurisdiction: "Athamallik S.O", headOfficeName: "Angul H.O", subDivisionName: "Angul West Sub Division", areaType: "Rural" },
  { officeId: "26103845", officeName: "Pitachari BO", officeType: "B.O", officeJurisdiction: "Athamallik S.O", headOfficeName: "Angul H.O", subDivisionName: "Angul West Sub Division", areaType: "Rural" },
  { officeId: "26103641", officeName: "Girida BO", officeType: "B.O", officeJurisdiction: "Athamallik S.O", headOfficeName: "Angul H.O", subDivisionName: "Angul West Sub Division", areaType: "Rural" }
];

export const PRODUCTS = {
  DOMESTIC: [
    'Inland Speed Post',
    'Gyan Post', 
    'Inland Speed Post Document', 
    'Registered Letter'
  ],
  PARCEL: [
    'India Post Parcel Retail',
    'Indiapost Parcel Contractual', 
    'Speed Post Parcel Domestic'
  ],
  INTERNATIONAL: [
    'International Air Parcel',
    'International Speed Post Document',
    'International Speed Post Merchandise',
    'Registered Foreign Letter',
    'Registered International Small Packets',
    'International Registered Letter'
  ],
  ALL: [
    'Inland Speed Post',
    'Gyan Post',
    'Inland Speed Post Document',
    'Registered Letter',
    'India Post Parcel Retail',
    'Indiapost Parcel Contractual',
    'Speed Post Parcel Domestic',
    'International Air Parcel',
    'International Speed Post Document',
    'International Speed Post Merchandise',
    'Registered Foreign Letter',
    'Registered International Small Packets',
    'International Registered Letter'
  ]
};
