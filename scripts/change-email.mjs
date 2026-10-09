// Changes the sign-in email of one account.
// Usage: node scripts/change-email.mjs old@example.com new@example.com
import "dotenv/config";
import pg from "pg";

const [oldEmail, newEmail] = process.argv.slice(2).map((value) => value?.trim().toLowerCase());
if (!oldEmail || !newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
  console.error("Usage: node scripts/change-email.mjs <current email> <new email>");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const existing = await client.query('select id from "user" where lower(email) = $1', [newEmail]);
if (existing.rowCount) {
  console.error(`${newEmail} is already used by another account. Nothing was changed.`);
  await client.end();
  process.exit(1);
}
const updated = await client.query(
  'update "user" set email = $1, updated_at = now() where lower(email) = $2 returning id',
  [newEmail, oldEmail],
);
if (!updated.rowCount) {
  console.error(`No account found for ${oldEmail}. Run "node scripts/db-report.mjs" to see the emails that exist.`);
  await client.end();
  process.exit(1);
}
await client.end();
console.log(`Email changed from ${oldEmail} to ${newEmail}. Sign in with the new email.`);
