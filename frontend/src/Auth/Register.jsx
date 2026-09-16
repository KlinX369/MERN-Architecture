import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

/* =========================================================
   ICON
   ========================================================= */

const Icon = ({ children, size = 17, stroke = 2 }) => (
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
    <Icon>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="m1 1 22 22" />
    </Icon>
  ) : (
    <Icon>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );

/* =========================================================
   EDUSPHERE LOGO
   Same shield/check logo from original Login.jsx
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

const GitHubIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.05c-3.34.73-4.04-1.61-4.04-1.61-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.74.08-.74 1.2.09 1.83 1.23 1.83 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.46 11.46 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.62-2.8 5.64-5.48 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.45 20.45h-3.56v-5.58c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.67H9.35V8.99h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.26 2.37 4.26 5.45v6.3ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM3.56 20.45h3.56V8.99H3.56v11.46Z" />
  </svg>
);

/* =========================================================
   REGISTER
   ========================================================= */

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  /* =======================================================
     PASSWORD STRENGTH — PRESERVED
     ======================================================= */

  const calculateStrength = (pass) => {
    let score = 0;

    if (!pass) {
      return {
        label: "",
        color: "transparent",
        width: "0%",
      };
    }

    if (pass.length > 5) score += 1;
    if (pass.length > 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) {
      return {
        label: "Weak",
        color: "#EF4444",
        width: "33.33%",
      };
    }

    if (score <= 4) {
      return {
        label: "Fair",
        color: "#F59E0B",
        width: "66.66%",
      };
    }

    return {
      label: "Strong",
      color: "#10B981",
      width: "100%",
    };
  };

  const strength = calculateStrength(password);

  /* =======================================================
     EXISTING REGISTRATION FUNCTIONALITY — PRESERVED
     ======================================================= */

  const handleRegister = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        navigate("/otp-verification", {
          state: {
            email: email,
          },
        });
      } else {
        alert(`Registration failed: ${data.message}`);
      }
    } catch (error) {
      console.error(
        "Failed to connect to server:",
        error
      );

      alert(
        "Could not connect to the server. Make sure your Node backend is running!"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{styles}</style>

      <main className="auth-page">
        {/* Background lighting */}
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="ambient ambient-three" />

        <section className="auth-card">
          <div className="auth-content">

            {/* Logo */}
            <EduSphereLogo />

            <div className="brand-name">
              Edu<span>Sphere</span>
            </div>

            <h1>Create your account</h1>

            <p className="auth-subtitle">
              Join EduSphere and start your learning journey.
            </p>

            <form
              onSubmit={handleRegister}
              className="auth-form"
            >

              {/* EMAIL */}
              <div className="field">
                <label htmlFor="register-email">
                  Email
                </label>

                <input
                  id="register-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  autoComplete="email"
                  required
                />
              </div>

              {/* PASSWORD */}
              <div className="field">
                <label htmlFor="register-password">
                  Secure password
                </label>

                <div className="password-wrapper">
                  <input
                    id="register-password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        (previous) => !previous
                      )
                    }
                  >
                    <EyeIcon
                      hidden={showPassword}
                    />
                  </button>
                </div>

                {/* PASSWORD STRENGTH */}
                {password && (
                  <div className="strength">

                    <div className="strength-label">
                      <span>Password strength</span>

                      <strong
                        style={{
                          color: strength.color,
                        }}
                      >
                        {strength.label}
                      </strong>
                    </div>

                    <div className="strength-track">
                      <div
                        className="strength-value"
                        style={{
                          width: strength.width,
                          background:
                            strength.color,
                        }}
                      />
                    </div>

                  </div>
                )}
              </div>

              {/* CONFIRM PASSWORD */}
              <div className="field">
                <label htmlFor="confirm-password">
                  Confirm password
                </label>

                <div className="password-wrapper">
                  <input
                    id="confirm-password"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowConfirmPassword(
                        (previous) => !previous
                      )
                    }
                  >
                    <EyeIcon
                      hidden={
                        showConfirmPassword
                      }
                    />
                  </button>
                </div>
              </div>

              {/* REGISTER */}
              <button
                type="submit"
                className="primary-button"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="button-spinner" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </form>

            {/* DIVIDER */}
            <div className="divider">
              <span />
              <b>or continue with</b>
              <span />
            </div>

            {/* SOCIAL REGISTRATION */}
            <div className="social-grid">

              <a
                href={`${BACKEND_URL}/auth/google`}
                className="social-button google-button"
              >
                <GoogleIcon />
                <span>Google</span>
              </a>

              <a
                href={`${BACKEND_URL}/auth/github`}
                className="social-button github-button"
              >
                <GitHubIcon />
                <span>GitHub</span>
              </a>

              <a
                href={`${BACKEND_URL}/auth/linkedin`}
                className="social-button linkedin-button"
              >
                <LinkedInIcon />
                <span>LinkedIn</span>
              </a>

            </div>

            {/* LOGIN LINK */}
            <p className="switch-auth">
              Already have an account?
              <Link to="/login">
                Sign in
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
   AMBIENT LIGHT
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

  max-height:
    calc(100vh - 48px);

  overflow-y: auto;

  background:
    rgba(255, 255, 255, 0.975);

  border:
    1px solid rgba(255,255,255,0.7);

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
    25px
    31px
    21px;

  text-align: center;
}

/* =========================================================
   LOGO
   ========================================================= */

.auth-logo {
  width: 28px;
  height: 28px;

  margin:
    0 auto 6px;

  display: flex;
  align-items: center;
  justify-content: center;

  color: #050509;
}

/* =========================================================
   BRAND
   ========================================================= */

.brand-name {
  font-size: 8px;

  line-height: 1;

  font-weight: 700;

  color: #0b0b0e;

  margin-bottom: 9px;
}

.brand-name span {
  color: #2563eb;
}

/* =========================================================
   TITLE
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
    0 0 15px;

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

  gap: 10px;

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

.field input {
  width: 100%;

  height: 29px;

  padding:
    0 10px;

  border:
    1px solid #dedee3;

  border-radius: 5px;

  outline: none;

  background: white;

  color: #18181b;

  font-size: 9px;

  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.field input::placeholder {
  color: #b3b3ba;
}

.field input:focus {
  border-color: #2563eb;

  box-shadow:
    0 0 0 2px
    rgba(37,99,235,0.09);
}

/* =========================================================
   PASSWORD
   ========================================================= */

.password-wrapper {
  position: relative;
}

.password-wrapper input {
  padding-right: 32px;
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

  border: 0;

  background: transparent;

  color: #a0a0a8;

  cursor: pointer;
}

/* =========================================================
   STRENGTH
   ========================================================= */

.strength {
  margin-top: 5px;
}

.strength-label {
  display: flex;

  justify-content: space-between;

  margin-bottom: 3px;

  color: #9999a0;

  font-size: 7px;
}

.strength-label strong {
  font-weight: 650;
}

.strength-track {
  width: 100%;

  height: 3px;

  overflow: hidden;

  border-radius: 4px;

  background: #e9e9ed;
}

.strength-value {
  height: 100%;

  transition:
    width 0.25s ease,
    background 0.25s ease;
}

/* =========================================================
   BUTTON
   ========================================================= */

.primary-button {
  width: 100%;

  height: 30px;

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
    rgba(37,99,235,0.18);

  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    opacity 0.16s ease;
}

.primary-button:hover:not(:disabled) {
  transform: translateY(-1px);

  box-shadow:
    0 7px 16px
    rgba(37,99,235,0.26);
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
  display: flex;

  align-items: center;

  gap: 7px;

  margin:
    13px 0 9px;
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

  height: 29px;

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
    box-shadow 0.16s ease;
}

.social-button:hover {
  transform: translateY(-1px);

  box-shadow:
    0 4px 10px
    rgba(0,0,0,0.08);
}

.google-button {
  color: #404047;

  background: #ffffff;

  border:
    1px solid #dedee3;
}

.github-button {
  color: #ffffff;

  background: #18181b;

  border:
    1px solid #18181b;
}

.linkedin-button {
  color: #ffffff;

  background: #0a66c2;

  border:
    1px solid #0a66c2;
}

/* =========================================================
   SWITCH
   ========================================================= */

.switch-auth {
  margin:
    12px 0 0;

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
   FOOTER
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
      22px 24px 19px;
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
      19px 18px 17px;
  }

  .auth-content h1 {
    font-size: 16px;
  }

  .social-button {
    font-size: 7px;
  }
}

/* =========================================================
   SHORT DEVICES
   ========================================================= */

@media (max-height: 680px) {

  .auth-page {
    align-items: flex-start;

    padding-top: 10px;
    padding-bottom: 10px;
  }

  .auth-content {
    padding-top: 15px;
    padding-bottom: 14px;
  }

  .auth-subtitle {
    margin-bottom: 10px;
  }

  .divider {
    margin-top: 10px;
    margin-bottom: 7px;
  }

  .switch-auth {
    margin-top: 8px;
  }
}
`;