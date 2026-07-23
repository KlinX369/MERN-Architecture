import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Auth/Login';
import Register from './Auth/Register';
import TestDashboard from './pages/TestDashboard';
import './App.css'; // You can keep your existing CSS file

function App() {
  return (
    <Router>
      <Routes>
        {/* Default route redirects to Login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected/Test Page Route */}
        <Route path="/dashboard" element={<TestDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;