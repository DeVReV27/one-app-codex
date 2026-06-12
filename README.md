# One!

One! is a mobile-first daily score tracker for spotting Dodge Durangos and Tesla Cybertrucks.

## Scoring

- Dodge Durango: `+1`
- Tesla Cybertruck: `+0.5`
- Wrong vehicle: `-1`

Scores are stored locally in the browser by calendar day. A new day starts at zero automatically, while previous days stay visible in the month calendar.

## Supabase

The app is configured for a shared private Supabase scoreboard with no login:

- URL: `https://tgibfvgfcaxuyprmpons.supabase.co`
- Table: `public.sightings`
- Shared game id: `one-family-scoreboard`

Before deploying, open the Supabase SQL Editor and run:

```sql
-- See supabase-schema.sql in this folder.
```

That script creates the table, enables Row Level Security, and adds narrow public policies for this one shared scoreboard. The browser uses the Supabase publishable key. Never put a service role key or secret key in this app.

The app keeps `localStorage` as a fallback. If Supabase is unavailable, calls still work locally and sync is retried on the next load.

If Supabase logs show `relation "supabase_migrations.schema_migrations" does not exist` with
`application_name: supabase/dashboard`, that log is from Supabase Dashboard checking migration
history. It is separate from the app's `public.sightings` reads/writes.

## Run locally

Use any static file server from this folder:

```sh
npx serve .
```

For Vercel, import this folder as a project. No build command is required.

## Image Credits

- Dodge Durango photo: Bull-Doser, public domain, Wikimedia Commons.
- Tesla Cybertruck photo: John Bauld, CC BY 2.0, Wikimedia Commons.
