import { PrismaClient } from '@prisma/client';
import { generateSecret } from 'otplib';
import { encryptTotpSecret } from '../src/modules/auth/util/totp-crypto.util';

// One-off bootstrap script — NOT part of the app, not run by `prisma db seed`.
// seed.ts sets twoFactorEnabled: true for chris@chrispa.ug (see the comment
// there) but never seeds an actual twoFactorSecret, so login deadlocks at
// the 2FA challenge with no way to produce a valid code. This mirrors
// TwoFactorService.enroll()'s own secret generation + encryption exactly
// (same otplib + totp-crypto.util functions) so the result is
// indistinguishable from a real self-service enrollment, then flips
// twoFactorEnabled straight to true (skipping the confirm() step, since
// there's no human here to submit a code back). Run once via a temporary
// Render build-command step, then delete.
const prisma = new PrismaClient();

async function main() {
  const email = 'chris@chrispa.ug';
  const key = process.env.TOTP_ENCRYPTION_KEY;
  if (!key) throw new Error('TOTP_ENCRYPTION_KEY is not set');

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const secret = generateSecret();
  const encrypted = encryptTotpSecret(secret, key);

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: encrypted, twoFactorEnabled: true },
  });

  // Plaintext printed once to the build log so it can be relayed to the
  // account owner — same "shown once, never stored" pattern as the staff
  // temp-password flow (see common/util/temp-password.util.ts).
  console.log(`TOTP_SEED_RESULT ${email} manualEntryKey=${secret}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
