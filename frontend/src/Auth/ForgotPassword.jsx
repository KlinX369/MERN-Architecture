import { useState, useEffect } from 'react';
import {
  useNavigate,
  useLocation,
  Link
} from 'react-router-dom';

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  'http://localhost:5000';


// =========================================================
// EYE ICON
// =========================================================

const EyeIcon = ({ hidden }) => {
  if (hidden) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <path d="m1 1 22 22" />
      </svg>
    );
  }

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
      <circle
        cx="12"
        cy="12"
        r="3"
      />
    </svg>
  );
};


export default function ForgotPassword() {

  const navigate =
    useNavigate();

  const location =
    useLocation();


  // =========================================================
  // ROUTING STATE
  // =========================================================

  const currentStep =
    location.state?.step || 1;

  const initialEmail =
    location.state?.email || '';

  const resetToken =
    location.state?.resetToken || '';


  const [step, setStep] =
    useState(currentStep);

  const [email, setEmail] =
    useState(initialEmail);

  const [password, setPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);


  // =========================================================
  // PASSWORD STRENGTH
  // =========================================================

  const [passwordStrength, setPasswordStrength] =
    useState({
      score: 0,
      message: ''
    });


  const evaluatePassword = (pass) => {

    let score = 0;

    if (pass.length >= 8) {
      score += 1;
    }

    if (/[A-Z]/.test(pass)) {
      score += 1;
    }

    if (/[0-9]/.test(pass)) {
      score += 1;
    }

    if (/[^A-Za-z0-9]/.test(pass)) {
      score += 1;
    }


    let message = '';

    switch (score) {

      case 0:
      case 1:
        message = 'Weak';
        break;

      case 2:
      case 3:
        message = 'Fair';
        break;

      case 4:
        message = 'Strong';
        break;

      default:
        message = '';
    }


    setPasswordStrength({
      score,
      message
    });
  };


  const handlePasswordChange = (e) => {

    const value =
      e.target.value;

    setPassword(value);

    evaluatePassword(value);
  };


  // =========================================================
  // PROTECT RESET STEP
  // =========================================================

  useEffect(() => {

    if (
      step === 3 &&
      (!email || !resetToken)
    ) {

      alert(
        'Your password reset session is invalid or expired. Please request a new reset code.'
      );

      navigate(
        '/login',
        {
          replace: true
        }
      );
    }

  }, [
    step,
    email,
    resetToken,
    navigate
  ]);


  // =========================================================
  // STEP 1
  // REQUEST RESET CODE
  // =========================================================

  const handleRequestReset = async (e) => {

    e.preventDefault();

    if (isLoading) {
      return;
    }


    const cleanEmail =
      email
        ?.trim()
        .toLowerCase();


    if (!cleanEmail) {

      alert(
        'Please enter a valid email address.'
      );

      return;
    }


    setIsLoading(true);


    try {

      const response =
        await fetch(
          `${BACKEND_URL}/api/auth/forgot-password`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({
              email:
                cleanEmail
            })
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        alert(
          `Request failed: ${
            data.message ||
            'Unable to process request'
          }`
        );

        return;
      }


      navigate(
        '/otp-verification',
        {
          replace: true,

          state: {
            email:
              cleanEmail,

            purpose:
              'password-reset'
          }
        }
      );

    } catch (error) {

      console.error(
        'Forgot password error:',
        error
      );

      alert(
        'Could not connect to the server. Please check your connection.'
      );

    } finally {

      setIsLoading(false);
    }
  };


  // =========================================================
  // STEP 3
  // SET NEW PASSWORD
  // =========================================================

  const handleResetPassword = async (e) => {

    e.preventDefault();

    if (isLoading) {
      return;
    }


    // -------------------------------------------------------
    // RESET SESSION CHECK
    // -------------------------------------------------------

    if (!email || !resetToken) {

      alert(
        'Your password reset session is invalid or expired. Please request a new reset code.'
      );

      navigate(
        '/login',
        {
          replace: true
        }
      );

      return;
    }


    // -------------------------------------------------------
    // PASSWORD MATCH
    // -------------------------------------------------------

    if (
      password !==
      confirmPassword
    ) {

      alert(
        'Passwords do not match.'
      );

      return;
    }


    // -------------------------------------------------------
    // PASSWORD STRENGTH
    // -------------------------------------------------------

    if (
      passwordStrength.score < 4
    ) {

      alert(
        'Password is too weak. Use at least 8 characters, one uppercase letter, one number, and one special character.'
      );

      return;
    }


    setIsLoading(true);


    try {

      const response =
        await fetch(
          `${BACKEND_URL}/api/auth/reset-password`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body: JSON.stringify({

              email:
                email
                  .trim()
                  .toLowerCase(),

              resetToken,

              newPassword:
                password

            })
          }
        );


      const data =
        await response.json();


      // -------------------------------------------------------
      // SERVER ERROR
      // -------------------------------------------------------

      if (!response.ok) {

        alert(
          `Reset failed: ${
            data.message ||
            data.error ||
            'Unable to reset password'
          }`
        );

        return;
      }


      // -------------------------------------------------------
      // PASSWORD RESET SUCCESS
      // -------------------------------------------------------

      localStorage.removeItem(
        'jwt_token'
      );

      localStorage.removeItem(
        'user_data'
      );


      alert(
        'Password successfully reset! You can now log in with your new password.'
      );


      navigate(
        '/login',
        {
          replace: true
        }
      );


    } catch (error) {

      console.error(
        'Reset password error:',
        error
      );

      alert(
        'Could not connect to the server.'
      );

    } finally {

      setIsLoading(false);
    }
  };


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

        {/* ICON */}

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

            {
              step === 1 ? (

                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" />

              ) : (

                <>
                  <rect
                    x="3"
                    y="11"
                    width="18"
                    height="11"
                    rx="2"
                    ry="2"
                  />

                  <path
                    d="M7 11V7a5 5 0 0 1 10 0v4"
                  />
                </>

              )
            }

          </svg>

        </div>


        {/* TITLE */}

        <h2
          style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#111827',
            margin: '0 0 8px 0'
          }}
        >

          {
            step === 1
              ? 'Forgot Password'
              : 'Set New Password'
          }

        </h2>


        {/* DESCRIPTION */}

        <p
          style={{
            fontSize: '15px',
            color: '#6B7280',
            margin: '0 0 28px 0'
          }}
        >

          {
            step === 1

              ? "Enter your email and we'll send you a verification code to reset your password."

              : (
                <>
                  Create a new, strong password for
                  <br />
                  <strong>
                    {email}
                  </strong>
                </>
              )
          }

        </p>


        {/* =====================================================
            STEP 1
            ===================================================== */}

        {
          step === 1 ? (

            <form
              onSubmit={
                handleRequestReset
              }

              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}
            >

              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
                required
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '0 16px',
                  borderRadius: '10px',
                  border:
                    '1px solid #D1D5DB',
                  fontSize: '16px',
                  outline: 'none',
                  boxSizing: 'border-box'
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
                  cursor:
                    isLoading
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    isLoading
                      ? 0.7
                      : 1
                }}
              >

                {
                  isLoading
                    ? 'Sending...'
                    : 'Send Reset Code'
                }

              </button>

            </form>

          ) : (

            /* =================================================
               STEP 3
               ================================================= */

            <form
              onSubmit={
                handleResetPassword
              }

              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '15px'
              }}
            >

              {/* NEW PASSWORD */}

              <div
                style={{
                  position: 'relative',
                  width: '100%'
                }}
              >

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }

                  placeholder="New Password"

                  value={password}

                  onChange={
                    handlePasswordChange
                  }

                  required

                  disabled={isLoading}

                  autoComplete="new-password"

                  style={{
                    width: '100%',
                    height: '46px',
                    padding:
                      '0 52px 0 16px',
                    borderRadius: '10px',
                    border:
                      '1px solid #D1D5DB',
                    fontSize: '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />


                <button
                  type="button"

                  onClick={() =>
                    setShowPassword(
                      previous =>
                        !previous
                    )
                  }

                  disabled={isLoading}

                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }

                  style={{
                    position:
                      'absolute',
                    right: '12px',
                    top: '50%',
                    transform:
                      'translateY(-50%)',
                    width: '30px',
                    height: '30px',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    border:
                      'none',
                    background:
                      'transparent',
                    color: '#9CA3AF',
                    cursor:
                      isLoading
                        ? 'not-allowed'
                        : 'pointer',
                    padding: '0'
                  }}
                >

                  <EyeIcon
                    hidden={
                      showPassword
                    }
                  />

                </button>

              </div>


              {/* PASSWORD STRENGTH */}

              {
                password.length > 0 && (

                  <div
                    style={{
                      textAlign:
                        'left',
                      fontSize:
                        '12px',
                      marginTop:
                        '-10px',
                      color:
                        passwordStrength.score >= 4
                          ? 'green'
                          : 'red'
                    }}
                  >

                    Strength: {
                      passwordStrength.message
                    }

                  </div>

                )
              }


              {/* CONFIRM PASSWORD */}

              <div
                style={{
                  position: 'relative',
                  width: '100%'
                }}
              >

                <input
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }

                  placeholder="Confirm New Password"

                  value={
                    confirmPassword
                  }

                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }

                  required

                  disabled={isLoading}

                  autoComplete="new-password"

                  style={{
                    width: '100%',
                    height: '46px',
                    padding:
                      '0 52px 0 16px',
                    borderRadius: '10px',
                    border:
                      '1px solid #D1D5DB',
                    fontSize: '16px',
                    outline: 'none',
                    boxSizing:
                      'border-box'
                  }}
                />


                <button
                  type="button"

                  onClick={() =>
                    setShowConfirmPassword(
                      previous =>
                        !previous
                    )
                  }

                  disabled={isLoading}

                  aria-label={
                    showConfirmPassword
                      ? 'Hide password'
                      : 'Show password'
                  }

                  style={{
                    position:
                      'absolute',
                    right: '12px',
                    top: '50%',
                    transform:
                      'translateY(-50%)',
                    width: '30px',
                    height: '30px',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    justifyContent:
                      'center',
                    border:
                      'none',
                    background:
                      'transparent',
                    color: '#9CA3AF',
                    cursor:
                      isLoading
                        ? 'not-allowed'
                        : 'pointer',
                    padding: '0'
                  }}
                >

                  <EyeIcon
                    hidden={
                      showConfirmPassword
                    }
                  />

                </button>

              </div>


              {/* RESET BUTTON */}

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: '48px',
                  backgroundColor:
                    '#2563EB',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '10px',
                  cursor:
                    isLoading
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    isLoading
                      ? 0.7
                      : 1,
                  marginTop: '10px'
                }}
              >

                {
                  isLoading
                    ? 'Resetting...'
                    : 'Reset Password'
                }

              </button>

            </form>

          )
        }


        {/* FOOTER */}

        <p
          style={{
            marginTop: '24px',
            marginBottom: '0',
            fontSize: '14px',
            color: '#6B7280'
          }}
        >

          Remember your password?{' '}

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