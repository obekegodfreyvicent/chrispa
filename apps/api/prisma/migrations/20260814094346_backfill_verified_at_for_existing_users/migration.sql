-- Grandfathers every account that existed before the registration-OTP hard
-- gate (see AuthService.login()) — these accounts (seed/demo data, or real
-- pre-feature signups) have no way to retroactively receive/confirm a code
-- that was never sent, so they're treated as already verified rather than
-- locked out.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "email" IS NOT NULL AND "emailVerifiedAt" IS NULL;
UPDATE "User" SET "phoneVerifiedAt" = "createdAt" WHERE "phone" IS NOT NULL AND "phoneVerifiedAt" IS NULL;
