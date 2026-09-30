import React, { useState } from 'react';
import { 
  BookOpen, 
  CheckSquare, 
  FileSpreadsheet, 
  Lock, 
  Unlock, 
  Save, 
  UserCheck, 
  UserX, 
  Award 
} from 'lucide-react';

export default function TeacherDashboard({ user = { name: 'Klinton Luka', role: 'teacher' } }) {
  const [activeTab, setActiveTab] = useState('attendance');
  const [attendanceLocked, setAttendanceLocked] = useState(false);

  // Mock class student list
  const [students, setStudents] = useState([
    { id: '101', name: 'Yohana Jamal', regNo: 'ADM-0881', present: true, mark: 84 },
    { id: '102', name: 'Amina Mohamed', regNo: 'ADM-0882', present: true, mark: 91 },
    { id: '103', name: 'Emmanuel Kiprop', regNo: 'ADM-0883', present: false, mark: 72 },
    { id: '104', name: 'Grace Akello', regNo: 'ADM-0884', present: true, mark: 78 },
  ]);

  const toggleAttendance = (id) => {
    if (attendanceLocked) return;
    setStudents(students.map(s => s.id === id ? { ...s, present: !s.present } : s));
  };

  const handleScoreChange = (id, newScore) => {
    const parsed = parseInt(newScore, 10);
    setStudents(students.map(s => s.id === id ? { ...s, mark: isNaN(parsed) ? 0 : parsed } : s));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
              T
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Academic Staff Portal</h1>
              <p className="text-xs text-slate-500">Instructor: {user.name}</p>
            </div>
          </div>

          <nav className="flex gap-2">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'attendance' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CheckSquare size={16} /> Daily Attendance
            </button>
            <button
              onClick={() => setActiveTab('grading')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'grading' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet size={16} /> Mark Entry Engine
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Attendance Manager */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Form 1 Physics - Attendance Register</h2>
                <p className="text-xs text-slate-500 mt-0.5">Toggle daily presence status for registered students.</p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  attendanceLocked ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {attendanceLocked ? <Lock size={12} /> : <Unlock size={12} />}
                  {attendanceLocked ? 'Locked & Finalized' : 'Draft Entry Active'}
                </span>

                <button
                  onClick={() => setAttendanceLocked(!attendanceLocked)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    attendanceLocked 
                      ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {attendanceLocked ? <Unlock size={16} /> : <Lock size={16} />}
                  {attendanceLocked ? 'Unlock Entry' : 'Lock & Lock Register'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {students.map((student) => (
                <div 
                  key={student.id} 
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    student.present 
                      ? 'bg-emerald-50/40 border-emerald-200' 
                      : 'bg-rose-50/40 border-rose-200'
                  }`}
                >
                  <div>
                    <p className="font-bold text-slate-900">{student.name}</p>
                    <p className="text-xs text-slate-500">{student.regNo}</p>
                  </div>

                  <button
                    disabled={attendanceLocked}
                    onClick={() => toggleAttendance(student.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      student.present 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                        : 'bg-rose-600 text-white hover:bg-rose-700'
                    } disabled:opacity-50`}
                  >
                    {student.present ? <UserCheck size={14} /> : <UserX size={14} />}
                    {student.present ? 'Present' : 'Absent'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grading Engine */}
        {activeTab === 'grading' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Term Assessment Entry</h2>
                <p className="text-xs text-slate-500">Record scores for midterm evaluations.</p>
              </div>
              <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
                <Save size={16} /> Save Score Ledger
              </button>
            </div>

            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Reg No</th>
                  <th className="py-3 px-4">Raw Mark (%)</th>
                  <th className="py-3 px-4">Grade Equivalent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const getGrade = (m) => m >= 80 ? 'A' : m >= 70 ? 'B' : m >= 60 ? 'C' : 'D';
                  return (
                    <tr key={student.id}>
                      <td className="py-3 px-4 font-semibold text-slate-800">{student.name}</td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-500">{student.regNo}</td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={student.mark}
                          onChange={(e) => handleScoreChange(student.id, e.target.value)}
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                          min="0"
                          max="100"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded border border-blue-200">
                          {getGrade(student.mark)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}