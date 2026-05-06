import React, { useMemo, useState } from 'react';
import { BookingDataRow, FilterState } from '../types';
import { formatCurrency, exportToPDF } from '../utils';
import { Search, Printer, UploadCloud } from 'lucide-react';

interface DataSheetProps {
  data: BookingDataRow[];
  onReupload?: () => void;
}

const DataSheet: React.FC<DataSheetProps> = ({ data, onReupload }) => {
  const [filters, setFilters] = useState<FilterState>({
    officeId: '',
    officeName: '',
    productName: ''
  });

  const filteredData = useMemo(() => {
    const filtered = data.filter(row => {
      const matchId = row.officeId.toLowerCase().includes(filters.officeId.toLowerCase());
      const matchName = row.officeName.toLowerCase().includes(filters.officeName.toLowerCase());
      const matchProduct = row.productName.toLowerCase().includes(filters.productName.toLowerCase());
      return matchId && matchName && matchProduct;
    });
    // Sorting in decreasing order of Total Amount
    return filtered.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [data, filters]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      articles: acc.articles + curr.articles,
      postage: acc.postage + curr.postage,
      vas: acc.vas + curr.vas,
      tax: acc.tax + curr.tax,
      totalAmount: acc.totalAmount + curr.totalAmount
    }), { articles: 0, postage: 0, vas: 0, tax: 0, totalAmount: 0 });
  }, [filteredData]);

  const handlePrint = () => {
    const tableData = filteredData.map(row => [
      row.officeId,
      row.officeName,
      row.productName,
      row.articles,
      formatCurrency(row.totalAmount)
    ]);
    
    // Append total row
    tableData.push(['', 'GRAND TOTAL', '', totals.articles, formatCurrency(totals.totalAmount)]);

    exportToPDF(
      ['Office ID', 'Office Name', 'Product Name', 'Articles', 'Total Amount'],
      tableData,
      'Mail Booking Data Sheet',
      false
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative col-span-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Office ID"
            className="pl-10 w-full border border-slate-200 rounded-lg py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50"
            value={filters.officeId}
            onChange={e => setFilters({ ...filters, officeId: e.target.value })}
          />
        </div>
        <div className="relative col-span-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Office Name"
            className="pl-10 w-full border border-slate-200 rounded-lg py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50"
            value={filters.officeName}
            onChange={e => setFilters({ ...filters, officeName: e.target.value })}
          />
        </div>
        <div className="relative col-span-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Product"
            className="pl-10 w-full border border-slate-200 rounded-lg py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-slate-50"
            value={filters.productName}
            onChange={e => setFilters({ ...filters, productName: e.target.value })}
          />
        </div>
        
        <button
          onClick={onReupload}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg border border-blue-500 hover:bg-blue-700 transition-colors text-xs font-bold shadow-md"
        >
          <UploadCloud className="h-4 w-4" /> RE-UPLOAD EXCEL
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 bg-red-700 text-white px-3 py-2 rounded-lg hover:bg-red-800 transition-colors text-xs font-bold"
        >
          <Printer className="h-4 w-4" /> EXPORT PDF
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200">
        <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Office ID</th>
                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Office Name</th>
                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Product Name</th>
                <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Articles</th>
                <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Postage</th>
                <th className="px-6 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Total Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredData.map((row, idx) => (
                <tr key={`${row.officeId}-${idx}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[#CE2029]">{row.officeId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{row.officeName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 italic">{row.productName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 text-right font-bold">{row.articles}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 text-right">{row.postage.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#CE2029] font-black text-right">{formatCurrency(row.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-800 text-white sticky bottom-0 font-black">
              <tr>
                <td colSpan={3} className="px-6 py-4 text-sm text-center tracking-widest uppercase">Grand Total Summary</td>
                <td className="px-6 py-4 text-sm text-right text-lg">{totals.articles}</td>
                <td className="px-6 py-4 text-sm text-right">{totals.postage.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-right text-lg">{formatCurrency(totals.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DataSheet;