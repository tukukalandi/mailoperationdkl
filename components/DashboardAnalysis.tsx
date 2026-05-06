import React, { useState, useMemo } from 'react';
import { BookingDataRow, ProductGroup, AnalysisSummary, OfficeSummary, MasterDataRow } from '../types';
import { PRODUCTS } from '../constants';
import { formatCurrency, exportToPDF, exportToExcel, getProductCategory } from '../utils';
import { BarChart, IndianRupee, Package, Globe, FileText, Download, Mail, CheckCircle, Printer, Palette, UploadCloud, ChevronDown, ListFilter, Building2 } from 'lucide-react';

interface DashboardAnalysisProps {
  data: BookingDataRow[];
  masterData: MasterDataRow[];
  onReupload?: () => void;
}

type BookingReportType = 'BO_BOOKED' | 'BO_NOT_BOOKED' | 'PO_BOOKED' | 'PO_NOT_BOOKED';

const PRODUCT_CANONICAL_MAP: Record<string, string> = {
  'indiapost parcel retail': 'India Post Parcel Retail',
  'indiapost parcel retail ': 'India Post Parcel Retail',
  'india post parcel retail': 'India Post Parcel Retail',
  'inland speed post': 'Inland Speed Post',
  'inland speed post document': 'Inland Speed Post Document',
  'registered letter': 'Registered Letter',
  'gyan post': 'Gyan Post',
  'indiapost parcel contractual': 'Indiapost Parcel Contractual',
  'speed post parcel domestic': 'Speed Post Parcel Domestic',
  'international air parcel': 'International Air Parcel',
  'international speed post document': 'International Speed Post Document',
  'international speed post merchandise': 'International Speed Post Merchandise',
  'registered foreign letter': 'Registered Foreign Letter',
  'registered international small packets': 'Registered International Small Packets',
  'international registered letter': 'International Registered Letter'
};

const DashboardAnalysis: React.FC<DashboardAnalysisProps> = ({ data, masterData, onReupload }) => {
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [contextType, setContextType] = useState<'Category' | 'Product' | null>(null);
  const [cardColors, setCardColors] = useState<Record<string, string>>({});
  const [selectedBookingReport, setSelectedBookingReport] = useState<BookingReportType | null>(null);

  const handleColorChange = (key: string, color: string) => {
    setCardColors(prev => ({ ...prev, [key]: color }));
  };

  const enrichedDataWithCanonical = useMemo(() => {
    return data.map(row => {
      const normalizedName = row.productName.toLowerCase().trim();
      const canonicalName = PRODUCT_CANONICAL_MAP[normalizedName] || row.productName;
      return { ...row, canonicalName };
    });
  }, [data]);

  const productStats = useMemo(() => {
    const stats: Record<string, { articles: number; postage: number; revenue: number }> = {};
    PRODUCTS.ALL.forEach(p => stats[p] = { articles: 0, postage: 0, revenue: 0 });

    enrichedDataWithCanonical.forEach(row => {
      if (stats[row.canonicalName]) {
        stats[row.canonicalName].articles += row.articles;
        stats[row.canonicalName].postage += row.postage;
        stats[row.canonicalName].revenue += row.totalAmount;
      }
    });
    return stats;
  }, [enrichedDataWithCanonical]);

  const revenueStats = useMemo(() => {
    const sumForList = (list: string[]) => {
      return list.reduce((acc, p) => {
        const s = productStats[p] || { articles: 0, postage: 0, revenue: 0 };
        return {
          articles: acc.articles + s.articles,
          postage: acc.postage + s.postage,
          revenue: acc.revenue + s.revenue
        };
      }, { articles: 0, postage: 0, revenue: 0 });
    };

    const domestic = sumForList(PRODUCTS.DOMESTIC);
    const parcel = sumForList(PRODUCTS.PARCEL);
    const international = sumForList(PRODUCTS.INTERNATIONAL);

    return {
      total: {
        articles: domestic.articles + parcel.articles + international.articles,
        postage: domestic.postage + parcel.postage + international.postage,
        revenue: domestic.revenue + parcel.revenue + international.revenue
      },
      domestic,
      parcel,
      international
    };
  }, [productStats]);

  const reportData = useMemo(() => {
    if (!selectedContext) return null;

    let filteredData = [];
    if (contextType === 'Category') {
      if (selectedContext === ProductGroup.ALL) {
        filteredData = enrichedDataWithCanonical;
      } else if (selectedContext === ProductGroup.DOMESTIC) {
        filteredData = enrichedDataWithCanonical.filter(d => getProductCategory(d.productName) === 'Domestic');
      } else if (selectedContext === ProductGroup.PARCEL) {
        filteredData = enrichedDataWithCanonical.filter(d => getProductCategory(d.productName) === 'Parcel');
      } else if (selectedContext === ProductGroup.INTERNATIONAL) {
        filteredData = enrichedDataWithCanonical.filter(d => getProductCategory(d.productName) === 'International');
      }
    } else {
      filteredData = enrichedDataWithCanonical.filter(d => d.canonicalName === selectedContext);
    }

    const subDivMap = new Map<string, AnalysisSummary>();
    const jurisdictionMap = new Map<string, any>();
    const poMap = new Map<string, OfficeSummary & { subDivisionName: string; jurisdiction: string }>();

    // Initialize with ALL offices from Master Data
    masterData.forEach(m => {
      if (!poMap.has(m.officeId)) {
        poMap.set(m.officeId, {
          officeName: m.officeName,
          subDivisionName: m.subDivisionName,
          jurisdiction: m.officeJurisdiction,
          articleCount: 0,
          postageAmount: 0,
          totalRevenue: 0
        });
      }
      if (!subDivMap.has(m.subDivisionName)) {
        subDivMap.set(m.subDivisionName, {
          subDivisionName: m.subDivisionName,
          articleCount: 0,
          postageAmount: 0,
          totalRevenue: 0
        });
      }
      if (!jurisdictionMap.has(m.officeJurisdiction)) {
        jurisdictionMap.set(m.officeJurisdiction, {
          name: m.officeJurisdiction,
          articleCount: 0,
          postageAmount: 0,
          totalRevenue: 0
        });
      }
    });

    // Populate stats
    filteredData.forEach(row => {
      const poStats = poMap.get(row.officeId);
      if (poStats) {
        poStats.articleCount += row.articles;
        poStats.postageAmount += row.postage;
        poStats.totalRevenue += row.totalAmount;
      }

      const sdName = row.subDivision || 'Unknown Sub-Division';
      const sdStats = subDivMap.get(sdName);
      if (sdStats) {
        sdStats.articleCount += row.articles;
        sdStats.postageAmount += row.postage;
        sdStats.totalRevenue += row.totalAmount;
      }

      const jurisName = row.officeJurisdiction || 'Unknown Jurisdiction';
      const jurisStats = jurisdictionMap.get(jurisName);
      if (jurisStats) {
        jurisStats.articleCount += row.articles;
        jurisStats.postageAmount += row.postage;
        jurisStats.totalRevenue += row.totalAmount;
      }
    });

    const subDivReport = Array.from(subDivMap.values()).sort((a, b) => a.subDivisionName.localeCompare(b.subDivisionName));
    const jurisdictionReport = Array.from(jurisdictionMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const poReport = Array.from(poMap.values()).sort((a, b) => {
      const sdComp = a.subDivisionName.localeCompare(b.subDivisionName);
      if (sdComp !== 0) return sdComp;
      return a.officeName.localeCompare(b.officeName);
    });

    return { subDivReport, poReport, jurisdictionReport };
  }, [enrichedDataWithCanonical, selectedContext, contextType, masterData]);

  const bookingAnalysisData = useMemo(() => {
    const officeBookingSummary = new Map<string, { articles: number, postage: number, amount: number }>();
    data.forEach(row => {
      const current = officeBookingSummary.get(row.officeId) || { articles: 0, postage: 0, amount: 0 };
      current.articles += row.articles;
      current.postage += row.postage;
      current.amount += row.totalAmount;
      officeBookingSummary.set(row.officeId, current);
    });

    const results = {
      BO_BOOKED: [] as any[],
      BO_NOT_BOOKED: [] as any[],
      PO_BOOKED: [] as any[],
      PO_NOT_BOOKED: [] as any[]
    };

    masterData.forEach(office => {
      const stats = officeBookingSummary.get(office.officeId) || { articles: 0, postage: 0, amount: 0 };
      const isBooked = stats.articles > 0;
      const isBO = office.officeType === 'B.O';
      
      const item = {
        ...office,
        articles: stats.articles,
        postage: stats.postage,
        amount: stats.amount
      };

      if (isBO) {
        if (isBooked) results.BO_BOOKED.push(item);
        else results.BO_NOT_BOOKED.push(item);
      } else {
        if (isBooked) results.PO_BOOKED.push(item);
        else results.PO_NOT_BOOKED.push(item);
      }
    });

    const sorter = (a: any, b: any) => {
      const subComp = a.subDivisionName.localeCompare(b.subDivisionName);
      if (subComp !== 0) return subComp;
      return a.officeName.localeCompare(b.officeName);
    };

    results.BO_BOOKED.sort(sorter);
    results.BO_NOT_BOOKED.sort(sorter);
    results.PO_BOOKED.sort(sorter);
    results.PO_NOT_BOOKED.sort(sorter);

    return results;
  }, [data, masterData]);

  const handleCardClick = (context: string, type: 'Category' | 'Product') => {
    setSelectedContext(context);
    setContextType(type);
    setSelectedBookingReport(null);
    setTimeout(() => {
      document.getElementById('report-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleBookingReportClick = (type: BookingReportType) => {
    setSelectedBookingReport(type);
    setSelectedContext(null);
    setTimeout(() => {
      document.getElementById('booking-detailed-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const exportReport = (type: 'pdf' | 'excel', reportType: 'subdiv' | 'po' | 'jurisdiction') => {
    if (!reportData) return;
    const isSubDiv = reportType === 'subdiv';
    const isJuris = reportType === 'jurisdiction';
    const rawData = isSubDiv ? reportData.subDivReport : (isJuris ? reportData.jurisdictionReport : reportData.poReport);
    const fileName = `${selectedContext} - ${reportType} Alphabetical`;

    if (type === 'excel') {
      const exportData = rawData.map(r => ({
        [isSubDiv ? 'Sub Division' : (isJuris ? 'Account Office' : 'Office Name')]: isSubDiv ? (r as any).subDivisionName : (isJuris ? (r as any).name : (r as any).officeName),
        'No of Articles': r.articleCount,
        'Total Postage': r.postageAmount,
        'Total Revenue': r.totalRevenue
      }));
      exportToExcel(exportData, fileName);
    } else {
      const headers = isSubDiv 
        ? ['Sl No', 'Name of the Sub Division', 'No of Articles Booked', 'Total Postage Amount', 'Total Revenue']
        : (isJuris ? ['Sl No', 'Account Office / Jurisdiction', 'No of Articles Booked', 'Total Postage Amount', 'Total Revenue']
                   : ['Sl No', 'Name of the POs', 'No of Articles Booked', 'Total Postage Amount', 'Total Revenue']);
      
      const rows = rawData.map((row, i) => [
        i + 1,
        isSubDiv ? (row as any).subDivisionName : (isJuris ? (row as any).name : (row as any).officeName),
        row.articleCount,
        formatCurrency(row.postageAmount),
        formatCurrency(row.totalRevenue)
      ]);
      
      const totalArts = rawData.reduce((s, c) => s + c.articleCount, 0);
      const totalPostage = rawData.reduce((s, c) => s + c.postageAmount, 0);
      const totalRevenue = rawData.reduce((s, c) => s + c.totalRevenue, 0);
      rows.push(['', 'TOTAL', totalArts, formatCurrency(totalPostage), formatCurrency(totalRevenue)]);

      exportToPDF(headers, rows, fileName, false);
    }
  };

  const exportBookingReport = (type: 'pdf' | 'excel') => {
    if (!selectedBookingReport) return;
    const list = bookingAnalysisData[selectedBookingReport];
    const titleMap: Record<BookingReportType, string> = {
      BO_BOOKED: 'BOs Booked Report',
      BO_NOT_BOOKED: 'BOs Not Booked Report',
      PO_BOOKED: 'POs Booked Report',
      PO_NOT_BOOKED: 'POs Not Booked Report'
    };
    const title = titleMap[selectedBookingReport];

    if (type === 'excel') {
      const excelData = list.map((r, i) => ({
        'Sl No': i + 1,
        'Name of the Office': r.officeName,
        'Post Office Jurisdiction': r.officeJurisdiction,
        'Sub-Division Name': r.subDivisionName,
        'No of Articles Booked': r.articles,
        'Postage Amount': r.postage,
        'Amount': r.amount
      }));
      exportToExcel(excelData, title);
    } else {
      const headers = ['Sl No', 'Name of the office', 'Post Office jurisdiction', 'Sub-Division Name', 'No of articles Booked', 'Postage Amount', 'Amount'];
      const rows = list.map((r, i) => [
        i + 1,
        r.officeName,
        r.officeJurisdiction,
        r.subDivisionName,
        r.articles,
        r.postage.toFixed(2),
        formatCurrency(r.amount)
      ]);
      const totalArts = list.reduce((s, c) => s + c.articles, 0);
      const totalPostage = list.reduce((s, c) => s + c.postage, 0);
      const totalAmount = list.reduce((s, c) => s + c.amount, 0);
      rows.push(['', 'GRAND TOTAL', '', '', totalArts, totalPostage.toFixed(2), formatCurrency(totalAmount)]);

      exportToPDF(headers, rows, title, false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-xl font-bold text-[#CE2029] flex items-center gap-2">
            <IndianRupee className="text-red-700" /> Revenue Analysis Dashboard
          </h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={onReupload} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-xs font-bold shadow-md">
              <UploadCloud size={14}/> RE-UPLOAD DATA
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <DetailedCard title={ProductGroup.ALL} data={revenueStats.total} icon={<BarChart className="text-red-700" />} colorClass="bg-red-50 border-red-200 hover:border-red-400" active={selectedContext === ProductGroup.ALL} onClick={() => handleCardClick(ProductGroup.ALL, 'Category')} customColor={cardColors[ProductGroup.ALL]} onColorChange={(color: string) => handleColorChange(ProductGroup.ALL, color)} />
          <DetailedCard title={ProductGroup.DOMESTIC} data={revenueStats.domestic} icon={<FileText className="text-emerald-700" />} colorClass="bg-emerald-50 border-emerald-200 hover:border-emerald-400" active={selectedContext === ProductGroup.DOMESTIC} onClick={() => handleCardClick(ProductGroup.DOMESTIC, 'Category')} customColor={cardColors[ProductGroup.DOMESTIC]} onColorChange={(color: string) => handleColorChange(ProductGroup.DOMESTIC, color)} />
          <DetailedCard title={ProductGroup.PARCEL} data={revenueStats.parcel} icon={<Package className="text-amber-700" />} colorClass="bg-amber-50 border-amber-200 hover:border-amber-400" active={selectedContext === ProductGroup.PARCEL} onClick={() => handleCardClick(ProductGroup.PARCEL, 'Category')} customColor={cardColors[ProductGroup.PARCEL]} onColorChange={(color: string) => handleColorChange(ProductGroup.PARCEL, color)} />
          <DetailedCard title={ProductGroup.INTERNATIONAL} data={revenueStats.international} icon={<Globe className="text-blue-700" />} colorClass="bg-blue-50 border-blue-200 hover:border-blue-400" active={selectedContext === ProductGroup.INTERNATIONAL} onClick={() => handleCardClick(ProductGroup.INTERNATIONAL, 'Category')} customColor={cardColors[ProductGroup.INTERNATIONAL]} onColorChange={(color: string) => handleColorChange(ProductGroup.INTERNATIONAL, color)} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-[#CE2029] mb-4 flex items-center gap-2">
          <Mail className="text-red-700" /> Product Performance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {PRODUCTS.ALL.map((product, idx) => (
            <DetailedCard key={product} title={product} data={productStats[product]} icon={null} colorClass={getProductColor(idx)} active={selectedContext === product} onClick={() => handleCardClick(product, 'Product')} compact customColor={cardColors[product]} onColorChange={(color: string) => handleColorChange(product, color)} />
          ))}
        </div>
      </section>

      <div id="report-section" className="space-y-6">
        {selectedContext && reportData && (
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-sm">
             <div className="mb-6 border-b border-slate-200 pb-4">
               <h2 className="text-2xl font-bold text-[#CE2029]">Reports: <span className="text-red-700">{selectedContext}</span></h2>
               <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">Alphabetical Hierarchy Reporting | Zero Articles Included</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
               <ReportTable title="Sub-Division Wise Report" headers={['Sl No', 'Sub Division', 'Articles', 'Postage', 'Revenue']} rows={reportData.subDivReport.map((r, i) => [i+1, r.subDivisionName, r.articleCount, r.postageAmount, r.totalRevenue])} onExportExcel={() => exportReport('excel', 'subdiv')} onExportPDF={() => exportReport('pdf', 'subdiv')} icon={<Building2 size={16}/>} />
               <ReportTable title="Jurisdiction Wise Report" headers={['Sl No', 'Account Office', 'Articles', 'Postage', 'Revenue']} rows={reportData.jurisdictionReport.map((r, i) => [i+1, r.name, r.articleCount, r.postageAmount, r.totalRevenue])} onExportExcel={() => exportReport('excel', 'jurisdiction')} onExportPDF={() => exportReport('pdf', 'jurisdiction')} icon={<Building2 size={16}/>} />
               <ReportTable title="Post Office Wise Report" headers={['Sl No', 'Post Office', 'Articles', 'Postage', 'Revenue']} rows={reportData.poReport.map((r, i) => [i+1, r.officeName, r.articleCount, r.postageAmount, r.totalRevenue])} onExportExcel={() => exportReport('excel', 'po')} onExportPDF={() => exportReport('pdf', 'po')} icon={<Landmark size={16}/>} />
             </div>
          </div>
        )}
      </div>

      <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
         <h2 className="text-xl font-bold text-[#CE2029] mb-6 flex items-center gap-2">
           <CheckCircle className="text-red-700"/> Booking & Non-Booking Analysis
         </h2>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
           <SummaryCountCard label="BOs Booked" value={bookingAnalysisData.BO_BOOKED.length} color="text-green-700" bg="bg-green-50" active={selectedBookingReport === 'BO_BOOKED'} onClick={() => handleBookingReportClick('BO_BOOKED')} />
           <SummaryCountCard label="BOs NOT Booked" value={bookingAnalysisData.BO_NOT_BOOKED.length} color="text-red-700" bg="bg-red-50" active={selectedBookingReport === 'BO_NOT_BOOKED'} onClick={() => handleBookingReportClick('BO_NOT_BOOKED')} />
           <SummaryCountCard label="POs Booked" value={bookingAnalysisData.PO_BOOKED.length} color="text-blue-700" bg="bg-blue-50" active={selectedBookingReport === 'PO_BOOKED'} onClick={() => handleBookingReportClick('PO_BOOKED')} />
           <SummaryCountCard label="POs NOT Booked" value={bookingAnalysisData.PO_NOT_BOOKED.length} color="text-orange-700" bg="bg-orange-50" active={selectedBookingReport === 'PO_NOT_BOOKED'} onClick={() => handleBookingReportClick('PO_NOT_BOOKED')} />
         </div>

          <div id="booking-detailed-section">
            {selectedBookingReport && (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-sm mt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Detailed List: <span className="text-red-700">{selectedBookingReport.replace(/_/g, ' ')}</span></h2>
                    <p className="text-xs text-slate-500 font-medium">Alphabetical Order (Sub-Div &gt; Office Name)</p>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => exportBookingReport('excel')} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded border border-green-200 hover:bg-green-100 transition-colors shadow-sm"><Download size={14}/> EXCEL</button>
                     <button onClick={() => exportBookingReport('pdf')} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 text-xs font-bold rounded border border-red-200 hover:bg-red-100 transition-colors shadow-sm"><Printer size={14}/> PRINT PDF</button>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-inner border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-800 text-white font-black uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 border-r border-slate-700 w-16">Sl No</th>
                          <th className="px-4 py-3 border-r border-slate-700">Name of the Office</th>
                          <th className="px-4 py-3 border-r border-slate-700">Post Office jurisdiction</th>
                          <th className="px-4 py-3 border-r border-slate-700">Sub-Division Name</th>
                          <th className="px-4 py-3 border-r border-slate-700 text-center">No of articles Booked</th>
                          <th className="px-4 py-3 border-r border-slate-700 text-right">Postage Amount</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bookingAnalysisData[selectedBookingReport].map((r, i) => (
                          <React.Fragment key={r.officeId}>
                            {(i === 0 || bookingAnalysisData[selectedBookingReport][i-1].subDivisionName !== r.subDivisionName) && (
                              <tr className="bg-slate-100">
                                <td colSpan={7} className="px-4 py-2 font-black text-[#CE2029] uppercase tracking-tighter text-[10px]">Sub-Division: {r.subDivisionName}</td>
                              </tr>
                            )}
                            <tr className="hover:bg-slate-50 transition-colors group">
                              <td className="px-4 py-3 text-slate-400 font-bold">{i + 1}</td>
                              <td className="px-4 py-3 font-bold text-[#CE2029]">{r.officeName}</td>
                              <td className="px-4 py-3 text-slate-600 italic">{r.officeJurisdiction}</td>
                              <td className="px-4 py-3 text-slate-600 font-medium">{r.subDivisionName}</td>
                              <td className="px-4 py-3 text-center font-black text-slate-700">{r.articles}</td>
                              <td className="px-4 py-3 text-right font-black text-slate-600">{r.postage.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right font-black text-[#CE2029] bg-slate-50/30">{formatCurrency(r.amount)}</td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>
           )}
         </div>
       </section>
    </div>
  );
};

// Internal components like Landmark for icon use
import { Landmark } from 'lucide-react';

const getProductColor = (index: number) => {
  const colors = [
    'bg-red-50 border-red-200 hover:border-red-400',
    'bg-amber-50 border-amber-200 hover:border-amber-400',
    'bg-yellow-50 border-yellow-200 hover:border-yellow-400',
    'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    'bg-sky-50 border-sky-200 hover:border-sky-400',
    'bg-indigo-50 border-indigo-200 hover:border-indigo-400',
    'bg-rose-50 border-rose-200 hover:border-rose-400',
  ];
  return colors[index % colors.length];
};

const SummaryCountCard = ({ label, value, color, bg, active, onClick }: any) => (
  <div onClick={onClick} className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 shadow-sm ${active ? 'ring-2 ring-slate-800 ring-offset-2 border-slate-800 scale-105' : 'border-transparent hover:border-slate-300 hover:shadow-md'} ${bg}`}>
    <div className="flex justify-between items-start mb-1">
      <div className="text-sm font-black text-slate-600 uppercase tracking-tighter">{label}</div>
      <ListFilter size={16} className="text-slate-400" />
    </div>
    <div className={`text-3xl font-black ${color}`}>{value}</div>
    <div className="text-[9px] font-bold text-slate-400 mt-2 uppercase flex items-center gap-1 group">Click to view details <ChevronDown size={10} className="group-hover:translate-y-0.5 transition-transform"/></div>
  </div>
);

const DetailedCard = ({ title, data, icon, colorClass, active, onClick, compact = false, customColor, onColorChange }: any) => {
  const cardStyle = customColor ? { backgroundColor: `${customColor}0D`, borderColor: `${customColor}40` } : {};
  return (
    <div onClick={onClick} style={cardStyle} className={`group relative p-5 rounded-xl border cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md ${active ? 'ring-2 ring-[#CE2029] ring-offset-2 scale-[1.02]' : ''} ${!customColor ? colorClass : ''}`}>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={(e) => e.stopPropagation()}>
         <label className="cursor-pointer p-1.5 rounded-full hover:bg-black/5 block bg-white/50 backdrop-blur-sm border border-black/5 shadow-sm">
             <input type="color" className="sr-only" value={customColor || "#000000"} onChange={(e) => onColorChange && onColorChange(e.target.value)} />
             <Palette size={12} className="text-slate-500" />
         </label>
      </div>
      <div className="flex justify-between items-start mb-3">
        <h3 className={`font-bold text-[#CE2029] leading-tight ${compact ? 'text-xs min-h-[40px]' : 'text-md'}`}>{title}</h3>
        {icon && <div className="p-2 bg-white/50 rounded-lg shadow-sm">{icon}</div>}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm border-b border-black/5 pb-1"><span className="text-slate-600">Articles</span><span className="font-bold text-[#CE2029]">{data.articles}</span></div>
        <div className="flex justify-between items-center text-sm border-b border-black/5 pb-1"><span className="text-slate-600">Postage</span><span className="font-bold text-[#CE2029]">{formatCurrency(data.postage)}</span></div>
        <div className="flex justify-between items-center text-sm pt-1"><span className="text-slate-600 font-medium">Revenue</span><span className="font-bold text-[#CE2029] bg-white/50 px-2 rounded">{formatCurrency(data.revenue)}</span></div>
      </div>
    </div>
  );
};

const ReportTable = ({ title, headers, rows, onExportExcel, onExportPDF, icon }: any) => {
  const totalArts = rows.reduce((s: number, r: any) => s + r[2], 0);
  const totalPostage = rows.reduce((s: number, r: any) => s + r[3], 0);
  const totalRevenue = rows.reduce((s: number, r: any) => s + r[4], 0);
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="font-semibold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
          {icon} {title}
        </h3>
        <div className="flex gap-2">
           <button onClick={onExportExcel} className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-200 hover:bg-green-100 transition-colors"><Download size={14}/> Excel</button>
           <button onClick={onExportPDF} className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 text-xs rounded border border-red-200 hover:bg-red-100 transition-colors"><FileText size={14}/> PDF</button>
        </div>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              {headers.map((h: string, idx: number) => (
                <th key={h} className={`px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider ${idx > 1 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
             {rows.map((row: any, i: number) => (
               <tr key={i} className="hover:bg-slate-50 transition-colors group">
                 <td className="px-4 py-2.5 text-slate-500 w-16">{row[0]}</td>
                 <td className="px-4 py-2.5 font-medium text-slate-800">{row[1]}</td>
                 <td className="px-4 py-2.5 text-right font-medium text-slate-600">{row[2]}</td>
                 <td className="px-4 py-2.5 text-right font-bold text-slate-800">{formatCurrency(row[3])}</td>
                 <td className="px-4 py-2.5 text-right font-bold text-slate-800">{formatCurrency(row[4])}</td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-100 p-4 border-t border-slate-200">
        <div className="flex justify-between items-center text-sm font-bold text-slate-900">
           <span>Total</span>
           <div className="flex gap-6 text-right">
             <div className="flex flex-col"><span className="text-xs text-slate-500 font-normal">Articles</span>{totalArts}</div>
             <div className="flex flex-col"><span className="text-xs text-slate-500 font-normal">Postage</span>{formatCurrency(totalPostage)}</div>
             <div className="flex flex-col"><span className="text-xs text-slate-500 font-normal">Revenue</span>{formatCurrency(totalRevenue)}</div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardAnalysis;