# EduSphere authentication security upgrade

## 1. Install dependencies

From the backend project directory:

```bash
npm install helmet express-rate-limit connect-mongo
```

The existing project dependencies still need to contain Express, Mongoose, Axios, Passport, express-session, cookie-parser, bcryptjs, jsonwebtoken and Nodemailer.

## 2. Copy environment configuration

Copy `.env.example` to `.env` and replace all placeholder secrets with real values.

Do not commit `.env` to Git.

Generate secrets with Node, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Use different random values for `JWT_SECRET`, `SESSION_SECRET`, and `AUDIT_HASH_SALT`.

## 3. Frontend files

Put `authApi.js`, `Login.jsx`, `OtpVerification.jsx`, and `ForgotPassword.jsx` in the same authentication component directory, or update the `./authApi` import path.

Set:

```env
VITE_BACKEND_URL=http://localhost:5000
```

For production, use the real HTTPS backend URL.

## 4. Important frontend API change

The authentication cookies are HttpOnly, so React must not try to read `jwt_token` from localStorage.

Protected API calls elsewhere in the application must use:

```js
fetch(`${VITE_BACKEND_URL}/api/some-endpoint`, {
  credentials: 'include'
})
```

For POST/PUT/PATCH/DELETE requests, include the CSRF header. The shared `authApi.js` helper handles this automatically.

## 5. OAuth

Update the OAuth provider consoles so their callback URLs exactly match the configured backend URLs.

Google:
`/auth/google/callback`

LinkedIn:
`/api/auth/callback/linkedin`

GitHub:
`/api/auth/callback/github`

TikTok:
`/auth/tiktok/callback`

## 6. Production

Use HTTPS for both frontend and backend.

Use `COOKIE_SAME_SITE=none` when frontend and backend are deployed on different sites and therefore need cross-site cookies.

Keep `ALLOW_BEARER_TOKENS=false` in production.

Public registration does not allow a user to self-select `admin` or `instructor` in production. Admins assign roles through the protected admin endpoint.
