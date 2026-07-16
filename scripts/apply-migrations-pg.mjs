/**
 * Apply migrations via postgres when supabase CLI pooler fails.
 * Usage: node scripts/apply-migrations-pg.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const migrationsDir = resolve(root, 'supabase/migrations');

function loadEnvFile(name) {
  const path = resolve(root, name);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...loadEnvFile('.env'), ...loadEnvFile('.env.local') };
const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = encodeURIComponent(env.SUPABASE_DB_PASSWORD ?? '');
const customUrl = env.SUPABASE_DB_URL;

const regions = [
  'ap-south-1', 'ap-southeast-1', 'eu-west-1', 'eu-central-1',
  'us-east-1', 'us-west-1', 'us-west-2',
];

const poolerPrefixes = ['aws-1', 'aws-0'];

function buildCandidates() {
  const list = [];
  if (customUrl) list.push(customUrl);
  if (ref && password) {
    list.push(`postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`);
    for (const prefix of poolerPrefixes) {
      for (const region of regions) {
        list.push(
          `postgresql://postgres.${ref}:${password}@${prefix}-${region}.pooler.supabase.com:5432/postgres`,
        );
        list.push(
          `postgresql://postgres.${ref}:${password}@${prefix}-${region}.pooler.supabase.com:6543/postgres`,
        );
      }
    }
  }
  return list;
}

async function tryConnect(url) {
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  return client;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations_cli (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function getApplied(client, migrationFiles) {
  const applied = new Set();

  try {
    const { rows } = await client.query(
      'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version',
    );
    for (const row of rows) {
      const match = migrationFiles.find((f) => f.startsWith(String(row.version)));
      if (match) applied.add(match);
    }
  } catch {
    /* table may not exist */
  }

  try {
    const { rows } = await client.query(
      'SELECT filename FROM public.schema_migrations_cli ORDER BY filename',
    );
    for (const row of rows) applied.add(row.filename);
  } catch {
    /* ignore */
  }

  const { rows: tables } = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN ('groups', 'group_invites', 'conversations', 'messages')
  `);
  const names = new Set(tables.map((t) => t.tablename));
  if (names.has('groups')) {
    for (const f of migrationFiles) {
      if (f <= '20260715170000_group_currency.sql') applied.add(f);
    }
  }
  if (names.has('group_invites')) {
    for (const f of migrationFiles) {
      if (
        f === '20260714153000_group_invites.sql' ||
        f === '20260714154000_fix_group_invites.sql' ||
        f === '20260715210000_invite_inbox.sql' ||
        f === '20260715220000_invite_manual_accept.sql'
      ) {
        applied.add(f);
      }
    }
  }
  if (names.has('conversations')) {
    applied.add('20260716140000_chat.sql');
  }

  return applied;
}

async function applyFile(client, filename, sql) {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'INSERT INTO public.schema_migrations_cli (filename) VALUES ($1) ON CONFLICT DO NOTHING',
      [filename],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let client = null;
let usedUrl = '';

for (const url of buildCandidates()) {
  const host = url.replace(/:[^:@]+@/, ':***@').slice(0, 80);
  process.stdout.write(`Trying ${host}… `);
  try {
    client = await tryConnect(url);
    usedUrl = url;
    console.log('OK');
    break;
  } catch {
    console.log('failed');
  }
}

if (!client) {
  console.error('\nCould not connect. Add SUPABASE_DB_URL to .env.local from Supabase Dashboard.');
  process.exit(1);
}

try {
  await ensureMigrationsTable(client);
  const applied = await getApplied(client, files);
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('\nAll migrations already applied.');
  } else {
    console.log(`\nApplying ${pending.length} migration(s)…\n`);
    for (const file of pending) {
      const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
      process.stdout.write(`  ${file}… `);
      try {
        await applyFile(client, file, sql);
        console.log('done');
      } catch (err) {
        console.log('FAILED');
        console.error(err.message);
        process.exit(1);
      }
    }
    console.log('\nMigrations applied successfully.');
  }

  if (usedUrl.includes('pooler') && !env.SUPABASE_DB_URL) {
    const region = usedUrl.match(/aws-\d+-([^.]+)\.pooler/)?.[1];
    const prefix = usedUrl.match(/(aws-\d+)-/)?.[1];
    if (region) {
      console.log(`\nTip: add to .env.local:\nSUPABASE_DB_REGION=${region}`);
      if (prefix === 'aws-1') console.log('# Note: this project uses aws-1 pooler hosts');
    }
  }
} finally {
  await client.end();
}
