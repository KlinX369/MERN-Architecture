# EduSphere authentication/security changes

## Authentication

- Email/password login still uses the existing email -> OTP -> dashboard flow.
- Google, GitHub, LinkedIn and TikTok all end in the same application authentication mechanism.
- Access JWT: 15 minutes, stored in an HttpOnly cookie.
- Refresh token: 30 days, random opaque token, stored only as a hash in MongoDB, rotated on use.
- Old/rotated refresh-token reuse invalidates the user's active sessions.
- JWTs contain user ID, session ID and session version. Authorization uses the current MongoDB role, not the JWT role claim.

## OTP

- OTP uses Node's cryptographic random generator.
- OTP is stored only as a SHA-256 hash.
- OTP expires after 10 minutes.
- Maximum of 5 wrong OTP attempts.
- OTP purpose is separated between authentication and password reset.
- Login OTPs have a 60-second send cooldown; routes are also rate-limited.

## Password recovery

- Forgot-password response is generic to reduce account enumeration.
- Reset OTP must be verified before a reset credential is created.
- Reset credential is stored only as a hash in MongoDB and exposed to the browser only as an HttpOnly cookie.
- Reset credential expires after 15 minutes and is single-use.
- Password reset invalidates every application session and rotates the user's session version.
- Password-change notification email is sent after a successful reset/change.

## RBAC

- Authentication and authorization are separate middleware layers.
- Admin-only, instructor/admin, and student/instructor/admin examples are included.
- Public production registration cannot self-assign admin or instructor.
- Admin role and account-status changes revoke affected user sessions.
- Resource self/admin authorization helper is included for future object-level rules.

## Web security

- Helmet security headers.
- Strict CORS allowlist.
- HttpOnly/Secure/SameSite cookies.
- Double-submit CSRF protection for unsafe requests.
- Rate limiting for login, registration, OTP, reset, refresh and CSRF token endpoints.
- JSON/form body size limits.
- Production startup refuses missing/weak JWT/session secrets.
- OAuth state validation for Google, LinkedIn, GitHub and TikTok.
- OAuth-only accounts are supported without a fake password value.

## Audit events

Security-sensitive events are stored in MongoDB without storing passwords, OTPs, reset tokens or JWTs.

Examples include registration, failed login, successful login, OTP failures, password reset request/completion, role changes, account changes, OAuth login and RBAC denial.
