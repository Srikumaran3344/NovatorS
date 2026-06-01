# NovatorS
"Novators" is a Latin-derived word meaning "innovators", hereby I present this project for the NS innovators.
# SAF Project Registry

Innovation project submission and approval registry for 1 SAF TPT BN.

## Tech stack

- **Next.js 14** (App Router) - frontend & API routes
- **Supabase** - database, authentication, storage, and real-time subscriptions
- **Vercel** - hosting (free)
- **Uptime Robot** - keeps the Supabase instance active on the free tier
- **Resend** - transactional email for all notifications
- **Tailwind CSS** - styling

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Set up Supabase

1. Create a project at https://supabase.com
2. Go to SQL Editor and run `supabase/schema.sql`
3. Go to Storage and create a bucket named `project-files` (set to private)
4. Copy your Project URL and anon key from Settings → API

### 4. Run locally

```bash
npm run dev
```

Visit http://localhost:3000

### 5. Deploy to Vercel

```bash
vercel
```

Add your environment variables when prompted.

## User roles

| Role | How assigned | Can do |
|---|---|---|
| **Submitter** | Default on signup | Submit projects, track status, vote, remark |
| **Approver** | Email in approver_emails table | Review + approve/reject projects |
| **Admin** | Set manually in profiles table | Everything + manage approver list |

## To set yourself as admin

In Supabase SQL Editor:
```sql
update public.profiles set role = 'admin' where email = 'your@email.com';
```

## Approval workflow

1. Submitter discusses with PC verbally
2. Submitter fills form → status: `submitted`
3. OC reviews → approves (`under_co_review`) or rejects (`rejected`)
4. CO reviews → publishes (`approved`) or rejects
5. Rejected projects can be archived by commanders

## File structure

```
src/
├── app/
│   ├── page.tsx              # Public registry
│   ├── layout.tsx            # Root layout + navbar
│   ├── dashboard/page.tsx    # My projects (submitter)
│   ├── submit/page.tsx       # Submit form
│   ├── approvals/page.tsx    # OC/CO approval queue
│   ├── admin/page.tsx        # Admin panel
│   └── projects/[id]/page.tsx # Project detail
├── components/
│   └── Navbar.tsx
└── lib/
    ├── supabase/
    │   ├── client.ts         # Browser client
    │   └── server.ts         # Server client
    └── types.ts              # TypeScript types
```