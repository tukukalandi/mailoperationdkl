import React, { useMemo, useState, useRef } from 'react';
import { BookingDataRow, MasterDataRow } from '../types';
import { FileSpreadsheet, Download, Printer, Home, Landmark, Mail, Package, ClipboardList, UploadCloud, MailX, PackageX, Hash } from 'lucide-react';
import { exportToPDF, exportToExcel, getProductCategory, formatCurrency } from '../utils';

interface RSBTCellReportProps {
  data: BookingDataRow[];
  masterData: MasterDataRow[];
  onReupload?: () => void;
}

type MailType = 'All Type' | 'Speed Post' | 'Parcel' | 'International Mail' | 'Gyan Post';
type BookingStatus = 'All' | 'Booked' | 'Not Booked' | 'less than 5 article booked offices' | '5+ articles booked';
type AreaFilter = 'All' | 'Rural' | 'Urban';
type OfficeTypeFilter = 'All' | 'P.O' | 'B.O';

const RSBTCellReport: React.FC<RSBTCellReportProps> = ({ data, masterData, onReupload }) => {
  const [filterType, setFilterType] = useState<MailType>('All Type');
  const [filterSubDiv, setFilterSubDiv] = useState('');
  const [filterArea, setFilterArea] = useState<AreaFilter>('All');
  const [filterOfficeType, setFilterOfficeType] = useState<OfficeTypeFilter>('All');
  const [filterStatus, setFilterStatus] = useState<BookingStatus>('All');
  
  const detailRef = useRef<HTMLDivElement>(null);

  // Count BOs for header display to verify 462 count
  const boCount = useMemo(() => {
    return masterData.filter(m => m.officeType === 'B.O').length;
  }, [masterData]);

  const volumeStats = useMemo<any>(() => {
    const results: any = { Rural: {}, Urban: {}, Total: {} };
    const categories = [
      { id: 'boSpeed', type: 'B.O', targetCat: 'Domestic', isSpeed: true },
      { id: 'boParcel', type: 'B.O', targetCat: 'Parcel' },
      { id: 'poSpeed', type: 'P.O', targetCat: 'Domestic', isSpeed: true },
      { id: 'poParcel', type: 'P.O', targetCat: 'Parcel' },
      { id: 'poIntl', type: 'P.O', targetCat: 'International' },
    ];

    categories.forEach(cat => {
      results.Rural[cat.id] = 0; results.Urban[cat.id] = 0; results.Total[cat.id] = 0;
      data.forEach(row => {
        const rowType = row.officeType === 'B.O' ? 'B.O' : 'P.O';
        const rowCat = getProductCategory(row.productName);
        let isMatch = rowCat === cat.targetCat;
        if (cat.isSpeed && isMatch) isMatch = row.productName.toLowerCase().includes('speed post');
        if (isMatch && rowType === cat.type) {
          const area = row.areaType?.toLowerCase().includes('urban') ? 'Urban' : 'Rural';
          results[area][cat.id] += row.articles;
          results.Total[cat.id] += row.articles;
        }
      });
    });
    return results;
  }, [data]);

  const performanceStats = useMemo(() => {
    const stats = {
      bo: { total: 0, bookedSP: 0, bookedPar: 0, notBookedSP: 0, notBookedPar: 0 },
      po: { total: 0, bookedSP: 0, bookedPar: 0, notBookedSP: 0, notBookedPar: 0 },
    };

    const officePerf = new Map<string, { spArts: number, spAmt: number, parArts: number, parAmt: number }>();

    data.forEach(row => {
      const cat = getProductCategory(row.productName);
      const isSP = cat === 'Domestic' && row.productName.toLowerCase().includes('speed post');
      const isPar = cat === 'Parcel';
      
      const current = officePerf.get(row.officeId) || { spArts: 0, spAmt: 0, parArts: 0, parAmt: 0 };
      if (isSP) {
        current.spArts += row.articles;
        current.spAmt += row.totalAmount;
      }
      if (isPar) {
        current.parArts += row.articles;
        current.parAmt += row.totalAmount;
      }
      officePerf.set(row.officeId, current);
    });

    masterData.forEach(m => {
      const isBO = m.officeType === 'B.O';
      const p = officePerf.get(m.officeId) || { spArts: 0, spAmt: 0, parArts: 0, parAmt: 0 };
      const hasSP = p.spArts > 0 && p.spAmt > 0;
      const hasPar = p.parArts > 0 && p.parAmt > 0;

      if (isBO) {
        stats.bo.total++;
        if (hasSP) stats.bo.bookedSP++; else stats.bo.notBookedSP++;
        if (hasPar) stats.bo.bookedPar++; else stats.bo.notBookedPar++;
      } else {
        stats.po.total++;
        if (hasSP) stats.po.bookedSP++; else stats.po.notBookedSP++;
        if (hasPar) stats.po.bookedPar++; else stats.po.notBookedPar++;
      }
    });
    return stats;
  }, [data, masterData]);

  const detailedReportList = useMemo(() => {
    const typeBookings = data.filter(r => {
      if (filterType === 'All Type') return true;
      const cat = getProductCategory(r.productName);
      if (filterType === 'Speed Post') return cat === 'Domestic' && r.productName.toLowerCase().includes('speed post');
      if (filterType === 'Gyan Post') return cat === 'Domestic' && r.productName.toLowerCase().includes('gyan post');
      if (filterType === 'Parcel') return cat === 'Parcel';
      return cat === 'International';
    });

    const bookingMap = new Map<string, { articles: number, postage: number, amount: number }>();
    typeBookings.forEach(b => {
      const current = bookingMap.get(b.officeId) || { articles: 0, postage: 0, amount: 0 };
      current.articles += b.articles;
      current.postage += b.postage;
      current.amount += b.totalAmount;
      bookingMap.set(b.officeId, current);
    });

    const filtered = masterData
      .map(office => {
        const booking = bookingMap.get(office.officeId);
        return {
          ...office,
          articles: booking ? booking.articles : 0,
          postage: booking ? booking.postage : 0,
          amount: booking ? booking.amount : 0,
          isActuallyBooked: booking ? (booking.articles > 0 && booking.amount > 0) : false
        };
      })
      .filter(office => {
        if (filterSubDiv && !office.subDivisionName.toLowerCase().includes(filterSubDiv.toLowerCase())) return false;
        if (filterArea !== 'All' && office.areaType !== filterArea) return false;
        if (filterOfficeType !== 'All' && office.officeType !== filterOfficeType) return false;
        if (filterStatus === 'Booked' && !office.isActuallyBooked) return false;
        if (filterStatus === 'Not Booked' && office.isActuallyBooked) return false;
        if (filterStatus === 'less than 5 article booked offices' && (!office.isActuallyBooked || office.articles >= 5)) return false;
        if (filterStatus === '5+ articles booked' && (!office.isActuallyBooked || office.articles < 5)) return false;
        return true;
      });

    return filtered.sort((a, b) => {
      const sdComp = a.subDivisionName.localeCompare(b.subDivisionName);
      if (sdComp !== 0) return sdComp;
      return a.officeName.localeCompare(b.officeName);
    });
  }, [masterData, data, filterType, filterSubDiv, filterArea, filterOfficeType, filterStatus]);

  const handleQuickAction = (type: MailType, status: BookingStatus, officeType: OfficeTypeFilter) => {
    setFilterType(type);
    setFilterStatus(status);
    setFilterOfficeType(officeType);
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const exportReport = (format: 'pdf' | 'excel') => {
    const statusText = filterStatus === 'All' ? 'All Status' : 
                      filterStatus === 'less than 5 article booked offices' ? 'Less than 5 Articles' :
                      filterStatus === '5+ articles booked' ? '5+ Articles Booked' : filterStatus;
    
    const reportTitle = `RSBT Cell Detailed Monitoring Report - ${filterType} (${statusText})`;
    const headers = ['Sl No', 'Office Name', 'Office ID', 'Sub-Division', 'Type', 'Status', 'Number', 'Postage', 'Amount'];
    
    const getStatusLabel = (articles: number) => {
      if (articles === 0) return 'Not Booked';
      if (articles < 5) return 'Less than 5';
      return '5+ Booked';
    };

    const rows: any[] = detailedReportList.map((row, i) => [
      i + 1,
      row.officeName,
      row.officeId,
      row.subDivisionName,
      row.officeType,
      getStatusLabel(row.articles),
      row.articles,
      row.postage.toFixed(2),
      row.amount.toFixed(2)
    ]);

    const totalArticles = detailedReportList.reduce((acc, r) => acc + r.articles, 0);
    const totalPostage = detailedReportList.reduce((acc, r) => acc + r.postage, 0);
    const totalAmount = detailedReportList.reduce((acc, r) => acc + r.amount, 0);

    if (format === 'excel') {
      const excelData = detailedReportList.map((row, i) => ({
        'Sl No': i + 1,
        'Name of the Office': row.officeName,
        'Office ID': row.officeId,
        'Sub-Division Name': row.subDivisionName,
        'Office Type': row.officeType,
        'Status': getStatusLabel(row.articles),
        'Number': row.articles,
        'Postage': row.postage,
        'Amount': row.amount
      }));
      excelData.push({
        'Sl No': '', 'Name of the Office': 'GRAND TOTAL', 'Office ID': '', 'Sub-Division Name': '', 'Office Type': '', 'Status': '',
        'Number': totalArticles, 'Postage': totalPostage, 'Amount': totalAmount
      } as any);
      exportToExcel(excelData, reportTitle.replace(/\s+/g, '_'));
    } else {
      rows.push(['', 'GRAND TOTAL', '', '', '', '', totalArticles, totalPostage.toFixed(2), totalAmount.toFixed(2)]);
      exportToPDF(headers, rows, reportTitle, false);
    }
  };

  const getSubDivisions = useMemo(() => {
    return Array.from(new Set(masterData.map(m => m.subDivisionName))).sort();
  }, [masterData]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center mb-2 px-2">
         <div className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-md border-b-2 border-red-600">
            <Hash size={18} className="text-red-400"/>
            <span className="text-xs font-black uppercase tracking-widest">Total Branch Offices: <span className="text-red-400 text-base ml-1">{boCount}</span></span>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-[#CE2029] mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg"><Home size={18}/></div>
            Branch Office (BO) Performance
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <QuickStatButton label="SP Booked" value={performanceStats.bo.bookedSP} total={performanceStats.bo.total} icon={<Mail size={16}/>} color="emerald" onClick={() => handleQuickAction('Speed Post', 'Booked', 'B.O')}/>
            <QuickStatButton label="SP Not Booked" value={performanceStats.bo.notBookedSP} total={performanceStats.bo.total} icon={<MailX size={16}/>} color="rose" onClick={() => handleQuickAction('Speed Post', 'Not Booked', 'B.O')}/>
            <QuickStatButton label="Parcel Booked" value={performanceStats.bo.bookedPar} total={performanceStats.bo.total} icon={<Package size={16}/>} color="amber" onClick={() => handleQuickAction('Parcel', 'Booked', 'B.O')}/>
            <QuickStatButton label="Parcel Not Booked" value={performanceStats.bo.notBookedPar} total={performanceStats.bo.total} icon={<PackageX size={16}/>} color="rose" onClick={() => handleQuickAction('Parcel', 'Not Booked', 'B.O')}/>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-[#CE2029] mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Landmark size={18}/></div>
            Sub Office / PO Performance
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <QuickStatButton label="SP Booked" value={performanceStats.po.bookedSP} total={performanceStats.po.total} icon={<Mail size={16}/>} color="blue" onClick={() => handleQuickAction('Speed Post', 'Booked', 'P.O')}/>
            <QuickStatButton label="SP Not Booked" value={performanceStats.po.notBookedSP} total={performanceStats.po.total} icon={<MailX size={16}/>} color="rose" onClick={() => handleQuickAction('Speed Post', 'Not Booked', 'P.O')}/>
            <QuickStatButton label="Parcel Booked" value={performanceStats.po.bookedPar} total={performanceStats.po.total} icon={<Package size={16}/>} color="amber" onClick={() => handleQuickAction('Parcel', 'Booked', 'P.O')}/>
            <QuickStatButton label="Parcel Not Booked" value={performanceStats.po.notBookedPar} total={performanceStats.po.total} icon={<PackageX size={16}/>} color="rose" onClick={() => handleQuickAction('Parcel', 'Not Booked', 'P.O')}/>
          </div>
        </div>
      </div>

      <div ref={detailRef} className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-[#CE2029] flex items-center gap-2">
              <ClipboardList className="text-[#CE2029]" /> Detailed Monitoring Dashboard
            </h2>
            <p className="text-[11px] text-slate-500 font-medium italic">Colorful Performance Tracking (Sub-Division A-Z)</p>
          </div>
          <div className="flex gap-2 flex-wrap">
             <button onClick={onReupload} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs font-bold shadow-md">
               <UploadCloud size={14}/> RE-UPLOAD
             </button>
             <button onClick={() => exportReport('excel')} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-all text-xs font-bold">
               <Download size={14}/> EXCEL
             </button>
             <button onClick={() => exportReport('pdf')} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-[#CE2029] rounded-lg border border-red-200 hover:bg-red-100 transition-all text-xs font-bold">
               <Printer size={14}/> PRINT REPORT
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-red-50/30 rounded-xl border border-red-100 shadow-inner">
           <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">1. Sub-Division</label>
              <select value={filterSubDiv} onChange={e => setFilterSubDiv(e.target.value)} className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs font-bold outline-none shadow-sm">
                <option value="">All Sub-Divisions</option>
                {getSubDivisions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
           </div>
           
           <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">2. Rural/Urban</label>
              <select value={filterArea} onChange={e => setFilterArea(e.target.value as AreaFilter)} className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs font-bold outline-none shadow-sm">
                <option value="All">All Areas</option>
                <option value="Rural">Rural</option>
                <option value="Urban">Urban</option>
              </select>
           </div>
           
           <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">3. Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as BookingStatus)} className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs font-bold outline-none shadow-sm">
                <option value="All">All Status</option>
                <option value="Booked">Booked</option>
                <option value="Not Booked">Not Booked</option>
                <option value="less than 5 article booked offices">Less than 5</option>
                <option value="5+ articles booked">5+ Booked</option>
              </select>
           </div>

           <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">4. Mail Type</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value as MailType)} className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs font-bold outline-none shadow-sm">
                <option value="All Type">All Type</option>
                <option value="Speed Post">Speed Post</option>
                <option value="Parcel">Parcel</option>
                <option value="Gyan Post">Gyan Post</option>
                <option value="International Mail">International</option>
              </select>
           </div>

           <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400">5. PO/BO</label>
              <select value={filterOfficeType} onChange={e => setFilterOfficeType(e.target.value as OfficeTypeFilter)} className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs font-bold outline-none shadow-sm">
                <option value="All">All Types</option>
                <option value="P.O">P.O Only</option>
                <option value="B.O">B.O Only</option>
              </select>
           </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-inner">
           <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
             <table className="w-full text-xs text-left">
               <thead className="bg-[#CE2029] text-white font-black uppercase tracking-wider sticky top-0 z-10">
                 <tr>
                    <th className="px-4 py-3 border-r border-red-800/50 w-16 text-center">Sl No</th>
                    <th className="px-4 py-3 border-r border-red-800/50">Office Name</th>
                    <th className="px-4 py-3 border-r border-red-800/50">Office ID</th>
                    <th className="px-4 py-3 border-r border-red-800/50">Sub-Division Name</th>
                    <th className="px-4 py-3 border-r border-red-800/50 text-center">Type</th>
                    <th className="px-4 py-3 border-r border-red-800/50 text-center">Number</th>
                    <th className="px-4 py-3 border-r border-red-800/50 text-right">Postage</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-red-100 bg-white">
                 {detailedReportList.map((row, idx) => (
                   <tr key={row.officeId} className="even:bg-red-50/40 hover:bg-red-100/30 transition-colors">
                     <td className="px-4 py-3 text-slate-400 font-bold text-center">{idx + 1}</td>
                     <td className="px-4 py-3 font-bold text-slate-800">{row.officeName}</td>
                     <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{row.officeId}</td>
                     <td className="px-4 py-3 text-slate-600 font-medium">{row.subDivisionName}</td>
                     <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${row.officeType === 'B.O' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                          {row.officeType}
                        </span>
                     </td>
                     <td className={`px-4 py-3 text-center font-black ${row.articles > 0 ? (row.articles < 5 ? 'text-orange-600' : 'text-blue-700') : 'text-red-200'}`}>
                        {row.articles}
                     </td>
                     <td className="px-4 py-3 text-right font-black text-slate-800">
                        {row.postage > 0 ? row.postage.toFixed(2) : '-'}
                     </td>
                     <td className={`px-4 py-3 text-right font-black ${row.amount > 0 ? 'text-slate-900' : 'text-red-400'}`}>
                        {row.amount > 0 ? formatCurrency(row.amount) : '0.00'}
                     </td>
                   </tr>
                 ))}
               </tbody>
               <tfoot className="bg-[#CE2029] text-white font-black sticky bottom-0 z-10 border-t border-red-800 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                  <tr>
                     <td colSpan={5} className="px-4 py-4 text-center text-[10px] tracking-widest uppercase">Page Total</td>
                     <td className="px-4 py-4 text-center text-base">{detailedReportList.reduce((acc, r) => acc + r.articles, 0)}</td>
                     <td className="px-4 py-4 text-right text-base">{detailedReportList.reduce((acc, r) => acc + r.postage, 0).toFixed(2)}</td>
                     <td className="px-4 py-4 text-right text-base">{formatCurrency(detailedReportList.reduce((acc, r) => acc + r.amount, 0))}</td>
                  </tr>
               </tfoot>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
};

const FilterItem = ({ label, value, onChange, list }: any) => (
  <div className="space-y-1">
    <label className="text-[9px] font-black uppercase text-slate-400">{label}</label>
    <input type="text" value={value} onChange={e => onChange(e.target.value)} list={list} className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs font-bold outline-none shadow-sm"/>
  </div>
);

const QuickStatButton = ({ label, value, total, icon, onClick, color = 'blue' }: any) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const colorMap: any = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
  };
  const theme = colorMap[color] || colorMap.blue;
  return (
    <button onClick={onClick} className={`group w-full p-4 rounded-xl border transition-all flex flex-col items-center justify-center text-center gap-1 hover:shadow-md hover:scale-[1.02] active:scale-95 ${theme}`}>
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter">{icon} {label}</div>
      <div className="text-xl font-black">{value} <span className="text-[10px] opacity-60 font-medium">/ {total}</span></div>
      <div className="w-full h-1 bg-black/5 rounded-full mt-2 overflow-hidden">
        <div className={`h-full opacity-80 transition-all duration-700 bg-current`} style={{ width: `${percentage}%` }}></div>
      </div>
    </button>
  );
};

export default RSBTCellReport;
