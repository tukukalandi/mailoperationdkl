import React, { useMemo, useState } from 'react';
import { BookingDataRow, MasterDataRow } from '../types';
import { formatCurrency, exportToPDF, exportToExcel } from '../utils';
import { Landmark, Building2, ChevronRight, ChevronDown, Download, Printer, Search, UploadCloud } from 'lucide-react';

interface HOReportProps {
  data: BookingDataRow[];
  masterData: MasterDataRow[];
  onReupload?: () => void;
}

// Local interface for office stats within the hierarchy
interface GroupedOffice extends MasterDataRow {
  articles: number;
  postage: number;
  amount: number;
}

const HOReport: React.FC<HOReportProps> = ({ data, masterData, onReupload }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedHO, setExpandedHO] = useState<string | null>(null);

  const hoList = ['Angul H.O', 'Dhenkanal H.O'];

  const reportData = useMemo(() => {
    // Map of Head Office -> Map of Account Office (SO) -> List of Offices (SO + BOs)
    const hoMap = new Map<string, Map<string, GroupedOffice[]>>();

    // Initialize map
    hoList.forEach(ho => hoMap.set(ho, new Map<string, GroupedOffice[]>()));

    // Grouping logic
    masterData.forEach(m => {
      const hoName = m.headOfficeName;
      if (!hoMap.has(hoName)) return; // Only track Angul and Dhenkanal

      const hoGroup = hoMap.get(hoName)!;
      const juris = m.officeJurisdiction;

      if (!hoGroup.has(juris)) {
        hoGroup.set(juris, []);
      }
      
      const stats = data
        .filter(d => d.officeId === m.officeId)
        .reduce((acc, curr) => ({
          articles: acc.articles + curr.articles,
          postage: acc.postage + curr.postage,
          amount: acc.amount + curr.totalAmount
        }), { articles: 0, postage: 0, amount: 0 });

      hoGroup.get(juris)!.push({
        ...m,
        ...stats
      });
    });

    return hoMap;
  }, [data, masterData]);

  const toggleHO = (ho: string) => {
    setExpandedHO(expandedHO === ho ? null : ho);
  };

  const exportHOData = (ho: string, format: 'pdf' | 'excel') => {
    const hoGroup = reportData.get(ho);
    if (!hoGroup) return;

    const flatList: GroupedOffice[] = [];
    Array.from(hoGroup.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([juris, offices]) => {
        offices.sort((a, b) => {
          if (a.officeType === 'P.O' && b.officeType === 'B.O') return -1;
          if (a.officeType === 'B.O' && b.officeType === 'P.O') return 1;
          return a.officeName.localeCompare(b.officeName);
        });
        flatList.push(...offices);
      });

    const title = `${ho} - Detailed Hierarchy Report`;
    if (format === 'excel') {
      const excelData = flatList.map((off, idx) => ({
        'Sl No': idx + 1,
        'Head Office': off.headOfficeName,
        'Account Office': off.officeJurisdiction,
        'Office Name': off.officeName,
        'Type': off.officeType,
        'Articles': off.articles,
        'Postage': off.postage,
        'Revenue': off.amount
      }));
      exportToExcel(excelData, title.replace(/\s+/g, '_'));
    } else {
      const headers = ['Sl No', 'Account Office', 'Office Name', 'Type', 'Articles', 'Postage', 'Revenue'];
      const rows = flatList.map((off, idx) => [
        idx + 1,
        off.officeJurisdiction,
        off.officeName,
        off.officeType,
        off.articles,
        off.postage.toFixed(2),
        formatCurrency(off.amount)
      ]);
      const totals = flatList.reduce((acc, curr) => ({
        articles: acc.articles + curr.articles,
        postage: acc.postage + curr.postage,
        amount: acc.amount + curr.amount
      }), { articles: 0, postage: 0, amount: 0 });
      rows.push(['', 'GRAND TOTAL', '', '', totals.articles, totals.postage.toFixed(2), formatCurrency(totals.amount)]);
      exportToPDF(headers, rows, title, false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-[#CE2029] flex items-center gap-2">
            <Landmark className="text-[#CE2029]" /> Head Office (HO) Wise Report
          </h2>
          <p className="text-xs text-slate-500 font-medium">Hierarchy: HO &gt; Account Office (SO) &gt; BOs</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search in HO reports..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 w-full border border-slate-200 rounded-lg py-2 text-sm focus:ring-2 focus:ring-[#CE2029] focus:outline-none bg-slate-50 shadow-inner"
            />
          </div>
          <button onClick={onReupload} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md">
             <UploadCloud size={20}/>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hoList.map(ho => {
          const hoGroup = reportData.get(ho);
          if (!hoGroup) return null;

          // Added explicit cast to GroupedOffice for 'curr' parameter to resolve property access errors on 'unknown' type.
          const hoStats = Array.from(hoGroup.values()).flat().reduce<{ articles: number; postage: number; amount: number; count: number }>((acc, curr: any) => {
            const office = curr as GroupedOffice;
            return {
              articles: acc.articles + office.articles,
              postage: acc.postage + office.postage,
              amount: acc.amount + office.amount,
              count: acc.count + 1
            };
          }, { articles: 0, postage: 0, amount: 0, count: 0 });

          return (
            <div key={ho} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
               <div 
                 onClick={() => toggleHO(ho)}
                 className="p-6 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-center group"
               >
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-[#CE2029] rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                       <Landmark size={24}/>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{ho}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{hoStats.count} Total Offices</p>
                    </div>
                 </div>
                 {expandedHO === ho ? <ChevronDown className="text-slate-400"/> : <ChevronRight className="text-slate-400"/>}
               </div>

               <div className="grid grid-cols-3 border-t border-slate-100 bg-slate-50/50">
                  <StatItem label="Articles" value={hoStats.articles} color="text-blue-700" />
                  <StatItem label="Postage" value={hoStats.postage.toFixed(2)} color="text-amber-700" />
                  <StatItem label="Revenue" value={formatCurrency(hoStats.amount)} color="text-emerald-700" />
               </div>

               {expandedHO === ho && (
                 <div className="flex-1 overflow-hidden flex flex-col p-4 bg-slate-50 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center mb-4">
                       <h4 className="text-xs font-black text-slate-500 uppercase">Hierarchical Breakdown</h4>
                       <div className="flex gap-2">
                          <button onClick={() => exportHOData(ho, 'excel')} className="p-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200 transition-all"><Download size={14}/></button>
                          <button onClick={() => exportHOData(ho, 'pdf')} className="p-1.5 bg-red-50 text-[#CE2029] rounded-lg hover:bg-red-100 border border-red-200 transition-all"><Printer size={14}/></button>
                       </div>
                    </div>
                    
                    <div className="overflow-auto max-h-[500px] custom-scrollbar rounded-xl border border-slate-200 bg-white">
                       <table className="w-full text-xs text-left">
                          <thead className="bg-slate-800 text-white font-black sticky top-0 z-10">
                             <tr>
                                <th className="px-3 py-2 border-r border-slate-700">Jurisdiction (SO)</th>
                                <th className="px-3 py-2 border-r border-slate-700">Office Name</th>
                                <th className="px-3 py-2 text-center border-r border-slate-700">Type</th>
                                <th className="px-3 py-2 text-right">Revenue</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {Array.from(hoGroup.entries())
                               .sort((a, b) => a[0].localeCompare(b[0]))
                               .map(([juris, offices]) => {
                                 const sortedOffices = offices
                                   .filter(o => !searchTerm || o.officeName.toLowerCase().includes(searchTerm.toLowerCase()) || o.officeJurisdiction.toLowerCase().includes(searchTerm.toLowerCase()))
                                   .sort((a, b) => {
                                     if (a.officeType === 'P.O' && b.officeType === 'B.O') return -1;
                                     if (a.officeType === 'B.O' && b.officeType === 'P.O') return 1;
                                     return a.officeName.localeCompare(b.officeName);
                                   });
                                 
                                 if (sortedOffices.length === 0) return null;

                                 return (
                                   <React.Fragment key={juris}>
                                      <tr className="bg-slate-100/50">
                                         <td colSpan={4} className="px-3 py-1.5 font-black text-[#CE2029] text-[9px] uppercase tracking-tighter flex items-center gap-1">
                                            <Building2 size={10}/> {juris}
                                         </td>
                                      </tr>
                                      {sortedOffices.map(off => (
                                        <tr key={off.officeId} className="hover:bg-slate-50 transition-colors group">
                                           <td className="px-3 py-2 text-slate-400 font-medium border-r border-slate-50">{off.officeJurisdiction}</td>
                                           <td className="px-3 py-2 font-bold text-slate-700 border-r border-slate-50">{off.officeName}</td>
                                           <td className="px-3 py-2 text-center border-r border-slate-50">
                                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${off.officeType === 'B.O' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                {off.officeType}
                                              </span>
                                           </td>
                                           <td className="px-3 py-2 text-right font-black text-slate-900 group-hover:text-red-700">
                                              {off.amount > 0 ? formatCurrency(off.amount) : '-'}
                                           </td>
                                        </tr>
                                      ))}
                                   </React.Fragment>
                                 );
                               })}
                          </tbody>
                       </table>
                    </div>
                 </div>
               )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatItem = ({ label, value, color }: { label: string, value: string | number, color: string }) => (
  <div className="p-4 text-center border-r last:border-r-0 border-slate-100">
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
    <div className={`text-sm font-black ${color}`}>{value}</div>
  </div>
);

export default HOReport;
