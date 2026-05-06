import React, { useState, useEffect, useMemo } from 'react';
import DataSheet from './components/DataSheet';
import DashboardAnalysis from './components/DashboardAnalysis';
import RSBTCellReport from './components/RSBTCellReport';
import BookingReport from './components/BookingReport';
import TargetAchievement from './components/TargetAchievement';
import InternationalPortal from './components/InternationalPortal';
import { parseExcelFile, fetchMasterDataFromUrl, fetchBookingDataFromUrl, fetchTargetDataFromUrl } from './utils';
import { BookingDataRow, RawBookingRow, MasterDataRow, TargetDataRow, InternationalReport } from './types';
import { MASTER_DATA as DEFAULT_MASTER_DATA } from './constants';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { LayoutDashboard, Table, UploadCloud, AlertCircle, RefreshCw, Link as LinkIcon, FileSpreadsheet, FileText, ClipboardList, ArrowLeft, Info, CalendarRange, Target, Database, Globe, ExternalLink, ShieldCheck } from 'lucide-react';

const MASTER_DATA_URL = 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/export?format=csv&gid=2034712139';
const TARGET_DATA_URL = 'https://docs.google.com/spreadsheets/d/1A1JBFKd57lQteLAsbtrQmVYLi19RHpngJOhf0G_Bacc/edit?gid=1526550329#gid=1526550329';
const INTERNATIONAL_TARGET_DATA_URL = 'https://docs.google.com/spreadsheets/d/1A1JBFKd57lQteLAsbtrQmVYLi19RHpngJOhf0G_Bacc/edit?gid=1951675497#gid=1951675497';
const DOMESTIC_TARGET_DATA_URL = 'https://docs.google.com/spreadsheets/d/1A1JBFKd57lQteLAsbtrQmVYLi19RHpngJOhf0G_Bacc/edit?gid=0#gid=0';

const MONTHS = [
  "April 2026", "May 2026", "June 2026", "July 2026", "August 2026", "September 2026",
  "October 2026", "November 2026", "December 2026", "January 2027", "February 2027", "March 2027"
];

/**
 * Converts Google Sheets URLs to direct CSV export URLs.
 */
const convertToExportUrl = (inputUrl: string): string | null => {
  let url = inputUrl.trim();
  if (!url) return null;

  if (url.includes('docs.google.com/spreadsheets')) {
    if (url.includes('/d/e/')) {
      const parts = url.split('/pub');
      const baseUrl = parts[0];
      const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      return `${baseUrl}/pub?gid=${gid}&single=true&output=csv`;
    }

    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) {
      const id = idMatch[1];
      const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }
  }
  return url;
};

type AppTab = 'datasheet' | 'dashboard' | 'rsbt' | 'booking' | 'target';

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('datasheet');
  const [rawBookingData, setRawBookingData] = useState<RawBookingRow[]>([]);
  const [masterData, setMasterData] = useState<MasterDataRow[]>(DEFAULT_MASTER_DATA);
  const [targetData, setTargetData] = useState<TargetDataRow[]>([]);
  const [internationalTargetData, setInternationalTargetData] = useState<TargetDataRow[]>([]);
  const [domesticTargetData, setDomesticTargetData] = useState<TargetDataRow[]>([]);
  const [isMasterDataLoading, setIsMasterDataLoading] = useState(false);
  const [isTargetDataLoading, setIsTargetDataLoading] = useState(false);
  const [isInternationalTargetLoading, setIsInternationalTargetLoading] = useState(false);
  const [isDomesticTargetLoading, setIsDomesticTargetLoading] = useState(false);
  const [masterDataSource, setMasterDataSource] = useState<'Default' | 'Synced'>('Default');
  const [targetDataSource, setTargetDataSource] = useState<'None' | 'Synced'>('None');
  const [internationalTargetSource, setInternationalTargetSource] = useState<'None' | 'Synced'>('None');
  const [domesticTargetSource, setDomesticTargetSource] = useState<'None' | 'Synced'>('None');
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{current: number, total: number, name?: string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [internationalTargetUrl, setInternationalTargetUrl] = useState('');
  const [domesticTargetUrl, setDomesticTargetUrl] = useState('');

  // Period Selection State
  const [fromMonthIndex, setFromMonthIndex] = useState(0);
  const [toMonthIndex, setToMonthIndex] = useState(0);

  // Firestore Data State
  const [internationalReports, setInternationalReports] = useState<InternationalReport[]>([]);
  const [showPortal, setShowPortal] = useState(false);

  useEffect(() => {
    handleSyncMasterData(true);
    handleSyncTargetData(true);
    handleSyncInternationalTargetData(true);
    handleSyncDomesticTargetData(true);

    // Subscribe to Firestore updates
    const q = query(collection(db, "international_reports"), orderBy("month", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports: InternationalReport[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InternationalReport));
      setInternationalReports(reports);
    }, (error) => {
      console.error("Firestore subscription error", error);
    });

    return () => unsubscribe();
  }, []);

  const handleSyncMasterData = async (silent = false) => {
    if (!silent) setIsMasterDataLoading(true);
    try {
      const data = await fetchMasterDataFromUrl(MASTER_DATA_URL);
      if (data && data.length > 0) {
        setMasterData(data);
        setMasterDataSource('Synced');
        if(!silent) alert(`Successfully synced ${data.length} master data records.`);
      }
    } catch (e) {
      console.error("Master data sync failed", e);
    } finally {
      if (!silent) setIsMasterDataLoading(false);
    }
  };

  const handleSyncTargetData = async (silent = false, overrideUrl?: string) => {
    const urlToUse = overrideUrl || TARGET_DATA_URL;
    if (!urlToUse) return;
    
    const fetchUrl = convertToExportUrl(urlToUse);
    if (!fetchUrl) return;

    if (!silent) setIsTargetDataLoading(true);
    try {
      const data = await fetchTargetDataFromUrl(fetchUrl, 'Parcel');
      if (data && data.length > 0) {
        setTargetData(data);
        setTargetDataSource('Synced');
        if(!silent) alert(`Successfully synced ${data.length} parcel target records.`);
      }
    } catch (e) {
      console.error("Target data sync failed", e);
      if (!silent) alert("Failed to sync target data. Ensure the link is correct and published to the web.");
    } finally {
      if (!silent) setIsTargetDataLoading(false);
    }
  };

  const handleSyncInternationalTargetData = async (silent = false, overrideUrl?: string) => {
    const urlToUse = overrideUrl || INTERNATIONAL_TARGET_DATA_URL;
    if (!urlToUse) return;
    
    const fetchUrl = convertToExportUrl(urlToUse);
    if (!fetchUrl) return;

    if (!silent) setIsInternationalTargetLoading(true);
    try {
      const data = await fetchTargetDataFromUrl(fetchUrl, 'International');
      if (data && data.length > 0) {
        setInternationalTargetData(data);
        setInternationalTargetSource('Synced');
        if(!silent) alert(`Successfully synced ${data.length} international target records.`);
      }
    } catch (e) {
      console.error("International target data sync failed", e);
      if (!silent) alert("Failed to sync international target data.");
    } finally {
      if (!silent) setIsInternationalTargetLoading(false);
    }
  };

  const handleSyncDomesticTargetData = async (silent = false, overrideUrl?: string) => {
    const urlToUse = overrideUrl || DOMESTIC_TARGET_DATA_URL;
    if (!urlToUse) return;
    
    const fetchUrl = convertToExportUrl(urlToUse);
    if (!fetchUrl) return;

    if (!silent) setIsDomesticTargetLoading(true);
    try {
      const data = await fetchTargetDataFromUrl(fetchUrl, 'Domestic');
      if (data && data.length > 0) {
        setDomesticTargetData(data);
        setDomesticTargetSource('Synced');
        if(!silent) alert(`Successfully synced ${data.length} domestic target records.`);
      }
    } catch (e) {
      console.error("Domestic target data sync failed", e);
      if (!silent) alert("Failed to sync domestic target data. Ensure the link is correct and published to the web.");
    } finally {
      if (!silent) setIsDomesticTargetLoading(false);
    }
  };

  const enrichedBookingData: BookingDataRow[] = useMemo(() => {
    return rawBookingData.map(row => {
      const master = masterData.find(m => m.officeId === row.officeId);
      return {
        ...row,
        subDivision: master?.subDivisionName || 'Unknown Sub-Division',
        headOffice: master?.headOfficeName || 'Unknown',
        officeType: master?.officeType || 'Unknown',
        officeJurisdiction: master?.officeJurisdiction || 'Unknown Jurisdiction',
        areaType: master?.areaType || 'Rural'
      };
    });
  }, [rawBookingData, masterData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    const fileList = (Array.from(files) as File[]).slice(0, 5); // Limit to 5 files as requested
    let aggregatedData: RawBookingRow[] = [];
    let failedFiles: string[] = [];

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setLoadingProgress({ current: i + 1, total: fileList.length, name: file.name });
        try {
          const rawData = await parseExcelFile(file);
          aggregatedData = [...aggregatedData, ...rawData];
        } catch (err) {
          console.error(`Failed to parse ${file.name}:`, err);
          failedFiles.push(file.name);
        }
      }

      if (aggregatedData.length === 0) {
        throw new Error("No valid booking data found in the uploaded files.");
      }

      if (failedFiles.length > 0) {
        alert(`Note: The following files could not be parsed: ${failedFiles.join(', ')}`);
      }

      setRawBookingData(aggregatedData);
      setActiveTab('dashboard'); 
    } catch (err: any) {
      setError(err.message || "Failed to parse files. Ensure the format is correct.");
    } finally {
      setLoading(false);
      setLoadingProgress(null);
      event.target.value = ''; 
    }
  };

  const loadFromUrl = async (input: string | { name: string, url: string }[]) => {
    setLoading(true);
    setError(null);
    
    const items = Array.isArray(input) ? input : [{ name: 'Selected Report', url: input }];
    const totalItems = items.length;
    let aggregatedData: RawBookingRow[] = [];
    let failedItems: string[] = [];

    try {
      for (let i = 0; i < totalItems; i++) {
        const item = items[i];
        setLoadingProgress({ current: i + 1, total: totalItems, name: item.name });
        
        const fetchUrl = convertToExportUrl(item.url);
        if (!fetchUrl) {
          failedItems.push(item.name);
          continue;
        }

        try {
          const rawData = await fetchBookingDataFromUrl(fetchUrl);
          aggregatedData = [...aggregatedData, ...rawData];
        } catch (err: any) {
          console.error(`Failed to fetch ${item.name}:`, err);
          failedItems.push(item.name);
        }
      }

      if (aggregatedData.length === 0) {
        throw new Error("Could not retrieve any data. Ensure the Google Sheet is 'Published to the web' (File > Share > Publish to web). Standard 'Share' links will not work due to security restrictions.");
      }

      if (failedItems.length > 0) {
        alert(`Note: The following reports could not be loaded: ${failedItems.join(', ')}. Please ensure they are published to the web.`);
      }

      setRawBookingData(aggregatedData);
      setActiveTab('dashboard');
    } catch (err: any) {
      setError(err.message || "A network error occurred while fetching the data.");
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  };

  const loadAnnualReport = () => {
    if (internationalReports.length === 0) {
      alert("No international reports available in the database to generate an annual report.");
      return;
    }
    
    // Aggregate all available data from Firebase
    const allData = internationalReports.reduce((acc, report) => {
      return [...acc, ...report.data];
    }, [] as RawBookingRow[]);

    setRawBookingData(allData);
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadSelectedPeriod = () => {
    if (toMonthIndex < fromMonthIndex) {
      alert("'To Month' cannot be earlier than 'From Month'.");
      return;
    }

    const selectedMonths = MONTHS.slice(fromMonthIndex, toMonthIndex + 1);
    
    // Find reports in Firebase matching the selected range
    const filteredReports = internationalReports.filter(report => 
      selectedMonths.includes(report.month)
    );

    if (filteredReports.length === 0) {
      alert(`No reports found in the database for the selected period (${MONTHS[fromMonthIndex]} to ${MONTHS[toMonthIndex]}).`);
      return;
    }

    const aggregatedData = filteredReports.reduce((acc, report) => {
      return [...acc, ...report.data];
    }, [] as RawBookingRow[]);

    setRawBookingData(aggregatedData);
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadFromFirestore = (report: InternationalReport) => {
    setRawBookingData(report.data);
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const triggerReupload = () => {
    setRawBookingData([]);
    setError(null);
    setCustomUrl('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hardReload = () => {
    if (confirm("Reset application and clear all data?")) {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <header className="bg-[#CE2029] shadow-md sticky top-0 z-50 transition-all"> 
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <img 
               src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" 
               alt="Emblem of India" 
               className="h-14 w-auto brightness-0 invert"
               referrerPolicy="no-referrer"
             />
             <div className="flex flex-col lg:flex-row lg:items-center gap-0 lg:gap-3">
                <button onClick={hardReload} title="Hard Reload App" className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-[#CE2029] font-black shadow-sm hover:scale-110 transition-transform active:scale-95 text-xl">IP</button>
                <div className="flex flex-col">
                  <h1 className="text-lg font-black text-white tracking-tight leading-tight">Mail Operation 2026-2027</h1>
                  <p className="text-[10px] font-bold text-red-100 uppercase tracking-widest">Dhenkanal Division</p>
                </div>
             </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-6">
             <div className="hidden md:flex items-center gap-1 bg-black/10 p-1 rounded-lg">
                <NavTab active={activeTab === 'datasheet'} onClick={() => setActiveTab('datasheet')} label="Data" icon={<Table size={16}/>}/>
                <NavTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} label="Analysis" icon={<LayoutDashboard size={16}/>}/>
                <NavTab active={activeTab === 'rsbt'} onClick={() => setActiveTab('rsbt')} label="RSBT Cell" icon={<ClipboardList size={16}/>}/>
                <NavTab active={activeTab === 'booking'} onClick={() => setActiveTab('booking')} label="Booking Report" icon={<FileText size={16}/>}/>
                <NavTab active={activeTab === 'target'} onClick={() => setActiveTab('target')} label="Target" icon={<Target size={16}/>}/>
             </div>

             <img 
               src="https://upload.wikimedia.org/wikipedia/en/3/32/India_Post.svg" 
               alt="India Post Logo" 
               className="h-12 w-auto bg-white p-1.5 rounded-xl shadow-inner"
               referrerPolicy="no-referrer"
             />
          </div>
        </div>
        
        {/* Mobile Navigation for smaller screens */}
        <div className="md:hidden bg-[#b01b22] border-t border-red-800 px-4 py-2 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
           <NavTab active={activeTab === 'datasheet'} onClick={() => setActiveTab('datasheet')} label="Data" icon={<Table size={14}/>}/>
           <NavTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} label="Analysis" icon={<LayoutDashboard size={14}/>}/>
           <NavTab active={activeTab === 'rsbt'} onClick={() => setActiveTab('rsbt')} label="RSBT" icon={<ClipboardList size={14}/>}/>
           <NavTab active={activeTab === 'booking'} onClick={() => setActiveTab('booking')} label="Booking" icon={<FileText size={14}/>}/>
           <NavTab active={activeTab === 'target'} onClick={() => setActiveTab('target')} label="Target" icon={<Target size={14}/>}/>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 min-w-[320px]">
              <div className="relative">
                <RefreshCw className="text-[#CE2029] animate-spin" size={48}/>
              </div>
              <div className="text-center">
                <h3 className="font-bold text-[#CE2029] tracking-wider text-lg">Processing Data</h3>
                {loadingProgress && (
                  <div className="mt-2">
                    <p className="text-[#CE2029] font-black text-xs uppercase tracking-widest">{loadingProgress.name}</p>
                    <p className="text-slate-500 text-[10px] mt-1">
                      Report {loadingProgress.current} of {loadingProgress.total}
                    </p>
                  </div>
                )}
              </div>
              {loadingProgress && (
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                  <div 
                    className="bg-[#CE2029] h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        )}

        {rawBookingData.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <div className="bg-white p-0 rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full overflow-hidden">
              <div className="h-2 bg-[#CE2029]"></div>
              <div className="p-8 md:p-10">
                <div className="flex flex-col items-center text-center mb-10">
                    <div className="w-20 h-20 bg-gradient-to-br from-[#CE2029] to-[#991B1B] text-white rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                      <UploadCloud size={40} />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Mail Operation <span className="text-[#CE2029]">2026-2027</span></h2>
                    <p className="text-slate-500 max-w-lg mx-auto font-medium">Dhenkanal Postal Division • Performance Monitoring System</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
                  {/* Annual Report Card */}
                  <button onClick={loadAnnualReport} disabled={loading} className="relative overflow-hidden group rounded-3xl shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#CE2029] to-[#7F1D1D]"></div>
                      <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                        <FileSpreadsheet size={200} />
                      </div>
                      <div className="relative p-8 flex flex-col h-full justify-between min-h-[180px]">
                           <div className="flex justify-between items-start">
                              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                <FileSpreadsheet size={24} className="text-white" />
                              </div>
                              <div className="bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Full Year</span>
                              </div>
                           </div>
                           <div className="text-left mt-4">
                              <h3 className="text-2xl font-black text-white leading-tight">Annual Report<br/>FY 2026-27</h3>
                              <p className="text-white/70 text-sm mt-1 font-medium italic">April 2026 - March 2027</p>
                           </div>
                      </div>
                  </button>

                  {/* Custom Period Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 shadow-inner flex flex-col justify-between">
                      <div className="flex items-center gap-3 mb-6">
                          <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100">
                            <CalendarRange className="text-[#CE2029]" size={20}/>
                          </div>
                          <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm">Custom Range</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">From</label>
                              <select 
                                  value={fromMonthIndex} 
                                  onChange={(e) => setFromMonthIndex(parseInt(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[#CE2029] focus:outline-none appearance-none cursor-pointer"
                              >
                                  {MONTHS.map((m, idx) => (
                                      <option key={m} value={idx}>{m}</option>
                                  ))}
                              </select>
                          </div>
                          <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">To</label>
                              <select 
                                  value={toMonthIndex} 
                                  onChange={(e) => setToMonthIndex(parseInt(e.target.value))}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[#CE2029] focus:outline-none appearance-none cursor-pointer"
                              >
                                  {MONTHS.map((m, idx) => (
                                      <option key={m} value={idx}>{m}</option>
                                  ))}
                              </select>
                          </div>
                      </div>
                      <button 
                          onClick={loadSelectedPeriod} 
                          disabled={loading}
                          className="w-full bg-slate-900 text-white font-black uppercase text-xs tracking-widest py-4 rounded-xl shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                      >
                          Generate Custom Report
                      </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">Monthly Mail Reports</span>
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <button 
                    onClick={() => setShowPortal(true)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-white rounded-lg hover:bg-black transition-all text-[9px] font-black uppercase tracking-widest shadow-md"
                  >
                    <ShieldCheck size={12}/> Admin Portal
                  </button>
                </div>

                {internationalReports.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 mb-8 text-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4">
                      <Globe className="text-slate-300" size={24} />
                    </div>
                    <p className="text-slate-500 font-bold text-sm">No monthly mail reports saved yet.</p>
                    <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mt-1">Visit Admin Portal to upload data</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {internationalReports.map((report) => (
                      <button 
                        key={report.id}
                        onClick={() => loadFromFirestore(report)}
                        className="flex flex-col p-5 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-xl hover:border-blue-500 transition-all text-left group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-3 text-slate-100 group-hover:text-blue-50 group-hover:scale-150 transition-all duration-700">
                          <Globe size={40} />
                        </div>
                        <div className="relative">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Live Data</span>
                          </div>
                          <h4 className="text-lg font-black text-slate-800 leading-tight mb-1">{report.month}</h4>
                          <div className="flex items-center gap-1.5 text-slate-400">
                             <FileText size={12} />
                             <span className="text-[10px] font-bold uppercase">{report.data.length} Records</span>
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">View Analysis</span>
                            <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-colors">
                              <ExternalLink size={14} />
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">Source Data Management</span>
                  <div className="h-px bg-slate-200 flex-1"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  <a 
                    href="https://docs.google.com/spreadsheets/d/15mP3CzQ6M9irA8XTj1I3k2FeIwzpzU6HNxsrUsHwiTA/edit?usp=sharing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-[#CE2029] transition-all group"
                  >
                    <div className="p-3 bg-red-50 rounded-xl text-[#CE2029] group-hover:bg-[#CE2029] group-hover:text-white transition-colors">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-bold text-slate-700">Booking Report 2026-27</span>
                      <span className="block text-[10px] text-slate-400 uppercase font-black tracking-tighter">Click to edit source data</span>
                    </div>
                  </a>
                  <a 
                    href="https://docs.google.com/spreadsheets/d/1A1JBFKd57lQteLAsbtrQmVYLi19RHpngJOhf0G_Bacc/edit?usp=sharing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-[#CE2029] transition-all group"
                  >
                    <div className="p-3 bg-red-50 rounded-xl text-[#CE2029] group-hover:bg-[#CE2029] group-hover:text-white transition-colors">
                      <Target size={20} />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-bold text-slate-700">BD Targets FY 2026-27</span>
                      <span className="block text-[10px] text-slate-400 uppercase font-black tracking-tighter">Click to edit target data</span>
                    </div>
                  </a>
                  <a 
                    href="https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=2034712139#gid=2034712139" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-[#CE2029] transition-all group"
                  >
                    <div className="p-3 bg-red-50 rounded-xl text-[#CE2029] group-hover:bg-[#CE2029] group-hover:text-white transition-colors">
                      <Database size={20} />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm font-bold text-slate-700">Master Data</span>
                      <span className="block text-[10px] text-slate-400 uppercase font-black tracking-tighter">Click to edit office mappings</span>
                    </div>
                  </a>
                </div>

                <div className="mb-4">
                    <label className="cursor-pointer block">
                      <div className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-red-50 hover:border-red-200 transition-all">
                          <UploadCloud size={24} className="text-[#CE2029]"/>
                          <div className="text-left">
                            <span className="block text-sm font-bold text-slate-700">Upload Excel/CSV Files</span>
                            <span className="block text-[10px] text-slate-400 uppercase font-black tracking-tighter">Support multiple files (Max 5)</span>
                          </div>
                          <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" multiple />
                      </div>
                    </label>
                </div>
                
                <div className="flex items-center gap-2 p-1.5 border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden mb-4">
                    <div className="pl-3 text-slate-400"><LinkIcon size={16}/></div>
                    <input 
                      type="text" 
                      value={customUrl} 
                      onChange={(e) => setCustomUrl(e.target.value)} 
                      placeholder="Or paste Google Sheet CSV link here..." 
                      className="flex-1 min-w-0 px-2 py-2.5 text-sm bg-transparent border-none focus:ring-0 text-slate-800 font-medium"
                    />
                    <button 
                      onClick={() => loadFromUrl(customUrl)} 
                      disabled={loading || !customUrl} 
                      className="bg-[#CE2029] text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all hover:bg-red-700 disabled:opacity-50"
                    >
                      LOAD
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <RefreshCw className="text-slate-400" size={16}/>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Synchronization Status</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SyncStatusBadge 
                      label="Master Data" 
                      source={masterDataSource} 
                      isLoading={isMasterDataLoading} 
                      onSync={() => handleSyncMasterData()} 
                    />
                    <SyncStatusBadge 
                      label="Parcel Target" 
                      source={targetDataSource} 
                      isLoading={isTargetDataLoading} 
                      onSync={() => handleSyncTargetData()} 
                    />
                    <SyncStatusBadge 
                      label="Intl Target" 
                      source={internationalTargetSource} 
                      isLoading={isInternationalTargetLoading} 
                      onSync={() => handleSyncInternationalTargetData()} 
                    />
                    <SyncStatusBadge 
                      label="Domestic Target" 
                      source={domesticTargetSource} 
                      isLoading={isDomesticTargetLoading} 
                      onSync={() => handleSyncDomesticTargetData()} 
                    />
                  </div>
                </div>

                {error && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex gap-3">
                      <AlertCircle className="text-[#CE2029] shrink-0" size={20}/>
                      <div>
                        <p className="text-sm font-bold text-[#CE2029]">Connection Error</p>
                        <p className="text-xs text-red-600 mt-1">{error}</p>
                        <div className="mt-3 flex items-start gap-2 p-2 bg-white/60 rounded border border-red-100">
                           <Info size={14} className="text-slate-500 shrink-0 mt-0.5" />
                           <p className="text-[10px] text-slate-600 leading-normal font-medium">
                             <strong>Tip:</strong> Ensure your Google Sheet is <strong>Published to the web</strong> (File &gt; Share &gt; Publish to web) and select <strong>CSV</strong> format. Normal shared links are often blocked by security policies.
                           </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {rawBookingData.length > 0 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {activeTab === 'datasheet' && <DataSheet data={enrichedBookingData} onReupload={triggerReupload} />}
            {activeTab === 'dashboard' && <DashboardAnalysis data={enrichedBookingData} masterData={masterData} onReupload={triggerReupload} />}
            {activeTab === 'rsbt' && <RSBTCellReport data={enrichedBookingData} masterData={masterData} onReupload={triggerReupload} />}
            {activeTab === 'booking' && <BookingReport data={enrichedBookingData} masterData={masterData} onReupload={triggerReupload} />}
            {activeTab === 'target' && (
              <TargetAchievement 
                data={enrichedBookingData} 
                targetData={targetData} 
                internationalTargetData={internationalTargetData}
                domesticTargetData={domesticTargetData}
                masterData={masterData} 
                onReupload={triggerReupload} 
              />
            )}
          </div>
        )}

        {showPortal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
             <InternationalPortal onClose={() => setShowPortal(false)} />
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 mt-auto border-t border-slate-200">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#CE2029]"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              Mail Operation 2026-2027 • Dhenkanal Division
            </p>
            <div className="w-1.5 h-1.5 rounded-full bg-[#CE2029]"></div>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm font-bold text-slate-700">
              Prepared by <span className="text-[#CE2029]">Kalandi Charan Sahoo</span>, OA, DO, Dhenkanal
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const NavTab = ({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
    active ? 'bg-white text-[#CE2029] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
  }`}>
    {icon} <span className="hidden sm:inline">{label}</span>
  </button>
);

const SyncStatusBadge = ({ label, source, isLoading, onSync }: any) => (
  <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
    <div className="flex items-center gap-2 overflow-hidden">
      <span className={`shrink-0 w-2 h-2 rounded-full ${source === 'Synced' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
      <div className="flex flex-col overflow-hidden">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter truncate">{label}</span>
        <span className="text-[10px] font-bold text-slate-700 truncate">{source}</span>
      </div>
    </div>
    <button 
      onClick={onSync} 
      disabled={isLoading}
      className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 disabled:opacity-50"
      title={`Sync ${label}`}
    >
      <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''}/>
    </button>
  </div>
);

export default App;