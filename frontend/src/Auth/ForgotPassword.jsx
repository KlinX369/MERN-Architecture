import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

export default function OtpVerification() {
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve the email and purpose passed from the previous page
  const email = location.state?.email;
  const purpose = location.state?.purpose || 'authentication';

  // Determine whether this OTP is for password reset
  const isPasswordReset = purpose === 'password-reset';

  useEffect(() => {
    // If someone navigates directly to /otp-verification
    // without an email, send them back to login
    if (!email) {
      navigate('/login', { replace: true });
    }
  }, [email, navigate]);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    // Prevent duplicate requests
    if (isLoading) return;

    const cleanEmail = email?.trim().toLowerCase();

    if (!cleanEmail) {
      alert('Email address is missing. Please start again.');
      navigate('/login', { replace: true });
      return;
    }

    if (otp.length !== 6) {
      alert('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);

    try {
      /*
       * Password reset:
       * POST /api/auth/verify-reset-otp
       *
       * Normal authentication:
       * POST /api/auth/verify-otp
       */
      const endpoint = isPasswordReset
        ? 'http://localhost:5000/api/auth/verify-reset-otp'
        : 'http://localhost:5000/api/auth/verify-otp';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setOtp('');

        alert(
          `Verification failed: ${
            data.message ||
            data.error ||
            'Invalid or expired code'
          }`
        );

        return;
      }

      /*
       * =====================================================
       * PASSWORD RESET FLOW
       * =====================================================
       *
       * The backend should return:
       *
       * {
       *   message: "...",
       *   resetToken: "..."
       * }
       *
       * The reset token is then passed to ForgotPassword.jsx.
       */
      if (isPasswordReset) {
        if (!data.resetToken) {
          alert(
            'Verification succeeded, but no reset token was received. Please try again.'
          );

          setOtp('');
          return;
        }

        navigate('/forgot-password', {
          replace: true,
          state: {
            email: cleanEmail,
            resetToken: data.resetToken,
            step: 3,
          },
        });

        return;
      }

      /*
       * =====================================================
       * EXISTING LOGIN / AUTHENTICATION FLOW
       * =====================================================
       *
       * Keep the existing behavior unchanged.
       */
      if (!data.token) {
        alert(
          'Verification succeeded, but no authentication token was received.'
        );

        return;
      }

      localStorage.setItem('token', data.token);

      // Store returned user information if the backend provides it
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      alert('Login successful!');

      navigate('/dashboard', { replace: true });

    } catch (error) {
      console.error('OTP verification error:', error);

      alert(
        'Could not connect to the server. Please check that the backend is running and try again.'
      );

    } finally {
      setIsLoading(false);
    }
  };

  if (!email) return null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F9FAFB',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        padding: '20px'
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          padding: '40px',
          width: '100%',
          maxWidth: '440px',
          boxShadow:
            '0 10px 25px -5px rgba(0,0,0,0.05)',
          border: '1px solid #F3F4F6',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
      >

        {/* =====================================================
            ICON
            ===================================================== */}

        <div
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#EFF6FF',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            color: '#2563EB'
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect
              x="3"
              y="11"
              width="18"
              height="11"
              rx="2"
              ry="2"
            />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* =====================================================
            TITLE
            ===================================================== */}

        <h2
          style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#111827',
            margin: '0 0 8px 0'
          }}
        >
          {isPasswordReset
            ? 'Reset Password'
            : 'Enter 2FA Code'}
        </h2>

        {/* =====================================================
            DESCRIPTION
            ===================================================== */}

        <p
          style={{
            fontSize: '15px',
            color: '#6B7280',
            margin: '0 0 28px 0'
          }}
        >
          {isPasswordReset ? (
            <>
              We sent a 6-digit password reset code to
              <br />
              <strong>{email}</strong>
            </>
          ) : (
            <>
              We sent a 6-digit code to
              <br />
              <strong>{email}</strong>
            </>
          )}
        </p>

        {/* =====================================================
            OTP FORM
            ===================================================== */}

        <form
          onSubmit={handleVerifyOTP}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={otp}
            onChange={(e) =>
              setOtp(
                e.target.value
                  .replace(/\D/g, '')
                  .slice(0, 6)
              )
            }
            maxLength={6}
            required
            disabled={isLoading}
            style={{
              width: '100%',
              height: '46px',
              textAlign: 'center',
              letterSpacing: '4px',
              borderRadius: '10px',
              border: '1px solid #D1D5DB',
              fontSize: '18px',
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: isLoading
                ? '#F9FAFB'
                : '#FFFFFF'
            }}
          />

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              height: '48px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '10px',
              cursor: isLoading
                ? 'not-allowed'
                : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        {/* =====================================================
            FOOTER
            ===================================================== */}

        <p
          style={{
            marginTop: '24px',
            marginBottom: '0',
            fontSize: '14px',
            color: '#6B7280'
          }}
        >
          Didn't receive it or want to use a different account?{' '}

          <Link
            to="/login"
            style={{
              color: '#2563EB',
              fontWeight: '600',
              textDecoration: 'none'
            }}
          >
            Back to Login
          </Link>
        </p>

      </div>
    </div>
  );
}