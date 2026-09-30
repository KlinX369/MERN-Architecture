import React, { useState } from 'react';
import { 
  Award, 
  Calendar, 
  FileText, 
  Download, 
  QrCode, 
  CheckCircle2, 
  Clock, 
  BookOpen 
} from 'lucide-react';

export default function StudentDashboard({ 
  student = { name: 'Yohana Jamal', regNo: 'ADM-0881', class: 'Form 1 North', attendanceRate: '96%' } 
}) {
  const [activeTab, setActiveTab] = useState('overview');

  const reportCards = [
    { id: 'RC-2026-T1', term: 'Term 1 Mid-Term 2026', code: 'VERIFY-881-T1', status: 'Verified' },
    { id: 'RC-2025-T3', term: 'Term 3 Final 2025', code: 'VERIFY-881-T3', status: 'Verified' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white pt-8 pb-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold border border-blue-400/30">
              Student Portal
            </span>
            <h1 className="text-3xl font-extrabold mt-2">{student.name}</h1>
            <p className="text-sm text-slate-400 mt-1">{student.class} • Reg: {student.regNo}</p>
          </div>
          <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-right">
            <p className="text-xs text-slate-400">Attendance Aggregate</p>
            <p className="text-2xl font-bold text-emerald-400">{student.attendanceRate}</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-6 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick Academic Summary Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <BookOpen size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Enrolled Courses</h3>
            <p className="text-xs text-slate-500">Mathematics, Physics, Computer Studies, Kiswahili, Chemistry.</p>
          </div>

          {/* Verification Status */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <QrCode size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Digital Verification</h3>
            <p className="text-xs text-slate-500">Official transcripts backed by cryptographic QR stamps.</p>
          </div>

          {/* Schedule Status */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Upcoming Exams</h3>
            <p className="text-xs text-slate-500">National Olympiad Mock Prep starting next Monday.</p>
          </div>
        </div>

        {/* Official Document Downloads */}
        <section className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Verified Report Cards</h2>
              <p className="text-xs text-slate-500">Download authentic, signed A4 term documents.</p>
            </div>
            <Award className="text-slate-400" size={24} />
          </div>

          <div className="space-y-3">
            {reportCards.map((rc) => (
              <div 
                key={rc.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-all bg-slate-50/50 gap-4"
              >
                <div className="flex items-center gap-3">
                  <FileText className="text-blue-600" size={24} />
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{rc.term}</p>
                    <p className="text-xs font-mono text-slate-500">Verification Code: {rc.code}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    <CheckCircle2 size={12} /> {rc.status}
                  </span>
                  <a
                    href={`/verify?code=${rc.code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                  >
                    <Download size={14} /> Download PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}