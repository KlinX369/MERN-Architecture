import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './Auth/Login';
import Register from './Auth/Register';
import OtpVerification from './Auth/OtpVerification';
import ForgotPassword from './Auth/ForgotPassword';

import TestDashboard from './pages/TestDashboard';

import './App.css';

function App() {
  return (
    <Router>
      <Routes>

        {/* Default route redirects to Login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/otp-verification" element={<OtpVerification />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected/Test Page Route */}
        <Route path="/dashboard" element={<TestDashboard />} />

      </Routes>
    </Router>
  );
}

export default App;