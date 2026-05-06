import React, { useMemo, useState } from 'react';
import { BookingDataRow, MasterDataRow } from '../types';
import { formatCurrency, exportToPDF, exportToExcel, getProductCategory } from '../utils';
import { FileText, Download, Printer, Search, UploadCloud, Trophy, TrendingUp, Medal, Star, Filter } from 'lucide-react';

interface BookingReportProps {
  data: BookingDataRow[];
  masterData: MasterDataRow[];
  onReupload?: () => void;
}

type OfficeTypeFilter = 'All' | 'P.O' | 'B.O';
type ProductFilter = 'All Type' | 'Domestic Mail' | 'Parcel' | 'International Mail' | 'Inland Speed Post';

const BookingReport: React.FC<BookingReportProps> = ({ data, masterData, onReupload }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [officeTypeFilter, setOfficeTypeFilter] = useState<OfficeTypeFilter>('All');
  const [productFilter, setProductFilter] = useState<ProductFilter>('All Type');
  const [selectedHO, setSelectedHO] = useState<string | null>(null);

  const hoSpeedPostStats = useMemo(() => {
    const stats: Record<string, { articles: number; postage: number; amount: number }> = {
      'Angul H.O': { articles: 0, postage: 0, amount: 0 },
      'Dhenkanal H.O': { articles: 0, postage: 0, amount: 0 }
    };

    // Create a map of officeId to headOfficeName for quick lookup
    const officeToHO = new Map<string, string>();
    masterData.forEach(m => {
      if (m.headOfficeName) {
        officeToHO.set(m.officeId, m.headOfficeName);
      }
    });

    data.forEach(row => {
      const hoName = officeToHO.get(row.officeId);
      if (hoName && (hoName === 'Angul H.O' || hoName === 'Dhenkanal H.O')) {
        const isISP = row.productName.toLowerCase().includes('speed post') && !row.productName.toLowerCase().includes('parcel');
        if (isISP) {
          stats[hoName as keyof typeof stats].articles += row.articles;
          stats[hoName as keyof typeof stats].postage += row.postage;
          stats[hoName as keyof typeof stats].amount += row.totalAmount;
        }
      }
    });

    return stats;
  }, [data, masterData]);

  const reportData = useMemo(() => {
    const officeMap = new Map<string, any>();

    // First, populate with all offices from Master Data to ensure zero-transaction offices are included
    masterData.forEach(m => {
      officeMap.set(m.officeId, {
        officeName: m.officeName,
        officeId: m.officeId,
        officeType: m.officeType || 'Unknown',
        officeJurisdiction: m.officeJurisdiction || 'Unknown Jurisdiction',
        subDivision: m.subDivisionName || 'Unknown Sub-Division',
        domArticles: 0,
        domPostage: 0,
        domAmount: 0,
        parcelArticles: 0,
        parcelPostage: 0,
        parcelAmount: 0,
        intlArticles: 0,
        intlPostage: 0,
        intlAmount: 0,
        // Combined stats for the current filter
        filteredArticles: 0,
        filteredPostage: 0,
        filteredAmount: 0
      });
    });

    // Then update with actual booking data
    data.forEach(row => {
      const stats = officeMap.get(row.officeId);
      if (stats) {
        const cat = getProductCategory(row.productName);
        const isISP = row.productName.toLowerCase().includes('speed post') && !row.productName.toLowerCase().includes('parcel');

        // Track standard categories regardless of filter for the big table
        if (cat === 'Domestic') {
          stats.domArticles += row.articles;
          stats.domPostage += row.postage;
          stats.domAmount += row.totalAmount;
        } else if (cat === 'Parcel') {
          stats.parcelArticles += row.articles;
          stats.parcelPostage += row.postage;
          stats.parcelAmount += row.totalAmount;
        } else if (cat === 'International') {
          stats.intlArticles += row.articles;
          stats.intlPostage += row.postage;
          stats.intlAmount += row.totalAmount;
        }

        // Track specific filtered metrics for Top 10 logic
        let matchesFilter = false;
        if (productFilter === 'All Type') matchesFilter = true;
        else if (productFilter === 'Domestic Mail' && cat === 'Domestic') matchesFilter = true;
        else if (productFilter === 'Parcel' && cat === 'Parcel') matchesFilter = true;
        else if (productFilter === 'International Mail' && cat === 'International') matchesFilter = true;
        else if (productFilter === 'Inland Speed Post' && isISP) matchesFilter = true;

        if (matchesFilter) {
          stats.filteredArticles += row.articles;
          stats.filteredPostage += row.postage;
          stats.filteredAmount += row.totalAmount;
        }
      }
    });

    return Array.from(officeMap.values());
  }, [data, masterData, productFilter]);

  // Derived Top 10 data
  const { top10HOSO, top10BO } = useMemo(() => {
    const hosos = reportData
      .filter(o => o.officeType === 'P.O')
      .sort((a, b) => b.filteredAmount - a.filteredAmount)
      .slice(0, 10);

    const bos = reportData
      .filter(o => o.officeType === 'B.O')
      .sort((a, b) => b.filteredAmount - a.filteredAmount)
      .slice(0, 10);

    return { top10HOSO: hosos, top10BO: bos };
  }, [reportData]);

  // Cumulative Table Filtering logic
  const filteredData = useMemo(() => {
    let filtered = [...reportData];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.officeName.toLowerCase().includes(term) || 
        r.officeId.toLowerCase().includes(term) ||
        r.subDivision.toLowerCase().includes(term)
      );
    }
    
    if (officeTypeFilter !== 'All') {
      filtered = filtered.filter(r => r.officeType === officeTypeFilter);
    }
    
    return filtered.sort((a, b) => {
      const sdComp = a.subDivision.localeCompare(b.subDivision);
      if (sdComp !== 0) return sdComp;
      return a.officeName.localeCompare(b.officeName);
    });
  }, [reportData, searchTerm, officeTypeFilter]);

  const reportTotals = useMemo(() => {
    return filteredData.reduce((acc, r) => ({
      domArticles: acc.domArticles + r.domArticles,
      domPostage: acc.domPostage + r.domPostage,
      domAmount: acc.domAmount + r.domAmount,
      parcelArticles: acc.parcelArticles + r.parcelArticles,
      parcelPostage: acc.parcelPostage + r.parcelPostage,
      parcelAmount: acc.parcelAmount + r.parcelAmount,
      intlArticles: acc.intlArticles + r.intlArticles,
      intlPostage: acc.intlPostage + r.intlPostage,
      intlAmount: acc.intlAmount + r.intlAmount
    }), { 
      domArticles: 0, domPostage: 0, domAmount: 0, 
      parcelArticles: 0, parcelPostage: 0, parcelAmount: 0, 
      intlArticles: 0, intlPostage: 0, intlAmount: 0 
    });
  }, [filteredData]);

  const handleExportTop10 = (list: any[], title: string, format: 'pdf' | 'excel') => {
    const reportTitle = `${title} - ${productFilter}`;
    if (format === 'excel') {
      const excelData = list.map((o, i) => ({
        'Rank': i + 1,
        'Office Name': o.officeName,
        'Office ID': o.officeId,
        'Sub-Division': o.subDivision,
        'Articles': o.filteredArticles,
        'Postage': o.filteredPostage,
        'Revenue': o.filteredAmount
      }));
      exportToExcel(excelData, reportTitle.replace(/\s+/g, '_'));
    } else {
      const headers = ['Rank', 'Office Name', 'Office ID', 'Sub-Division', 'Articles', 'Postage', 'Revenue'];
      const rows = list.map((o, i) => [
        i + 1, o.officeName, o.officeId, o.subDivision, 
        o.filteredArticles, o.filteredPostage.toFixed(2), formatCurrency(o.filteredAmount)
      ]);
      exportToPDF(headers, rows, reportTitle, false);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map((r, i) => ({
      'Sl No': i + 1,
      'Name of the Office': r.officeName,
      'Account Office (Jurisdiction)': r.officeJurisdiction,
      'Sub Division Name': r.subDivision,
      'Office ID': r.officeId,
      'P.O/B.O': r.officeType,
      'Domestic Mail Articles': r.domArticles,
      'Domestic Mail Postage': r.domPostage,
      'Domestic Mail Amount': r.domAmount,
      'Parcel Articles': r.parcelArticles,
      'Parcel Postage': r.parcelPostage,
      'Parcel Amount': r.parcelAmount,
      'International Mail Articles': r.intlArticles,
      'International Mail Postage': r.intlPostage,
      'International Mail Amount': r.intlAmount
    }));
    exportToExcel(exportData, 'Booking_Report_Detailed');
  };

  const handleExportPDF = () => {
    const reportTitle = `Booking Report Detailed (${productFilter} - ${officeTypeFilter})`;
    const headers = [
      'Sl No', 'Office Name', 'Jurisdiction', 'Sub Division', 'Type', 
      'Dom Art', 'Dom Post', 'Dom Amt', 
      'Par Art', 'Par Post', 'Par Amt', 
      'Int Art', 'Int Post', 'Int Amt'
    ];
    const rows = filteredData.map((r, i) => [
      i + 1, r.officeName, r.officeJurisdiction, r.subDivision, r.officeType,
      r.domArticles, r.domPostage.toFixed(2), r.domAmount.toFixed(2),
      r.parcelArticles, r.parcelPostage.toFixed(2), r.parcelAmount.toFixed(2),
      r.intlArticles, r.intlPostage.toFixed(2), r.intlAmount.toFixed(2)
    ]);

    rows.push([
      '', 'GRAND TOTAL', '', '', '',
      reportTotals.domArticles, reportTotals.domPostage.toFixed(2), reportTotals.domAmount.toFixed(2),
      reportTotals.parcelArticles, reportTotals.parcelPostage.toFixed(2), reportTotals.parcelAmount.toFixed(2),
      reportTotals.intlArticles, reportTotals.intlPostage.toFixed(2), reportTotals.intlAmount.toFixed(2)
    ]);

    exportToPDF(headers, rows, reportTitle, false);
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Search & Filter Bar */}
      <section className="bg-white p-6 rounded-2xl shadow-md border border-slate-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex-1">
            <h2 className="text-xl font-black text-[#CE2029] flex items-center gap-2 mb-1">
              <Filter className="text-[#CE2029]" size={20} /> Advanced Search & Filtering
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">Filter by product category or search by Name, ID, or Sub-Division.</p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto items-stretch md:items-end">
             {/* Search Input */}
             <div className="space-y-1.5 flex-1 md:w-64">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Search Office / ID / Sub-Div</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Name, ID or Sub-Division..."
                    className="pl-10 w-full border border-slate-200 rounded-lg py-2 text-sm font-medium focus:ring-2 focus:ring-[#CE2029] focus:outline-none bg-slate-50 shadow-inner"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
             </div>

             {/* Product Category Dropdown */}
             <div className="space-y-1.5 flex-1 md:w-56">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Product Category</label>
                <select
                  value={productFilter}
                  onChange={e => setProductFilter(e.target.value as ProductFilter)}
                  className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-bold focus:ring-2 focus:ring-[#CE2029] focus:outline-none bg-white shadow-sm cursor-pointer"
                >
                  <option value="All Type">All Type</option>
                  <option value="Domestic Mail">Domestic Mail</option>
                  <option value="Parcel">Parcel</option>
                  <option value="International Mail">International Mail</option>
                  <option value="Inland Speed Post">Inland Speed Post</option>
                </select>
             </div>

             {/* Office Level Dropdown */}
             <div className="space-y-1.5 flex-1 md:w-40">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Office Level</label>
                <select
                  value={officeTypeFilter}
                  onChange={e => setOfficeTypeFilter(e.target.value as OfficeTypeFilter)}
                  className="w-full border border-slate-200 rounded-lg py-2 px-3 text-sm font-bold focus:ring-2 focus:ring-[#CE2029] focus:outline-none bg-white shadow-sm cursor-pointer"
                >
                  <option value="All">All Types</option>
                  <option value="P.O">P.Os Only</option>
                  <option value="B.O">B.Os Only</option>
                </select>
             </div>

             <button 
                onClick={onReupload}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-[10px] font-black uppercase shadow-md flex items-center justify-center gap-1.5 h-[38px] min-w-[120px]"
              >
                <UploadCloud size={14}/> RE-UPLOAD
              </button>
          </div>
        </div>
      </section>

      {/* HO Wise Speed Post Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(Object.entries(hoSpeedPostStats) as [string, { articles: number; postage: number; amount: number }][]).map(([hoName, stats]) => (
          <div 
            key={hoName}
            onClick={() => setSelectedHO(selectedHO === hoName ? null : hoName)}
            className={`cursor-pointer p-6 rounded-2xl shadow-md border transition-all duration-300 ${
              selectedHO === hoName 
                ? 'bg-slate-800 border-slate-800 text-white scale-[1.02]' 
                : 'bg-white border-slate-200 hover:border-[#CE2029] hover:shadow-lg'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className={`text-lg font-black ${selectedHO === hoName ? 'text-white' : 'text-[#CE2029]'}`}>
                  {hoName} Speed Post
                </h3>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${selectedHO === hoName ? 'text-slate-400' : 'text-slate-500'}`}>
                  Head Office Summary
                </p>
              </div>
              <div className={`p-2 rounded-lg ${selectedHO === hoName ? 'bg-slate-700' : 'bg-red-50'}`}>
                <TrendingUp className={selectedHO === hoName ? 'text-white' : 'text-[#CE2029]'} size={20} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-400">Articles</p>
                <p className="text-xl font-black">{stats.articles}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-400">Postage</p>
                <p className="text-xl font-black">{stats.postage.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase text-slate-400">Revenue</p>
                <p className={`text-xl font-black ${selectedHO === hoName ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  {formatCurrency(stats.amount)}
                </p>
              </div>
            </div>

            {selectedHO === hoName && (
              <div className="mt-6 pt-6 border-t border-slate-700 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 mb-4">
                  <Star size={14} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold text-slate-300">Detailed performance for {hoName} Jurisdiction</span>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Total Speed Post Booking</span>
                    <span className="font-black text-white">{stats.articles} Articles</span>
                  </div>
                  <div className="h-px bg-slate-700 my-2"></div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Total Postage Collected</span>
                    <span className="font-black text-white">₹{stats.postage.toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-slate-700 my-2"></div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Total Revenue (Amount)</span>
                    <span className="font-black text-emerald-400">{formatCurrency(stats.amount)}</span>
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 mt-3 italic">* Includes all Sub-Offices (SO) and Branch Offices (BO) under {hoName}.</p>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Top 10 High Performers Section */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Trophy className="text-amber-500" size={24}/>
            <h2 className="text-xl font-bold text-[#CE2029]">Top Performers - <span className="text-[#CE2029]">{productFilter}</span></h2>
          </div>
          <div className="flex gap-2">
             <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100 shadow-sm flex items-center gap-1">
               <TrendingUp size={12}/> Based on Revenue
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Top 10 HOs/SOs */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Medal size={16} className="text-blue-500"/> Top 10 HO / SO
              </h3>
              <div className="flex gap-1.5">
                 <button onClick={() => handleExportTop10(top10HOSO, 'Top 10 HO-SO Report', 'excel')} title="Export to Excel" className="p-1.5 bg-green-50 text-green-700 rounded-md border border-green-200 hover:bg-green-100 transition-all shadow-sm">
                   <Download size={12}/>
                 </button>
                 <button onClick={() => handleExportTop10(top10HOSO, 'Top 10 HO-SO Report', 'pdf')} title="Print PDF" className="p-1.5 bg-red-50 text-[#CE2029] rounded-md border border-red-200 hover:bg-red-100 transition-all shadow-sm">
                   <Printer size={12}/>
                 </button>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner">
               <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2 text-center w-10">#</th>
                      <th className="px-3 py-2 text-left">Office Name</th>
                      <th className="px-3 py-2 text-center">Sub-Division</th>
                      <th className="px-3 py-2 text-center">Articles</th>
                      <th className="px-3 py-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {top10HOSO.map((o, i) => (
                      <tr key={o.officeId} className="hover:bg-white transition-colors">
                        <td className="px-3 py-2 text-center">
                          {i === 0 ? <Star size={14} className="text-amber-500 fill-amber-500 inline"/> : i + 1}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-bold text-[#CE2029]">{o.officeName}</div>
                          <div className="text-[9px] text-slate-400 font-mono">{o.officeId}</div>
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600 font-medium">{o.subDivision}</td>
                        <td className="px-3 py-2 text-center font-bold text-blue-600">{o.filteredArticles}</td>
                        <td className="px-3 py-2 text-right font-black text-slate-900">{formatCurrency(o.filteredAmount)}</td>
                      </tr>
                    ))}
                    {top10HOSO.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic">No booking data found for this filter.</td></tr>}
                  </tbody>
               </table>
            </div>
          </div>

          {/* Top 10 BOs */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Medal size={16} className="text-amber-500"/> Top 10 Branch Office
              </h3>
              <div className="flex gap-1.5">
                 <button onClick={() => handleExportTop10(top10BO, 'Top 10 BO Report', 'excel')} title="Export to Excel" className="p-1.5 bg-green-50 text-green-700 rounded-md border border-green-200 hover:bg-green-100 transition-all shadow-sm">
                   <Download size={12}/>
                 </button>
                 <button onClick={() => handleExportTop10(top10BO, 'Top 10 BO Report', 'pdf')} title="Print PDF" className="p-1.5 bg-red-50 text-[#CE2029] rounded-md border border-red-200 hover:bg-red-100 transition-all shadow-sm">
                   <Printer size={12}/>
                 </button>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-inner">
               <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2 text-center w-10">#</th>
                      <th className="px-3 py-2 text-left">Office Name</th>
                      <th className="px-3 py-2 text-center">Sub-Division</th>
                      <th className="px-3 py-2 text-center">Articles</th>
                      <th className="px-3 py-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {top10BO.map((o, i) => (
                      <tr key={o.officeId} className="hover:bg-white transition-colors">
                        <td className="px-3 py-2 text-center">
                          {i === 0 ? <Star size={14} className="text-amber-500 fill-amber-500 inline"/> : i + 1}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-bold text-[#CE2029]">{o.officeName}</div>
                          <div className="text-[9px] text-slate-400 font-mono">{o.officeId}</div>
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600 font-medium">{o.subDivision}</td>
                        <td className="px-3 py-2 text-center font-bold text-emerald-600">{o.filteredArticles}</td>
                        <td className="px-3 py-2 text-right font-black text-slate-900">{formatCurrency(o.filteredAmount)}</td>
                      </tr>
                    ))}
                    {top10BO.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic">No booking data found for this filter.</td></tr>}
                  </tbody>
               </table>
            </div>
          </div>
        </div>
      </section>

      {/* Main Cumulative Report Section */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 flex flex-col min-h-0">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 shrink-0">
          <div>
            <h2 className="text-xl font-black text-[#CE2029] flex items-center gap-2">
              <FileText className="text-[#CE2029]" /> Cumulative Booking Report
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">Hierarchy: Sub-Division A-Z &gt; Office Name A-Z | Filter results via search above.</p>
          </div>
          
          <div className="flex gap-2 self-end xl:self-auto">
            <button onClick={handleExportExcel} title="Export to Excel" className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-all shadow-sm font-bold text-xs">
              <Download size={16} /> EXCEL
            </button>
            <button onClick={handleExportPDF} title="Export to PDF" className="flex items-center gap-2 px-4 py-2 bg-red-50 text-[#CE2029] rounded-lg border border-red-200 hover:bg-red-100 transition-all shadow-sm font-bold text-xs">
              <Printer size={16} /> PRINT PDF
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[65vh] rounded-xl border border-slate-200 flex-1 min-h-0 shadow-inner">
          <div className="min-w-[1800px]">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-800 text-white font-black uppercase tracking-wider sticky top-0 z-10 shadow-md">
                <tr>
                  <th rowSpan={2} className="px-4 py-3 border-r border-slate-700 w-16 text-center">Sl No</th>
                  <th rowSpan={2} className="px-4 py-3 border-r border-slate-700 min-w-[200px]">Name of Office</th>
                  <th rowSpan={2} className="px-4 py-3 border-r border-slate-700 min-w-[200px]">Account Office (Jurisdiction)</th>
                  <th rowSpan={2} className="px-4 py-3 border-r border-slate-700 min-w-[200px]">Sub Division Name</th>
                  <th rowSpan={2} className="px-4 py-3 border-r border-slate-700 text-center">Type</th>
                  <th colSpan={3} className="px-4 py-2 border-r border-slate-700 text-center bg-blue-900/50">Domestic Mail</th>
                  <th colSpan={3} className="px-4 py-2 border-r border-slate-700 text-center bg-amber-900/50">Parcel</th>
                  <th colSpan={3} className="px-4 py-2 text-center bg-purple-900/50">International Mail</th>
                </tr>
                <tr>
                  <th className="px-2 py-2 border-r border-slate-700 text-center bg-blue-900/30">Articles</th>
                  <th className="px-2 py-2 border-r border-slate-700 text-right bg-blue-900/30">Postage</th>
                  <th className="px-2 py-2 border-r border-slate-700 text-right bg-blue-900/40">Amount</th>
                  <th className="px-2 py-2 border-r border-slate-700 text-center bg-amber-900/30">Articles</th>
                  <th className="px-2 py-2 border-r border-slate-700 text-right bg-amber-900/30">Postage</th>
                  <th className="px-2 py-2 border-r border-slate-700 text-right bg-amber-900/40">Amount</th>
                  <th className="px-2 py-2 border-r border-slate-700 text-center bg-purple-900/30">Articles</th>
                  <th className="px-2 py-2 border-r border-slate-700 text-right bg-purple-900/30">Postage</th>
                  <th className="px-2 py-2 text-right bg-purple-900/40">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredData.map((row, idx) => (
                  <tr key={row.officeId} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3 text-slate-400 font-bold border-r border-slate-100">{idx + 1}</td>
                    <td className="px-4 py-3 font-black text-[#CE2029] border-r border-slate-100">{row.officeName}</td>
                    <td className="px-4 py-3 text-slate-600 border-r border-slate-100">{row.officeJurisdiction}</td>
                    <td className="px-4 py-3 text-slate-600 border-r border-slate-100">{row.subDivision}</td>
                    <td className="px-4 py-3 text-center border-r border-slate-100">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${row.officeType === 'B.O' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                        {row.officeType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-blue-700 font-black bg-blue-50/5 border-r border-slate-50">{row.domArticles || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-600 bg-blue-50/5 border-r border-slate-50">{row.domPostage > 0 ? row.domPostage.toFixed(2) : '-'}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900 bg-blue-50/10 border-r border-slate-100">{row.domAmount > 0 ? formatCurrency(row.domAmount) : '-'}</td>
                    <td className="px-4 py-3 text-center text-amber-700 font-black bg-amber-50/5 border-r border-slate-50">{row.parcelArticles || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-600 bg-amber-50/5 border-r border-slate-50">{row.parcelPostage > 0 ? row.parcelPostage.toFixed(2) : '-'}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900 bg-amber-50/10 border-r border-slate-100">{row.parcelAmount > 0 ? formatCurrency(row.parcelAmount) : '-'}</td>
                    <td className="px-4 py-3 text-center text-purple-700 font-black bg-purple-50/5 border-r border-slate-50">{row.intlArticles || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-600 bg-purple-50/5 border-r border-slate-50">{row.intlPostage > 0 ? row.intlPostage.toFixed(2) : '-'}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900 bg-purple-50/10">{row.intlAmount > 0 ? formatCurrency(row.intlAmount) : '-'}</td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-4 py-16 text-center text-slate-400 italic font-medium bg-slate-50">
                      No results found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-800 text-white font-black border-t border-slate-700 sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center tracking-widest text-[10px] uppercase">Grand Totals</td>
                  <td className="px-4 py-4 text-center text-blue-400">{reportTotals.domArticles}</td>
                  <td className="px-4 py-4 text-right text-blue-400">{reportTotals.domPostage.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right text-white">{formatCurrency(reportTotals.domAmount)}</td>
                  <td className="px-4 py-4 text-center text-amber-400">{reportTotals.parcelArticles}</td>
                  <td className="px-4 py-4 text-right text-amber-400">{reportTotals.parcelPostage.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right text-white">{formatCurrency(reportTotals.parcelAmount)}</td>
                  <td className="px-4 py-4 text-center text-purple-400">{reportTotals.intlArticles}</td>
                  <td className="px-4 py-4 text-right text-purple-400">{reportTotals.intlPostage.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right text-white">{formatCurrency(reportTotals.intlAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingReport;