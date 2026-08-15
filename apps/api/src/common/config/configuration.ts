export default () => {
  const port = parseInt(process.env.PORT ?? '3000', 10);
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3001,http://localhost:3002').split(',');
  return {
    port,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
      refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '30', 10),
      // Deliberately its own secret, not accessSecret — a 2FA challenge
      // token is issued *before* the password-holder has proven the second
      // factor, so it must never verify against JwtAuthGuard's strategy
      // (which trusts accessSecret to mean "fully authenticated"). See
      // AuthService.login()/verifyTwoFactorLogin().
      mfaChallengeSecret: process.env.JWT_MFA_CHALLENGE_SECRET ?? 'dev-mfa-challenge-secret-change-me',
    },
    // AES-256-GCM key for encrypting TOTP secrets at rest (see
    // totp-crypto.util.ts) — any string works, it's stretched into a 32-byte
    // key via scrypt. Rotating this invalidates every enrolled user's 2FA
    // secret, so treat it like the JWT secrets: set once per environment.
    totpEncryptionKey: process.env.TOTP_ENCRYPTION_KEY ?? 'dev-totp-encryption-key-change-me',
    corsOrigins,
    // WebAuthn (Biometric Login) — rpID must be a domain the browser
    // considers to "own" both frontend origins (a bare hostname, no scheme/
    // port); 'localhost' works for both :3001 and :3002 in dev. In
    // production this must be the real apex/subdomain the frontends are
    // served from. expectedOrigins reuses corsOrigins since they're already
    // exactly "the frontends this API trusts".
    webauthn: {
      rpId: process.env.WEBAUTHN_RP_ID ?? 'localhost',
      rpName: 'ChrisPa Scents and Soaps',
      expectedOrigins: corsOrigins,
    },
    // Used to build absolute URLs for locally-stored uploads (avatars, etc.)
    // — there's no CDN/object-storage in front of this yet, so the API
    // itself serves /uploads statically (see main.ts).
    publicUrl: process.env.PUBLIC_API_URL ?? `http://localhost:${port}`,
    // PAY-FR-1 (docs/SRS.md §21): Flutterwave sandbox/live credentials —
    // deliberately no dev-fallback default (unlike the secrets above, which
    // default to a dev-only placeholder) since a payment gateway must never
    // silently run against a made-up key. FlutterwaveService throws clearly
    // if these are unset rather than attempting a call that would just 401.
    flutterwave: {
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
      // Set by you in the Flutterwave dashboard (Settings → Webhooks) and
      // compared against the incoming `verif-hash` header — this is what
      // proves a webhook request actually came from Flutterwave.
      secretHash: process.env.FLUTTERWAVE_SECRET_HASH,
    },
    // Registration OTP delivery (see OtpService/MailService/SmsService).
    // Deliberately no dev-fallback default for the credential fields, same
    // reasoning as flutterwave above — sending a real code through a
    // made-up Brevo/Africa's Talking account would just fail loudly at send
    // time instead of silently, which NotificationsModule's boot-time check
    // turns into an upfront warning instead.
    //
    // Brevo's HTTP API, not SMTP — Render's free web services block all
    // outbound SMTP traffic (ports 25/465/587) as of Sep 2025, confirmed in
    // production against both Gmail and Brevo's own SMTP relay (see
    // MailService). Brevo's REST API runs over HTTPS, which isn't affected.
    brevo: {
      apiKey: process.env.BREVO_API_KEY,
      fromEmail: process.env.EMAIL_FROM_ADDRESS ?? 'no-reply@chrispa.ug',
      fromName: process.env.EMAIL_FROM_NAME ?? 'ChrisPa Scents and Soaps',
    },
    africasTalking: {
      username: process.env.AT_USERNAME,
      apiKey: process.env.AT_API_KEY,
      // Optional — Africa's Talking's shared sandbox sender works without one.
      senderId: process.env.AT_SENDER_ID || undefined,
    },
    // "Sign in with Google" (FR-8.4/FR-9.4) — see AuthService.googleLogin().
    // No dev-fallback: an unset clientId must reject every Google login
    // attempt outright, never verify a token against an empty audience.
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
    },
    otp: {
      ttlMinutes: parseInt(process.env.OTP_TTL_MINUTES ?? '10', 10),
    },
  };
};
