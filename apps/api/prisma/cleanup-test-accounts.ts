import { PrismaClient } from '@prisma/client';

// One-off cleanup script — NOT part of the app. Removes the test accounts
// created while debugging registration-OTP delivery this session (all
// Gmail "+tag" aliases of the real obekegodfrey3@gmail.com account, e.g.
// obekegodfrey3+smtptest@gmail.com). The filter deliberately requires a
// "+" between the base address and "@gmail.com" so it can only ever match
// a plus-addressed test alias, never the real obekegodfrey3@gmail.com
// account itself or any other user. Cart/LoyaltyAccount/OtpCode all
// cascade-delete via the User relation (see schema.prisma); ActivityLog's
// actorUserId is a plain snapshot field, not a live FK, so it's
// unaffected. Run once via a temporary Render build step, then delete.
const prisma = new PrismaClient();

async function main() {
  const testAccounts = await prisma.user.findMany({
    where: { email: { startsWith: 'obekegodfrey3+', endsWith: '@gmail.com' } },
    select: { id: true, email: true, phone: true },
  });

  console.log(`CLEANUP_FOUND ${testAccounts.length} test account(s)`);
  for (const u of testAccounts) {
    console.log(`CLEANUP_MATCH ${u.email} ${u.phone}`);
  }

  const result = await prisma.user.deleteMany({
    where: { email: { startsWith: 'obekegodfrey3+', endsWith: '@gmail.com' } },
  });

  console.log(`CLEANUP_DELETED ${result.count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
