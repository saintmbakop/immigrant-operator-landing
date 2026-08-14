# The Restart Penalty Assessment

Landing page / lead magnet for **THE IMMIGRANT OPERATOR**. A static, single-page
site (no build step, no framework). `index.html` is the entire site.

Live at: **https://theimmigrantoperator.com** (once DNS is pointed, see below)
Interim GitHub Pages URL: **https://saintmbakop.github.io/immigrant-operator-landing/**

## Connecting the domain

This repo already contains a `CNAME` file with `theimmigrantoperator.com`, and
GitHub Pages is enabled to serve from the `main` branch root.

Once the domain is registered, add these DNS records at your registrar:

| Type  | Host | Value                  |
|-------|------|-------------------------|
| A     | @    | 185.199.108.153         |
| A     | @    | 185.199.109.153         |
| A     | @    | 185.199.110.153         |
| A     | @    | 185.199.111.153         |
| CNAME | www  | `saintmbakop.github.io` |

DNS propagation is usually minutes, sometimes up to a few hours. Once it
resolves, GitHub auto-provisions HTTPS for the domain (may take up to ~1 hour
after DNS first resolves). No action needed beyond adding the records.

## Connecting email capture (Supabase)

The results section has an email field wired to call the Supabase REST API
directly (`fetch`, no SDK). To activate it:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run:

   ```sql
   create table public.signups (
     id uuid primary key default gen_random_uuid(),
     email text not null,
     dominant_dimension text,
     scores jsonb,
     created_at timestamptz not null default now()
   );

   alter table public.signups enable row level security;

   -- Anonymous visitors may INSERT only. They can never read, update,
   -- or delete rows. Do not add a select policy for the anon role, or
   -- every visitor's email becomes publicly readable.
   create policy "Allow public inserts"
   on public.signups
   for insert
   to anon
   with check (true);
   ```

3. In your Supabase project: **Settings → API**, copy the **Project URL** and
   the **anon public key**.
4. In `index.html`, find the two lines near the top of the `<script>` block:

   ```js
   var SUPABASE_URL = 'YOUR_SUPABASE_URL';
   var SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```

   and replace both placeholder values. Commit and push. GitHub Pages
   redeploys automatically on every push to `main`.

The anon key is meant to be public and safe to ship in client-side code; the
RLS policy above is what keeps the data safe (insert-only, no read access).

## Local preview

No build step: just open `index.html` in a browser, or serve the folder:

```
npx serve .
```
