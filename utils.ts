import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RawBookingRow, MasterDataRow, TargetDataRow } from './types';
import { PRODUCTS } from './constants';

// Relocation Mapping (Ensuring all 7 relocated BOs are precisely handled)
export const OFFICE_RELOCATION_MAP: Record<string, { id: string, name: string }> = {
  // Case 1: ID Change Relocations (Pre-Dec 2025 IDs -> New IDs)
  '26103770': { id: '26107700', name: 'Kurumula BO' },       // Rada -> Kurumula
  '26103430': { id: '26103729', name: 'Balijharan BO' },    // Ballahar Chhak -> Balijharan
  '26103494': { id: '26107701', name: 'Bania BO' },         // Chatghar Forestbeat -> Bania
  
  // Case 2: Special Swap for Nizigarh (Old 26103729) -> Samal (New 26107705)
  // Check name if ID is 26103729
  
  // Case 3: Same ID renames (Forcing new names regardless of source file text)
  '26103584': { id: '26103584', name: 'Burubura BO' },      // Old: Kaira
  '26103845': { id: '26103845', name: 'Pitachari BO' },     // Old: Tuluka
  '26103641': { id: '26103641', name: 'Girida BO' },        // Old: Katranga(Bada)
};

// IDs that are definitely obsolete and should be purged
const OBSOLETE_IDS = ['26103770', '26103430', '26103494'];

// Default fallback if fetch fails
import { MASTER_DATA as DEFAULT_MASTER_DATA } from './constants';

export const getProductCategory = (productName: string): 'Domestic' | 'Parcel' | 'International' | 'Other' => {
  const name = productName.toLowerCase().trim();
  
  const isDomestic = PRODUCTS.DOMESTIC.some(p => p.toLowerCase().trim() === name);
  if (isDomestic) return 'Domestic';
  
  const isParcel = PRODUCTS.PARCEL.some(p => p.toLowerCase().trim() === name);
  if (isParcel) return 'Parcel';
  
  const isInternational = PRODUCTS.INTERNATIONAL.some(p => p.toLowerCase().trim() === name);
  if (isInternational) return 'International';
  
  return 'Other';
};

// Resilient numeric parser
const parseNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
     return isNaN(val) ? 0 : val;
  }
  
  let strVal = String(val).trim();
  if (!strVal) return 0;

  strVal = strVal.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const num = parseFloat(strVal);
  return isNaN(num) ? 0 : num;
};

/**
 * Normalizes office identity during parsing to handle relocations.
 */
const normalizeOffice = (officeId: string, officeName: string): { id: string, name: string } => {
  const id = String(officeId).trim();
  const name = String(officeName).trim();

  // Check 1: Explicit Map (ID-to-ID/Name relocations)
  if (OFFICE_RELOCATION_MAP[id]) {
    return { id: OFFICE_RELOCATION_MAP[id].id, name: OFFICE_RELOCATION_MAP[id].name };
  }

  // Check 2: Special Name-based Swap for ID 26103729 (Nizigarh moved to Samal)
  if (id === '26103729' && name.toLowerCase().includes('nizigarh')) {
    return { id: '26107705', name: 'Samal BO' };
  }

  return { id, name };
};

export const parseExcelFile = (file: File): Promise<RawBookingRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (!data) return reject("No data read");
      
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      const parsedData: RawBookingRow[] = [];

      jsonData.forEach((row, index) => {
        if (index === 0) {
           const potentialId = String(row[0] || '').toLowerCase();
           if (potentialId === 'office id' || potentialId === 'officeid') return;
        }

        const rawId = row[0] ? String(row[0]).trim() : '';
        if (!rawId || rawId.toLowerCase() === 'office id') return; 

        const { id, name } = normalizeOffice(rawId, row[1] ? String(row[1]) : '');

        const entry: RawBookingRow = {
          officeId: id,
          officeName: name,
          productName: row[2] ? String(row[2]).trim() : '',
          articles: parseNumber(row[3]),
          postage: parseNumber(row[4]),
          vas: parseNumber(row[5]),
          tax: parseNumber(row[6]),
          prepaidFm: parseNumber(row[7]),
          prepaidPs: parseNumber(row[8]),
          prepaidSs: parseNumber(row[9]),
          totalAmount: parseNumber(row[10]),
          avgWeight: parseNumber(row[11]),
        };
        parsedData.push(entry);
      });

      resolve(parsedData);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

const parseCSVLine = (text: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(field => {
    let f = field;
    if (f.startsWith('"') && f.endsWith('"')) {
      f = f.slice(1, -1);
    }
    return f.replace(/""/g, '"').trim();
  });
};

export const fetchMasterDataFromUrl = async (url: string): Promise<MasterDataRow[]> => {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch master data`);
    const text = await response.text();
    
    const lines = text.split(/\r?\n/);
    const masterDataMap = new Map<string, MasterDataRow>();
    
    lines.forEach((line, index) => {
      if (index === 0 || !line.trim()) return;

      const row = parseCSVLine(line);
      const rawId = row[0] ? row[0].trim() : '';
      if (!rawId) return;

      // Skip IDs that we know are old and replaced by new IDs
      if (OBSOLETE_IDS.includes(rawId)) return;

      const { id, name } = normalizeOffice(rawId, row[1] || '');

      masterDataMap.set(id, {
        officeId: id,
        officeName: name,
        officeType: row[2] ? row[2].trim() : '',
        officeJurisdiction: row[3] ? row[3].trim() : '',
        headOfficeName: row[4] ? row[4].trim() : '',
        subDivisionName: row[5] ? row[5].trim() : '',
        areaType: row[6] ? row[6].trim() : 'Rural',
      });
    });

    // Merge with internal critical defaults
    // CRITICAL FIX: We now always overwrite the map with DEFAULT_MASTER_DATA.
    // This ensures that the corrected jurisdictions and subdivisions in constants.ts
    // take absolute priority over any remote spreadsheet data.
    DEFAULT_MASTER_DATA.forEach(def => {
       masterDataMap.set(def.officeId, def);
    });

    return Array.from(masterDataMap.values());
  } catch (error) {
    console.warn("Falling back to internal master data due to fetch error:", error);
    return DEFAULT_MASTER_DATA;
  }
};

export const fetchBookingDataFromUrl = async (url: string): Promise<RawBookingRow[]> => {
  try {
    const response = await fetch(url, { 
      method: 'GET',
      headers: { 'Accept': 'text/csv' },
      cache: 'no-store'
    });
    
    if (!response.ok) throw new Error(`Server returned status ${response.status}`);

    const text = await response.text();
    const lines = text.split(/\r?\n/);
    const parsedData: RawBookingRow[] = [];
    
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      const row = parseCSVLine(line);
      if (row.length < 5) return;
      if (index === 0) {
         const firstCell = String(row[0] || '').toLowerCase();
         if (firstCell.includes('office')) return;
      }
      const rawId = row[0] ? String(row[0]).trim() : '';
      if (!rawId || isNaN(parseInt(rawId))) return;

      const { id, name } = normalizeOffice(rawId, row[1] || '');

      const entry: RawBookingRow = {
        officeId: id,
        officeName: name,
        productName: row[2] ? String(row[2]).trim() : '',
        articles: parseNumber(row[3]),
        postage: parseNumber(row[4]),
        vas: parseNumber(row[5]),
        tax: parseNumber(row[6]),
        prepaidFm: parseNumber(row[7]),
        prepaidPs: parseNumber(row[8]),
        prepaidSs: parseNumber(row[9]),
        totalAmount: parseNumber(row[10]),
        avgWeight: parseNumber(row[11]),
      };
      parsedData.push(entry);
    });
    return parsedData;
  } catch (error: any) {
    throw error;
  }
};

export const formatCurrency = (val: number) => {
  return 'Rs. ' + new Intl.NumberFormat('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(val);
};

export const exportToPDF = (headers: string[], data: any[][], title: string, landscape = false, footer?: any[]) => {
  const doc = new jsPDF(landscape ? 'l' : 'p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const timestamp = new Date().toLocaleString();

  doc.setFillColor(206, 32, 41);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text("Department of Posts, Ministry of Communication", pageWidth / 2, 9, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("Dhenkanal Postal Division, Odisha Circle", pageWidth / 2, 16, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 32, { align: 'center' });

  autoTable(doc, {
    head: [headers],
    body: data,
    foot: footer ? [footer] : undefined,
    startY: 38,
    theme: 'grid',
    styles: { 
      fontSize: 7, 
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    headStyles: { 
      fillColor: [206, 32, 41], 
      textColor: 255, 
      fontStyle: 'bold',
      halign: 'center'
    },
    footStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'right'
    },
    alternateRowStyles: { 
      fillColor: [255, 241, 241]
    },
    didParseCell: (dataCell) => {
      const val = String(dataCell.cell.raw).toLowerCase();
      if (val === '0' || val === '0.00' || val === 'rs. 0.00') {
        dataCell.cell.styles.textColor = [206, 32, 41];
      }
      // Center align Sl No and Percentage columns
      if (dataCell.column.index === 0 || dataCell.column.index === headers.length - 1) {
        dataCell.cell.styles.halign = 'center';
      }
      // Bold the total row (usually has 'TOTAL' in the second column)
      const cellValue = String(dataCell.row.cells[1]?.raw || '');
      if (cellValue.includes('TOTAL')) {
        dataCell.cell.styles.fontStyle = 'bold';
        dataCell.cell.styles.fillColor = [240, 240, 240];
      }
    },
    didDrawPage: (dataPage) => {
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Generated: ${timestamp}`, 14, pageHeight - 10);
      const pageNumber = doc.internal.pages.length - 1;
      doc.text(`Page ${pageNumber}`, pageWidth - 25, pageHeight - 10);
    }
  });

  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
};

export const exportToExcel = (data: any[], fileName: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const fetchTargetDataFromUrl = async (url: string, type: 'Parcel' | 'International' | 'Domestic' = 'Parcel'): Promise<TargetDataRow[]> => {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch target data`);
    const text = await response.text();
    
    const lines = text.split(/\r?\n/);
    const targetData: TargetDataRow[] = [];
    
    lines.forEach((line, index) => {
      if (index === 0 || !line.trim()) return;

      const row = parseCSVLine(line);
      
      const slNo = row[0] ? String(row[0]).trim() : '';
      const rawId = row[2] ? String(row[2]).trim() : '';
      const rawName = row[1] ? String(row[1]).trim() : '';
      
      if (!rawId || isNaN(parseInt(rawId)) || parseInt(rawId) === 0) return;

      const { id: officeId, name: officeName } = normalizeOffice(rawId, rawName);

      if (type === 'Parcel') {
        if (row.length < 6) return;
        const indiaPostParcelRetail = parseNumber(row[3]);
        const indiaPostParcelContractual = parseNumber(row[4]);
        const speedPostParcelDomestic = parseNumber(row[5]);
        
        targetData.push({
          slNo,
          officeName,
          officeId,
          speedPostParcelDomestic,
          indiaPostParcelRetail,
          indiaPostParcelContractual,
          totalTarget: speedPostParcelDomestic + indiaPostParcelRetail + indiaPostParcelContractual
        });
      } else if (type === 'International') {
        if (row.length < 4) return;
        const internationalMailRevenue = parseNumber(row[3]);
        
        targetData.push({
          slNo,
          officeName,
          officeId,
          internationalMailRevenue,
          totalTarget: internationalMailRevenue
        });
      } else if (type === 'Domestic') {
        if (row.length < 4) return;
        const domesticMailRevenue = parseNumber(row[3]);
        
        targetData.push({
          slNo,
          officeName,
          officeId,
          domesticMailRevenue,
          totalTarget: domesticMailRevenue
        });
      }
    });

    return targetData;
  } catch (error) {
    console.error("Error fetching target data:", error);
    return [];
  }
};
