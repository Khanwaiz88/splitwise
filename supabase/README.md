# Supabase Database Migrations

Ab SQL manually paste karne ki zaroorat nahi — ek command se database update ho jayega.

## Pehli dafa setup (sirf ek bar)

### 1. Database password `.env.local` mein add karein

Supabase Dashboard → **Project Settings** → **Database** → **Database password**

Apni `.env.local` file mein ye line add karein:

```env
SUPABASE_DB_PASSWORD=apna-database-password-yahan
```

### 2. Migrations push karein

```bash
npm run db:push
```

Bas! Saari migrations automatically remote Supabase database par apply ho jayengi.

---

## Rozana use

Jab bhi nayi migration add ho:

```bash
npm run db:push
```

---

## Nayi migration banana

```bash
npm run db:new -- migration_ka_naam
```

Ye `supabase/migrations/` mein naya SQL file banata hai. Us mein apna SQL likhein, phir:

```bash
npm run db:push
```

---

## Available commands

| Command | Kaam |
|---------|------|
| `npm run db:push` | Saari pending migrations remote DB par apply karein |
| `npm run db:new -- naam` | Nayi migration file banayein |
| `npm run db:status` | Kaun si migrations apply hui hain — check karein |
| `npm run db:reset` | Local Supabase reset (local dev ke liye) |

---

## Migration files

| File | Description |
|------|-------------|
| `20260714120000_initial_schema.sql` | Tables: profiles, groups, group_members, expenses, activity_log |
| `20260714120001_fix_rls_and_group_rpcs.sql` | RLS fix + `get_user_groups()` RPC |

---

## Troubleshooting

**"SUPABASE_DB_PASSWORD missing"**  
→ `.env.local` mein password add karein (upar dekhein)

**"connection refused"**  
→ Password sahi hai? Supabase project paused to nahi?

**"migration already applied"**  
→ Normal hai — matlab pehle se apply ho chuki hai

**RLS recursion error**  
→ `npm run db:push` dubara run karein — migration `20260714120001` fix karti hai
