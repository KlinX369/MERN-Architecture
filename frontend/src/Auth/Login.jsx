import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/* =========================================================
   INLINE ICONS
   ========================================================= */

const Icon = ({ children, size = 18, stroke = 2 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const EyeIcon = ({ hidden }) =>
  hidden ? (
    <Icon size={17}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="m1 1 22 22" />
    </Icon>
  ) : (
    <Icon size={17}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );

/* =========================================================
   EDU SPHERE LOGO
   This is the shield logo from the original Login.jsx
   ========================================================= */

const EduSphereLogo = () => (
  <div className="auth-logo">
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  </div>
);

/* =========================================================
   SOCIAL ICONS
   ========================================================= */

const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M21.35 12.27c0-.79-.07-1.55-.23-2.27H12v4.3h5.22a4.46 4.46 0 0 1-1.94 2.93v2.43h3.14c1.84-1.69 2.93-4.18 2.93-7.39Z"
    />
    <path
      fill="#34A853"
      d="M12 21.96c2.63 0 4.84-.87 6.45-2.35l-3.14-2.43c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.29v2.5A9.74 9.74 0 0 0 12 21.96Z"
    />
    <path
      fill="#FBBC05"
      d="M6.54 14.08a5.86 5.86 0 0 1 0-3.76v-2.5H3.29a9.76 9.76 0 0 0 0 8.76l3.25-2.5Z"
    />
    <path
      fill="#EA4335"
      d="M12 6.29c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.83 3.38 14.62 2.5 12 2.5a9.74 9.74 0 0 0-8.71 5.32l3.25 2.5C7.31 8.01 9.46 6.29 12 6.29Z"
    />
  </svg>
);

const FacebookIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.98h-1.52c-1.49 0-1.95.93-1.95 1.88v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.07 24 18.09 24 12.07Z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.45 20.45h-3.56v-5.58c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.67H9.35V8.99h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.26 2.37 4.26 5.45v6.3ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM3.56 20.45h3.56V8.99H3.56v11.46Z" />
  </svg>
);

/* =========================================================
   LOGIN
   ========================================================= */

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  /* =======================================================
     EXISTING LOGIN FUNCTIONALITY — PRESERVED
     ======================================================= */

  const handleLogin = async (e) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.requiresOTP) {
        navigate("/otp-verification", {
          state: {
            email: email,
          },
        });
      } else if (response.ok) {
        navigate("/dashboard");
      } else {
        alert(`Login failed: ${data.message || data.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>

      <main className="auth-page">
        {/* Ambient background */}
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="ambient ambient-three" />

        {/* Main authentication card */}
        <section className="auth-card">
          <div className="auth-content">

            {/* Logo */}
            <EduSphereLogo />

            <div className="brand-name">
              Edu<span>Sphere</span>
            </div>

            <h1>Welcome back</h1>

            <p className="auth-subtitle">
              Enter your credentials to access your account.
            </p>

            {/* LOGIN FORM */}
            <form onSubmit={handleLogin} className="auth-form">

              {/* EMAIL */}
              <div className="field">
                <label htmlFor="login-email">
                  Email
                </label>

                <input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              {/* PASSWORD */}
              <div className="field">
                <div className="field-label-row">
                  <label htmlFor="login-password">
                    Password
                  </label>
                </div>

                <div className="password-wrapper">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    <EyeIcon hidden={showPassword} />
                  </button>
                </div>
              </div>

              {/* LOGIN */}
              <button
                type="submit"
                className="primary-button"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="button-spinner" />
                    Logging in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* DIVIDER */}
            <div className="divider">
              <span />
              <b>or continue with</b>
              <span />
            </div>

            {/* SOCIAL LOGIN */}
            <div className="social-grid">

              <a
                href={`${BACKEND_URL}/auth/google`}
                className="social-button google-button"
              >
                <GoogleIcon />
                <span>Google</span>
              </a>

              <a
                href={`${BACKEND_URL}/auth/facebook`}
                className="social-button facebook-button"
              >
                <FacebookIcon />
                <span>Facebook</span>
              </a>

              <a
                href={`${BACKEND_URL}/auth/linkedin`}
                className="social-button linkedin-button"
              >
                
                <LinkedInIcon />
                <span>LinkedIn</span>
              </a>

            </div>

            {/* REGISTER */}
            <p className="switch-auth">
              Don't have an account?
              <Link to="/register">
                Create account
              </Link>
            </p>

          </div>
        </section>

        <div className="page-brand">
          EduSphere • Education &amp; Opportunity
        </div>
      </main>
    </>
  );
}

/* =========================================================
   STYLES
   ========================================================= */

const styles = `
* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  width: 100%;
  min-height: 100%;
}

body {
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
}

/* =========================================================
   PAGE
   ========================================================= */

.auth-page {
  position: relative;

  min-height: 100vh;
  width: 100%;

  display: flex;
  align-items: center;
  justify-content: center;

  overflow: hidden;

  padding: 24px;

  background:
    radial-gradient(
      circle at 50% 50%,
      #171026 0%,
      #09070e 48%,
      #030304 100%
    );

  isolation: isolate;
}

/* =========================================================
   AMBIENT GLOW
   ========================================================= */

.ambient {
  position: absolute;

  pointer-events: none;

  border-radius: 999px;

  filter: blur(55px);

  opacity: 0.72;

  z-index: -1;
}

.ambient-one {
  width: 300px;
  height: 300px;

  top: -110px;
  left: 50%;

  transform: translateX(-50%);

  background:
    radial-gradient(
      circle,
      rgba(100, 35, 255, 0.95),
      rgba(50, 20, 160, 0.45),
      transparent 70%
    );
}

.ambient-two {
  width: 360px;
  height: 260px;

  left: -170px;
  top: 35%;

  background:
    radial-gradient(
      circle,
      rgba(67, 25, 190, 0.75),
      transparent 70%
    );
}

.ambient-three {
  width: 300px;
  height: 300px;

  right: -160px;
  bottom: -100px;

  background:
    radial-gradient(
      circle,
      rgba(19, 87, 255, 0.72),
      transparent 70%
    );
}

/* =========================================================
   CARD
   ========================================================= */

.auth-card {
  position: relative;

  width: min(100%, 400px);

  /*
    Compact height similar to the supplied reference.
  */
  max-height: calc(100vh - 48px);

  overflow-y: auto;

  background:
    rgba(255, 255, 255, 0.975);

  border:
    1px solid rgba(255, 255, 255, 0.7);

  border-radius: 13px;

  box-shadow:
    0 0 0 3px rgba(255,255,255,0.08),
    0 22px 70px rgba(0,0,0,0.55),
    0 0 90px rgba(91,45,220,0.18);

  scrollbar-width: none;
}

.auth-card::-webkit-scrollbar {
  display: none;
}

.auth-content {
  width: 100%;

  padding:
    27px
    31px
    23px;

  text-align: center;
}

/* =========================================================
   LOGO
   ========================================================= */

.auth-logo {
  width: 28px;
  height: 28px;

  margin:
    0 auto 7px;

  display: flex;
  align-items: center;
  justify-content: center;

  color: #050509;

  background: #ffffff;
}

/* =========================================================
   BRAND
   ========================================================= */

.brand-name {
  font-size: 8px;
  line-height: 1;

  font-weight: 700;

  letter-spacing: -0.1px;

  color: #0b0b0e;

  margin-bottom: 10px;
}

.brand-name span {
  color: #2563eb;
}

/* =========================================================
   HEADINGS
   ========================================================= */

.auth-content h1 {
  margin:
    0 0 5px;

  color: #08080b;

  font-size: 17px;
  line-height: 1.2;

  font-weight: 750;

  letter-spacing: -0.45px;
}

.auth-subtitle {
  margin:
    0 0 17px;

  color: #85858c;

  font-size: 8px;
  line-height: 1.45;
}

/* =========================================================
   FORM
   ========================================================= */

.auth-form {
  display: flex;

  flex-direction: column;

  gap: 11px;

  text-align: left;
}

.field {
  width: 100%;
}

.field label {
  display: block;

  margin-bottom: 4px;

  color: #4c4c53;

  font-size: 8px;

  font-weight: 650;
}

.field-label-row {
  display: flex;

  align-items: center;

  justify-content: space-between;
}

.field input {
  width: 100%;

  height: 30px;

  padding:
    0 10px;

  border:
    1px solid #dedee3;

  border-radius: 5px;

  outline: none;

  background: #ffffff;

  color: #18181b;

  font-size: 9px;

  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.field input::placeholder {
  color: #b3b3ba;
}

.field input:hover {
  border-color: #c7c7ce;
}

.field input:focus {
  border-color: #2563eb;

  box-shadow:
    0 0 0 2px
    rgba(37, 99, 235, 0.09);
}

/* =========================================================
   PASSWORD
   ========================================================= */

.password-wrapper {
  position: relative;
}

.password-wrapper input {
  padding-right: 33px;
}

.password-toggle {
  position: absolute;

  right: 7px;
  top: 50%;

  transform: translateY(-50%);

  width: 22px;
  height: 22px;

  padding: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  color: #a0a0a8;

  background: transparent;

  border: 0;

  cursor: pointer;
}

.password-toggle:hover {
  color: #55555d;
}

/* =========================================================
   PRIMARY BUTTON
   ========================================================= */

.primary-button {
  width: 100%;

  height: 31px;

  margin-top: 1px;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 7px;

  border: 0;

  border-radius: 5px;

  background:
    linear-gradient(
      135deg,
      #2563eb,
      #1557d6
    );

  color: white;

  font-size: 9px;

  font-weight: 650;

  cursor: pointer;

  box-shadow:
    0 5px 12px
    rgba(37, 99, 235, 0.18);

  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    opacity 0.16s ease;
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-1px);

  box-shadow:
    0 7px 16px
    rgba(37, 99, 235, 0.26);
}

.primary-button:active:not(:disabled) {
  transform: translateY(0) scale(0.99);
}

.primary-button:disabled {
  opacity: 0.62;

  cursor: not-allowed;
}

.button-spinner {
  width: 11px;
  height: 11px;

  border:
    1.5px solid
    rgba(255,255,255,0.45);

  border-top-color: white;

  border-radius: 50%;

  animation:
    authSpin 0.7s linear infinite;
}

@keyframes authSpin {
  to {
    transform: rotate(360deg);
  }
}

/* =========================================================
   DIVIDER
   ========================================================= */

.divider {
  width: 100%;

  display: flex;

  align-items: center;

  gap: 7px;

  margin:
    15px 0 10px;
}

.divider span {
  flex: 1;

  height: 1px;

  background: #e9e9ed;
}

.divider b {
  color: #a0a0a7;

  font-size: 7px;

  font-weight: 450;

  white-space: nowrap;
}

/* =========================================================
   SOCIAL
   ========================================================= */

.social-grid {
  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 6px;
}

.social-button {
  min-width: 0;

  height: 30px;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 5px;

  border-radius: 5px;

  text-decoration: none;

  font-size: 7.5px;

  font-weight: 600;

  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    background 0.16s ease;
}

.social-button:hover {
  transform: translateY(-1px);

  box-shadow:
    0 4px 10px
    rgba(0,0,0,0.08);
}

.social-button:active {
  transform: scale(0.98);
}

/* Google */

.google-button {
  background: white;

  color: #404047;

  border:
    1px solid #dedee3;
}

/* Facebook */

.facebook-button {
  background: #1877f2;

  color: white;

  border:
    1px solid #1877f2;
}

/* LinkedIn */

.linkedin-button {
  background: #0a66c2;

  color: white;

  border:
    1px solid #0a66c2;
}

/* =========================================================
   REGISTER LINK
   ========================================================= */

.switch-auth {
  margin:
    14px 0 0;

  color: #8c8c93;

  font-size: 7.5px;
}

.switch-auth a {
  margin-left: 4px;

  color: #2563eb;

  font-weight: 650;

  text-decoration: none;
}

.switch-auth a:hover {
  text-decoration: underline;
}

/* =========================================================
   PAGE BRAND
   ========================================================= */

.page-brand {
  position: absolute;

  bottom: 11px;

  left: 50%;

  transform: translateX(-50%);

  color:
    rgba(255,255,255,0.34);

  font-size: 7px;

  white-space: nowrap;

  pointer-events: none;
}

/* =========================================================
   TABLETS
   ========================================================= */

@media (min-width: 600px) {

  .auth-content {
    padding:
      30px 34px 25px;
  }

  .auth-card {
    width: 410px;
  }
}

/* =========================================================
   MOBILE
   ========================================================= */

@media (max-width: 480px) {

  .auth-page {
    padding: 14px;
  }

  .auth-card {
    width: min(100%, 390px);

    max-height:
      calc(100vh - 28px);

    border-radius: 11px;
  }

  .auth-content {
    padding:
      24px 25px 21px;
  }

  .page-brand {
    display: none;
  }
}

/* =========================================================
   VERY SMALL PHONES
   ========================================================= */

@media (max-width: 350px) {

  .auth-page {
    padding: 9px;
  }

  .auth-content {
    padding:
      20px 19px 18px;
  }

  .auth-content h1 {
    font-size: 16px;
  }

  .social-button {
    font-size: 7px;
  }
}

/* =========================================================
   SHORT SCREENS
   ========================================================= */

@media (max-height: 620px) {

  .auth-page {
    align-items: flex-start;

    padding-top: 12px;
    padding-bottom: 12px;
  }

  .auth-content {
    padding-top: 17px;
    padding-bottom: 15px;
  }

  .auth-logo {
    margin-bottom: 4px;
  }

  .brand-name {
    margin-bottom: 6px;
  }

  .auth-content h1 {
    margin-bottom: 3px;
  }

  .auth-subtitle {
    margin-bottom: 11px;
  }

  .divider {
    margin-top: 11px;
    margin-bottom: 8px;
  }

  .switch-auth {
    margin-top: 9px;
  }
}
`;