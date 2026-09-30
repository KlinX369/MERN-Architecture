import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user_data') || '{}');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', sans-serif", backgroundColor: '#f8fafc' }}>
      {/* Sidebar Navigation */}
      <aside style={{ width: '260px', backgroundColor: '#0f172a', color: '#fff', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '32px', color: '#38bdf8' }}>Admin Portal</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link to="/admin/dashboard" style={navLinkStyleActive}>Dashboard Overview</Link>
            <Link to="/admin/users" style={navLinkStyle}>User Management</Link>
            <Link to="/courses/manage" style={navLinkStyle}>System Courses</Link>
            <Link to="/student/profile" style={navLinkStyle}>Profile View</Link>
          </nav>
        </div>
        <button onClick={handleLogout} style={logoutButtonStyle}>Logout</button>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '40px' }}>
        <header style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>System Administration</h1>
          <p style={{ color: '#64748b' }}>Welcome back, {user.name || 'Admin'} ({user.email})</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          <Card title="Total Users" value="1,248" badge="Active" color="#3b82f6" />
          <Card title="System Roles" value="3 Roles" badge="Configured" color="#8b5cf6" />
          <Card title="Security Status" value="RBAC Active" badge="Secured" color="#10b981" />
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

const navLinkStyle = { color: '#94a3b8', textDecoration: 'none', padding: '10px 14px', borderRadius: '8px', fontSize: '14px' };
const navLinkStyleActive = { ...navLinkStyle, backgroundColor: '#1e293b', color: '#38bdf8', fontWeight: '600' };
const logoutButtonStyle = { padding: '10px 14px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' };