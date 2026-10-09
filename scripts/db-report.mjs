// Read-only report of what is in the UPSCALE database.
// Usage: node scripts/db-report.mjs            (everything)
//        node scripts/db-report.mjs lekki      (only workspaces whose name/slug contains "lekki")
// Prints no passwords, tokens or secrets. Message text is shortened.
import "dotenv/config";
import pg from "pg";

const filter = (process.argv[2] ?? "").toLowerCase();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function table(title, sql, params = []) {
  const { rows } = await client.query(sql, params);
  console.log(`\n=== ${title} (${rows.length}) ===`);
  if (rows.length) console.table(rows);
}

const like = `%${filter}%`;
const orgScope = "o.id in (select id from organizations where lower(name) like $1 or lower(slug) like $1)";

await table(
  "Workspaces",
  `select o.name, o.slug, o.plan, o.subscription_status as status, o.bachs_account_status as bachs,
          o.agent_name, to_char(o.created_at, 'YYYY-MM-DD HH24:MI') as created
   from organizations o where ${orgScope} order by o.created_at`,
  [like],
);

await table(
  "People (email + role + workspace). Passwords are hashed and cannot be shown.",
  `select u.email, u.name, m.role, o.slug as workspace, to_char(u.created_at, 'YYYY-MM-DD HH24:MI') as signed_up
   from members m join "user" u on u.id = m.user_id join organizations o on o.id = m.organization_id
   where ${orgScope} order by u.created_at`,
  [like],
);

await table(
  "Telegram bots",
  `select o.slug as workspace, t.bot_username, t.status, to_char(t.updated_at, 'YYYY-MM-DD HH24:MI') as updated
   from telegram_connections t join organizations o on o.id = t.organization_id where ${orgScope}`,
  [like],
);

await table(
  "Subscriptions",
  `select o.slug as workspace, s.plan, s.status, s.amount, to_char(s.trial_end, 'YYYY-MM-DD') as trial_end,
          to_char(s.current_period_end, 'YYYY-MM-DD') as period_end
   from subscriptions s join organizations o on o.id = s.organization_id where ${orgScope}`,
  [like],
);

await table(
  "Knowledge entries",
  `select o.slug as workspace, k.kind, count(*) as entries, sum((not k.available)::int) as unavailable
   from knowledge_items k join organizations o on o.id = k.organization_id where ${orgScope} group by 1, 2`,
  [like],
);

await table(
  "Leads",
  `select o.slug as workspace, l.name, l.stage, l.score, l.source, left(coalesce(l.need, ''), 40) as need,
          l.handed_off, to_char(l.created_at, 'YYYY-MM-DD HH24:MI') as created
   from leads l join organizations o on o.id = l.organization_id where ${orgScope}
   order by l.created_at desc limit 25`,
  [like],
);

await table(
  "Conversations",
  `select o.slug as workspace, c.channel, c.status, c.ai_paused,
          (select count(*) from messages m where m.conversation_id = c.id) as messages,
          to_char(c.updated_at, 'YYYY-MM-DD HH24:MI') as updated
   from conversations c join organizations o on o.id = c.organization_id where ${orgScope}`,
  [like],
);

await table(
  "Last 15 messages",
  `select to_char(m.created_at, 'MM-DD HH24:MI:SS') as at, o.slug as workspace, m.role, left(m.content, 90) as content
   from messages m join organizations o on o.id = m.organization_id where ${orgScope}
   order by m.created_at desc limit 15`,
  [like],
);

await table(
  "Telegram updates by status",
  `select t.status, count(*) as total, to_char(max(t.received_at), 'MM-DD HH24:MI') as last_seen
   from telegram_updates t join organizations o on o.id = t.organization_id where ${orgScope} group by 1`,
  [like],
);

await table(
  "Broadcast campaigns",
  `select o.slug as workspace, b.name, b.status, to_char(b.created_at, 'MM-DD HH24:MI') as created,
          (select count(*) filter (where r.status = 'SENT') from broadcast_recipients r where r.campaign_id = b.id) as sent,
          (select count(*) filter (where r.status = 'FAILED') from broadcast_recipients r where r.campaign_id = b.id) as failed
   from broadcast_campaigns b join organizations o on o.id = b.organization_id where ${orgScope} order by b.created_at desc`,
  [like],
);

await table(
  "Appointments",
  `select o.slug as workspace, a.title, a.status, to_char(a.starts_at, 'YYYY-MM-DD HH24:MI') as starts
   from appointments a join organizations o on o.id = a.organization_id where ${orgScope} order by a.starts_at desc limit 10`,
  [like],
);

await table(
  "Payments",
  `select o.slug as workspace, p.type, p.status, p.amount, p.currency, to_char(p.created_at, 'MM-DD HH24:MI') as created
   from payments p join organizations o on o.id = p.organization_id where ${orgScope} order by p.created_at desc limit 10`,
  [like],
);

await client.end();
console.log("\nDone. Nothing was changed.");
