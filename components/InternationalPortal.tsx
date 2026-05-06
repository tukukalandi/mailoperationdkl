import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { parseExcelFile } from '../utils';
import { RawBookingRow, InternationalReport } from '../types';
import { UploadCloud, Save, Loader2, Globe, LogIn, LogOut, CheckCircle2, AlertCircle, Trash2, Download, Eye, Table, ShieldCheck } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const MONTHS = [
  "April 2026", "May 2026", "June 2026", "July 2026", "August 2026", "September 2026",
  "October 2026", "November 2026", "December 2026", "January 2027", "February 2027", "March 2027"
];

interface InternationalPortalProps {
  onClose: () => void;
}

const InternationalPortal: React.FC<InternationalPortalProps> = ({ onClose }) => {
  const [user, setUser] = useState(auth.currentUser);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0]);
  const [uploadedData, setUploadedData] = useState<RawBookingRow[]>([]);
  const [existingReports, setExistingReports] = useState<InternationalReport[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Subscribe to reports for management
  useEffect(() => {
    const q = query(collection(db, "international_reports"), orderBy("month", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports: InternationalReport[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InternationalReport));
      setExistingReports(reports);
    });
    return () => unsubscribe();
  }, []);

  // Auth handler
  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (error) {
      console.error("Sign in failed", error);
      setStatus({ type: 'error', message: 'Authentication failed. Please try again.' });
    }
  };

  const handleSignOut = () => {
    signOut(auth);
    setUser(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatus(null);
    try {
      const data = await parseExcelFile(file);
      setUploadedData(data);
      setStatus({ type: 'success', message: `Parsed ${data.length} records from ${file.name}` });
    } catch (error) {
      console.error("File parse error", error);
      setStatus({ type: 'error', message: 'Failed to parse Excel file. Check format.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      setStatus({ type: 'error', message: 'You must be signed in to save data.' });
      return;
    }
    if (uploadedData.length === 0) {
      setStatus({ type: 'error', message: 'No data to save. Please upload a file first.' });
      return;
    }

    setIsSaving(true);
    setStatus(null);
    try {
      const existing = existingReports.find(r => r.month === selectedMonth);

      if (existing) {
        const path = `international_reports/${existing.id!}`;
        try {
          await updateDoc(doc(db, "international_reports", existing.id!), {
            data: uploadedData,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, path);
        }
        setStatus({ type: 'success', message: `Updated Report for ${selectedMonth}!` });
      } else {
        const path = `international_reports`;
        try {
          await addDoc(collection(db, "international_reports"), {
            month: selectedMonth,
            data: uploadedData,
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, path);
        }
        setStatus({ type: 'success', message: `Saved Report for ${selectedMonth}!` });
      }
      setUploadedData([]);
    } catch (error) {
      console.error("Save failed", error);
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Failed to save to database.' });
    } finally {
      setIsSaving(false);
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; month: string } | null>(null);

  const handleDelete = async (id: string, month: string) => {
    setDeleteConfirm({ id, month });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id, month } = deleteConfirm;
    const path = `international_reports/${id}`;
    
    setIsSaving(true);
    setStatus(null);
    try {
      await deleteDoc(doc(db, "international_reports", id));
      setStatus({ type: 'success', message: `Deleted report for ${month}.` });
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Delete failed", error);
      try {
        handleFirestoreError(error, OperationType.DELETE, path);
      } catch (wrappedError: any) {
        let msg = "Delete failed.";
        try {
          const parsed = JSON.parse(wrappedError.message);
          if (parsed.error.includes("insufficient permissions")) {
            msg = "Permission Denied: You are not authorized to delete this report.";
          }
        } catch (e) {
          msg = wrappedError.message;
        }
        setStatus({ type: 'error', message: msg });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadCSV = (report: InternationalReport) => {
    if (report.data.length === 0) return;
    
    // Explicit headers in the order they are expected during upload
    const headerDisplay = [
      "Office ID", "Office Name", "Product Name", "Articles", "Postage", 
      "VAS", "Tax", "Prepaid FM", "Prepaid PS", "Prepaid SS", "Total Amount", "Avg Weight"
    ];

    const fields: (keyof RawBookingRow)[] = [
      "officeId", "officeName", "productName", "articles", "postage", 
      "vas", "tax", "prepaidFm", "prepaidPs", "prepaidSs", "totalAmount", "avgWeight"
    ];

    const rows = report.data.map(row => 
      fields.map(field => {
        const val = row[field] ?? "";
        // Quote if value contains comma
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val}"`;
        }
        return val;
      }).join(',')
    );

    const csvContent = [headerDisplay.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Monthly_Report_${report.month.replace(' ', '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-w-4xl w-full mx-auto animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
      <div className="bg-slate-900 p-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Globe className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-white font-black uppercase tracking-tight">Monthly Mail Portal</h2>
            <p className="text-blue-300 text-[10px] uppercase font-bold tracking-widest">Internal Management System</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-white/10 p-2 rounded-full">
          <Trash2 size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-6 bg-slate-50 rounded-full mb-6">
              <LogIn className="text-slate-400" size={48} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Internal Access Only</h3>
            <p className="text-slate-500 text-sm max-w-sm mb-8">Please sign in with your authorized Google account to manage monthly mail data.</p>
            <button 
              onClick={handleSignIn}
              className="flex items-center gap-2 bg-[#CE2029] text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-lg active:scale-95"
            >
              Sign In with Google
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {/* User Header */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="flex items-center gap-3">
                  <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{user.displayName}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{user.email}</p>
                  </div>
               </div>
               <button onClick={handleSignOut} className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors font-bold text-[10px] uppercase tracking-widest">
                 Logout <LogOut size={16} />
               </button>
            </div>

            {/* Upload Section */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <UploadCloud className="text-blue-500" size={20} />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Upload New Report</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reporting Month</label>
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Excel/CSV File</label>
                  <label className="cursor-pointer block">
                    <div className="flex items-center justify-center gap-3 px-4 py-3 border border-slate-200 rounded-xl bg-white hover:bg-blue-50 hover:border-blue-200 transition-all">
                      {isUploading ? <Loader2 className="animate-spin text-blue-500" size={18}/> : <Table className="text-blue-500" size={18}/>}
                      <span className="text-sm font-bold text-slate-700">{isUploading ? 'Parsing...' : uploadedData.length > 0 ? 'File Loaded' : 'Select File'}</span>
                    </div>
                    <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
              </div>

              {uploadedData.length > 0 && (
                <div className="mt-4 bg-blue-600 p-4 rounded-xl flex items-center justify-between text-white shadow-lg animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={24} />
                    <div>
                      <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Ready to Save</p>
                      <p className="text-sm font-bold">{uploadedData.length} rows for {selectedMonth}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="bg-white text-blue-600 px-6 py-2 rounded-lg font-black uppercase text-[10px] tracking-[0.2em] hover:bg-blue-50 transition-all flex items-center gap-2 shadow-md"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={14}/> : <Save size={14} />}
                    Finalize & Save
                  </button>
                </div>
              )}
            </section>

            {/* Management Section */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Save className="text-blue-500" size={20} />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Manage Reports</h3>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Month</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Records</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {existingReports.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-slate-400 text-sm font-bold">No reports found in database</td>
                      </tr>
                    ) : (
                      existingReports.map(report => (
                        <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-slate-700">{report.month}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-1 rounded-md">{report.data.length} Rows</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-2">
                               <button 
                                 onClick={() => handleView(report)} 
                                 className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                 title="View Details"
                               >
                                 <Eye size={18} />
                               </button>
                               <button 
                                 onClick={() => handleDownloadCSV(report)} 
                                 className="p-2 text-slate-400 hover:text-green-600 transition-colors"
                                 title="Download CSV"
                               >
                                 <Download size={18} />
                               </button>
                               <button 
                                 onClick={() => handleDelete(report.id!, report.month)} 
                                 className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                 title="Delete"
                               >
                                 <Trash2 size={18} />
                               </button>
                             </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {status && (
              <div className={`p-4 rounded-xl border flex gap-3 animate-in fade-in duration-300 ${status.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                {status.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
                <p className="text-sm font-bold">{status.message}</p>
              </div>
            )}

            {/* Delete Confirmation Modal Overlay */}
            {deleteConfirm && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                    <Trash2 className="text-red-600" size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 text-center mb-2">Delete Report?</h3>
                  <p className="text-slate-500 text-center text-sm mb-8">
                    Are you sure you want to permanently delete the report for <span className="font-bold text-slate-800">{deleteConfirm.month}</span>? This action cannot be undone.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setDeleteConfirm(null)}
                      className="px-6 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={confirmDelete}
                      disabled={isSaving}
                      className="px-6 py-3 rounded-xl bg-red-600 text-white font-bold uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Loader2 className="animate-spin" size={14}/> : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-center gap-2 shrink-0">
        <ShieldCheck className="text-slate-400" size={14} />
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Secured Database Admin Portal • Dhenkanal Division</p>
      </div>
    </div>
  );

  function handleView(report: InternationalReport) {
    setUploadedData(report.data);
    setSelectedMonth(report.month);
    setStatus({ type: 'success', message: `Showing current data for ${report.month} in editor.` });
  }
};

export default InternationalPortal;

