// Grant or revoke admin (bypasses the subscription paywall):
//   npm run admin:set -- <username> [true|false]
import prisma from '../src/server/db';

async function main() {
  const [username, value = 'true'] = process.argv.slice(2);
  if (!username || !['true', 'false'].includes(value)) {
    console.error('Usage: npm run admin:set -- <username> [true|false]');
    process.exitCode = 1;
    return;
  }
  const user = await prisma.user.update({
    where: { username },
    data: { isAdmin: value === 'true' },
  });
  console.log(
    `@${user.username} (${user.fullName}) admin: ${user.isAdmin ? 'yes' : 'no'}`
  );
}

main().finally(() => prisma.$disconnect());
