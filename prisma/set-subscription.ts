// Dev helper to fake a subscription without Stripe (the next webhook for a
// user with a Stripe customer overwrites it):
//   npm run dev:subscribe -- <username> [ACTIVE|NONE|...]
import prisma from '../src/server/db';
import { SubscriptionStatus } from '../src/generated/prisma/client';

async function main() {
  const [username, status = 'ACTIVE'] = process.argv.slice(2);
  if (!username || !(status in SubscriptionStatus)) {
    console.error(
      `Usage: npm run dev:subscribe -- <username> [${Object.keys(SubscriptionStatus).join('|')}]`
    );
    process.exitCode = 1;
    return;
  }
  const user = await prisma.user.update({
    where: { username },
    data: { subscriptionStatus: status as SubscriptionStatus },
  });
  console.log(`@${user.username} is now ${user.subscriptionStatus}`);
}

main().finally(() => prisma.$disconnect());
