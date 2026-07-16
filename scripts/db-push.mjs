/**
 * Push Supabase migrations to remote database.
 * Reads credentials from .env.local — no manual SQL paste needed.
 *
 * Required in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
 *   SUPABASE_DB_PASSWORD=your-database-password
 *
 * Optional (recommended on IPv4-only networks / when db.*.supabase.co fails):
 *   SUPABASE_DB_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres
 *   SUPABASE_DB_REGION=ap-south-1
 *
 * Get connection string: Supabase Dashboard → Project Settings → Database → Connection pooling → Session mode
 */
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const POOLER_REGIONS = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-east-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-central-2',
  'eu-north-1',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'sa-east-1',
  'me-central-1',
  'me-south-1',
  'af-south-1',
];

function loadEnvFile(filename) {
  const path = resolve(root, filename);
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function runDbPush(dbUrl) {
  try {
    execSync(`npx supabase db push --db-url "${dbUrl}"`, {
      cwd: root,
      stdio: ['inherit', 'inherit', 'pipe'],
      env: { ...process.env },
    });
  } catch (err) {
    const stderr = err && typeof err === 'object' && 'stderr' in err ? String(err.stderr ?? '') : '';
    throw new Error(`${stderr}\n${err instanceof Error ? err.message : String(err)}`);
  }
}

function isRetryableError(err) {
  const text = String(err?.message ?? err).toLowerCase();
  return (
    text.includes('enotfound') ||
    text.includes('nxdomain') ||
    text.includes('no such host') ||
    text.includes('hostname resolving') ||
    text.includes('econnrefused') ||
    text.includes('etimedout') ||
    text.includes('network') ||
    text.includes('failed to connect') ||
    text.includes('tenant/user') ||
    text.includes('not found (sqlstate xx000)')
  );
}

const env = { ...loadEnvFile('.env'), ...loadEnvFile('.env.local') };

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const dbPassword = env.SUPABASE_DB_PASSWORD;
const customDbUrl = env.SUPABASE_DB_URL;
const dbRegion = env.SUPABASE_DB_REGION;

if (!customDbUrl && !supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL missing in .env.local');
  process.exit(1);
}

if (!customDbUrl && !dbPassword) {
  console.error('❌ SUPABASE_DB_PASSWORD missing in .env.local');
  console.error('');
  console.error('Add your database password to .env.local:');
  console.error('  SUPABASE_DB_PASSWORD=your-password-here');
  console.error('');
  console.error('Find it: Supabase Dashboard → Project Settings → Database → Database password');
  process.exit(1);
}

const refMatch = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/);
const projectRef = refMatch?.[1] ?? null;
const encodedPassword = dbPassword ? encodeURIComponent(dbPassword) : '';

/** Direct host — IPv6 only on newer Supabase projects */
function directUrl(ref) {
  return `postgresql://postgres:${encodedPassword}@db.${ref}.supabase.co:5432/postgres`;
}

/** Supavisor session mode — IPv4 compatible */
function poolerUrl(ref, region, prefix = 'aws-0') {
  return `postgresql://postgres.${ref}:${encodedPassword}@${prefix}-${region}.pooler.supabase.com:5432/postgres`;
}

const candidates = [];

if (customDbUrl) {
  candidates.push({ label: 'SUPABASE_DB_URL from .env.local', url: customDbUrl });
}

if (projectRef && dbPassword) {
  const prefixes = ['aws-1', 'aws-0'];
  if (dbRegion) {
    for (const prefix of prefixes) {
      candidates.push({ label: `Pooler (${prefix}-${dbRegion})`, url: poolerUrl(projectRef, dbRegion, prefix) });
    }
  } else {
    for (const prefix of prefixes) {
      for (const region of POOLER_REGIONS) {
        candidates.push({ label: `Pooler (${prefix}-${region})`, url: poolerUrl(projectRef, region, prefix) });
      }
    }
  }
  candidates.push({ label: 'Direct (db.*.supabase.co — IPv6)', url: directUrl(projectRef) });
}

console.log(`\n🚀 Pushing migrations${projectRef ? ` to project: ${projectRef}` : ''}\n`);

let lastError = null;

for (const { label, url } of candidates) {
  console.log(`Trying ${label}…`);
  try {
    runDbPush(url);
    console.log('\n✅ Migrations applied successfully!\n');
    if (label.startsWith('Pooler') && !dbRegion && !customDbUrl && projectRef) {
      const region = label.match(/\(([^)]+)\)/)?.[1];
      if (region) {
        console.log(`💡 Tip: add to .env.local for faster pushes next time:`);
        console.log(`   SUPABASE_DB_REGION=${region}\n`);
      }
    }
    process.exit(0);
  } catch (err) {
    lastError = err;
    if (!isRetryableError(err)) {
      console.error('\n❌ Migration push failed (not a network/DNS issue). Check errors above.\n');
      process.exit(1);
    }
    console.log(`   ↳ connection failed, trying next…\n`);
  }
}

console.error('\n❌ Could not connect to Supabase database.\n');
console.error('Your network may not support IPv6 (direct db.*.supabase.co). Fix options:\n');
console.error('1. Supabase Dashboard → Project Settings → Database → Connection pooling');
console.error('   Copy "Session mode" URI and add to .env.local as SUPABASE_DB_URL=...\n');
console.error('2. Or set SUPABASE_DB_REGION=your-aws-region (e.g. ap-south-1)\n');
if (lastError) {
  console.error('Last error:', String(lastError.message ?? lastError).split('\n')[0]);
}
process.exit(1);
