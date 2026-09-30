import React, { useState } from 'react';
import { 
  Users, 
  Activity, 
  Wallet, 
  FileBadge, 
  Download, 
  CheckCircle2, 
  CreditCard,
  Calendar,
  Clock,
  ShieldCheck
} from 'lucide-react';

export default function ParentDashboard({ user = { name: 'Parent/Guardian' } }) {
  // Mock data for multiple dependents
  const dependents = [
    {
      id: 'student_1',
      name: 'Yohana Jamal',
      regNo: 'ADM-0881',
      class: 'Form 1 North',
      attendance: '96%',
      status: 'Present Today',
      feesBalance: 12500,
      documents: [
        { id: 'RC-2026-T1', name: 'Term 1 Mid-Term Report', code: 'VERIFY-881-T1', date: 'Mar 15, 2026' }
      ]
    },
    {
      id: 'student_2',
      name: 'Amina Mohamed',
      regNo: 'ADM-0882',
      class: 'Form 2 East',
      attendance: '100%',
      status: 'Present Today',
      feesBalance: 0,
      documents: [
        { id: 'RC-2026-T1-A', name: 'Term 1 Mid-Term Report', code: 'VERIFY-882-T1', date: 'Mar 15, 2026' },
        { id: 'RC-2025-T3-A', name: 'Term 3 Final Report', code: 'VERIFY-882-T3', date: 'Nov 20, 2025' }
      ]
    }
  ];

  const [activeChildId, setActiveChildId] = useState(dependents[0].id);
  const activeChild = dependents.find(d => d.id === activeChildId);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white pt-8 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-lg">
              <Users size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Guardian Portal</h1>
              <p className="text-xs text-slate-400">Welcome, {user.name}</p>
            </div>
          </div>

          {/* Child Selector */}
          <div className="flex flex-wrap gap-3">
            {dependents.map(child => (
              <button
                key={child.id}
                onClick={() => setActiveChildId(child.id)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all border ${
                  activeChildId === child.id 
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md' 
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {child.name}
              </button>
            ))}
            <button className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all border border-slate-700 border-dashed text-slate-400 hover:text-slate-200 hover:bg-slate-800">
              + Link Another Child
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-6 -mt-8 space-y-6">
        
        {/* Child Header Info */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{activeChild.name}</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {activeChild.class} • Reg: {activeChild.regNo}
            </p>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
            <ShieldCheck size={14} /> Active Enrollment
          </span>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Attendance Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Activity size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Live Attendance</h3>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{activeChild.attendance}</p>
            <p className="text-sm font-medium text-emerald-600 mt-1 flex items-center gap-1">
              <CheckCircle2 size={14} /> {activeChild.status}
            </p>
          </div>

          {/* Financial Ledger Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <Wallet size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Financial Ledger</h3>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">
              <span className="text-lg text-slate-500 mr-1">KES</span>
              {activeChild.feesBalance.toLocaleString()}
            </p>
            <p className={`text-sm font-medium mt-1 ${activeChild.feesBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {activeChild.feesBalance > 0 ? 'Outstanding Balance' : 'Fully Cleared'}
            </p>
            {activeChild.feesBalance > 0 && (
              <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors">
                <CreditCard size={14} /> Make Payment
              </button>
            )}
          </div>
        </div>

        {/* Official Documents Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
            <FileBadge className="text-blue-600" size={20} />
            <div>
              <h3 className="font-bold text-slate-900">Official Academic Records</h3>
              <p className="text-xs text-slate-500">Electronically signed documents with QR verification.</p>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {activeChild.documents.map(doc => (
              <div key={doc.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg border border-slate-200">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{doc.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Issued: {doc.date}</p>
                    <p className="text-xs font-mono text-slate-400 mt-1">Ref: {doc.code}</p>
                  </div>
                </div>
                
                <a
                  href={`/verify?code=${doc.code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:border-blue-400 hover:text-blue-700 transition-colors shadow-sm"
                >
                  <Download size={16} /> Download A4 PDF
                </a>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}