import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user_data') || '{}');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', sans-serif", backgroundColor: '#f8fafc' }}>
      {/* Sidebar Navigation */}
      <aside style={{ width: '260px', backgroundColor: '#064e3b', color: '#fff', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '32px', color: '#34d399' }}>Student Portal</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link to="/student/dashboard" style={navLinkStyleActive}>My Learning</Link>
            <Link to="/student/profile" style={navLinkStyle}>My Profile</Link>
          </nav>
        </div>
        <button onClick={handleLogout} style={logoutButtonStyle}>Logout</button>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '40px' }}>
        <header style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>Student Learning Space</h1>
          <p style={{ color: '#64748b' }}>Welcome, {user.name || 'Student'}</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          <Card title="Enrolled Courses" value="4 Active" badge="In Progress" color="#10b981" />
          <Card title="Assignments" value="2 Due Soon" badge="Upcoming" color="#f59e0b" />
          <Card title="Course Completion" value="78%" badge="Progress" color="#3b82f6" />
        </div>
      </main>
    </div>
  );
}

const Card = ({ title, value, badge, color }) => (
  <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', borderLeft: `5px solid ${color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
    <span style={{ fontSize: '12px', fontWeight: '600', color: color, textTransform: 'uppercase' }}>{badge}</span>
    <h3 style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>{title}</h3>
    <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>{value}</p>
  </div>
);

const navLinkStyle = { color: '#a7f3d0', textDecoration: 'none', padding: '10px 14px', borderRadius: '8px', fontSize: '14px' };
const navLinkStyleActive = { ...navLinkStyle, backgroundColor: '#065f46', color: '#34d399', fontWeight: '600' };
const logoutButtonStyle = { padding: '10px 14px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' };