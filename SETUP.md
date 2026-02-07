# Scarepark Queue Management System — Setup Guide

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon/public API key** from:
   - Settings → API → Project URL
   - Settings → API → Project API keys → `anon` `public`

## 2. Configure Environment Variables

Edit `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Set Up the Database

1. In your Supabase dashboard, go to **SQL Editor**
2. Paste and run the contents of `supabase/seed.sql`

This creates the `attractions` table, enables Row Level Security, sets up realtime, and seeds the 5 attractions.

## 4. Enable Realtime (verify)

1. Go to **Database → Replication** in the Supabase dashboard
2. Ensure the `attractions` table has realtime enabled (the seed SQL does this, but verify it shows as enabled)

## 5. Create a Staff User

1. Go to **Authentication → Users** in the Supabase dashboard
2. Click **Add User → Create New User**
3. Enter a shared staff email and password (e.g., `staff@scarepark.com` / `YourPassword123`)
4. This is the login used by all staff on the `/admin` page

## 6. Run the App

```bash
npm run dev
```

- **Public TV Display:** http://localhost:3000/tv
- **Staff Control Panel:** http://localhost:3000/admin (redirects to login)

## How It Works

- `/tv` — Shows all attractions with realtime updates. Adapts layout based on screen orientation (landscape = multi-column grid, portrait = single column)
- `/admin/login` — Staff login using Supabase Auth
- `/admin` — Dashboard to control status and wait times. Changes propagate instantly to the TV display via Supabase Realtime
- "Close All" button sets every attraction to CLOSED with a confirmation modal safety mechanism
