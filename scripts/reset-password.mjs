// Sets a new password for one account. Passwords are stored hashed, so they can only be replaced, never read.
// Usage: node scripts/reset-password.mjs you@example.com "NewPassword-123"
import "dotenv/config";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";

const [email, newPassword] = process.argv.slice(2);
if (!email || !newPassword) {
  console.error('Usage: node scripts/reset-password.mjs <email> "<new password, 8+ characters>"');
  process.exit(1);
}
if (newPassword.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const user = await client.query('select id from "user" where lower(email) = lower($1)', [email]);
if (!user.rowCount) {
  console.error(`No account found for ${email}. Run "node scripts/db-report.mjs" to see the emails that exist.`);
  await client.end();
  process.exit(1);
}

const hash = await hashPassword(newPassword);
const updated = await client.query(
  `update account set password = $1, updated_at = now()
   where user_id = $2 and provider_id = 'credential'`,
  [hash, user.rows[0].id],
);
if (!updated.rowCount) {
  console.error("This account has no email-and-password login to reset.");
  await client.end();
  process.exit(1);
}
// Sign out everywhere so only the new password works.
await client.query("delete from session where user_id = $1", [user.rows[0].id]);
await client.end();
console.log(`Password updated for ${email}. You can sign in now.`);
