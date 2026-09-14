import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

export default function OtpVerification() {
  const [otp, setOtp] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Retrieve the email passed from the Login page
  const email = location.state?.email;

  useEffect(() => {
    // If someone navigates to /otp-verification directly without logging in, send them back
    if (!email) {
      navigate('/login');
    }
  }, [email, navigate]);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        alert("Login successful!");
        navigate('/dashboard'); // Route to your protected app area
      } else {
        alert(`Verification failed: ${data.error || 'Invalid code'}`);
      }
    } catch (error) {
      alert("Could not connect to the server.");
    }
  };

  if (!email) return null; // Prevent flicker before redirect

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '40px', width: '100%',
        maxWidth: '440px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid #F3F4F6', textAlign: 'center', boxSizing: 'border-box'
      }}>
        
        <div style={{
          width: '48px', height: '48px', backgroundColor: '#EFF6FF', borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: '#2563EB'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>Enter 2FA Code</h2>
        <p style={{ fontSize: '15px', color: '#6B7280', margin: '0 0 28px 0' }}>
          We sent a 6-digit code to <br/><strong>{email}</strong>
        </p>

        <form onSubmit={handleVerifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input 
            type="text" 
            placeholder="123456" 
            value={otp} 
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} // Restrict to numbers
            maxLength="6" 
            required 
            style={{ width: '100%', height: '46px', textAlign: 'center', letterSpacing: '4px', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '18px', outline: 'none', boxSizing: 'border-box' }}
          />
          <button type="submit" style={{ width: '100%', height: '48px', backgroundColor: '#2563EB', color: '#FFFFFF', fontSize: '16px', fontWeight: '600', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
            Verify Code
          </button>
        </form>

        <p style={{ marginTop: '24px', marginBottom: '0', fontSize: '14px', color: '#6B7280' }}>
          Didn't receive it or want to use a different account?{' '}
          <Link to="/login" style={{ color: '#2563EB', fontWeight: '600', textDecoration: 'none' }}>
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}