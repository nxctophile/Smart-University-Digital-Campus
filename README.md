# Campus OS — Central Institute of Technology

An AI-native, offline-first digital campus operating system built for the **Smart University Digital Campus** challenge (MPOnline Idea & Innovation Hackathon 2026).

> "We don't replace the university's existing systems. We unify them." The AI doesn't just answer questions — it looks up real data and takes authorized action.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The database (`data/campus.db`) ships pre-seeded with a full semester of realistic data for a fictional university — **Central Institute of Technology** — so the app works immediately with no setup.

To reset or regenerate the demo data at any time:

```bash
npm run db:push    # apply the Drizzle schema to data/campus.db
npm run db:seed     # wipe + reseed ~1,500 students, attendance, fees, exams, hostel, transport, helpdesk...
```

For the full PWA/service-worker experience (offline app-shell caching), run a production build instead of dev mode:

```bash
npm run build && npm run start
```

## The three moats

| | |
|---|---|
| **AI that acts** | The assistant on `/ai` (and the "Ask anything" box on Home) doesn't just chat — it calls real typed tools (`get_attendance`, `request_certificate`, `create_helpdesk_ticket`, `get_at_risk_students`, `notify_students`, ...) against the same service layer the REST API uses, with role-based access control enforced centrally, not by hiding buttons. Sensitive actions (filing a ticket, notifying parents) require an explicit confirm click. |
| **Offline-first** | A network simulator in the top bar (Online / Slow / Offline) drives a real IndexedDB cache-and-queue layer (`lib/client/api.ts`, `lib/offline/db.ts`). Reads are cached transparently; writes queue locally when offline and sync automatically the moment connectivity returns. A production build also registers a real service worker (`public/sw.js`) for app-shell + static-asset caching. |
| **Legacy-compatible import** | `/admin/import` accepts CSV/XLSX/JSON exports from an existing ERP, infers a column → canonical-field mapping with confidence scores (`lib/importer/mapping.ts`), lets an admin review/adjust it, then validates and imports — reconciling rows that already exist (matched by legacy ID) instead of duplicating them. The adapter interface (`lib/importer/adapters`) is built to extend to PostgreSQL/MySQL/SQL Server/Oracle/REST later. |

## Demo script

The seeded data is deliberately tuned to hit these exact numbers.

**1. Student dashboard** — sign in as the default demo user (Samarth Rathore, CSE, semester 3). Home shows 75% overall attendance, next class (DBMS, tomorrow, Room B-204), ₹12,500 fees pending (due Sep 30), and an upcoming DBMS midterm (Sep 28).

**2. AI retrieves + reasons** — on `/ai`, ask *"Can I miss tomorrow's DBMS class?"* The assistant fetches the real timetable and attendance, projects the post-absence percentage, and gives a grounded yes/no against the 75% threshold.

**3. AI acts** — ask *"I need my bonafide certificate."* It verifies identity, enrollment and fee status, generates the certificate, and shows View/Download actions — all before you land on `/documents`.

**4. Offline** — flip the network switcher (top bar) to **Offline**. Cached pages (Attendance, Fees, Documents, Home) keep working. Ask the AI to *"report a hostel Wi-Fi issue"* (or use the Helpdesk "New ticket" form) — it saves locally with a "waiting to sync" toast. Flip back to **Online** and watch it sync and post automatically.

**5. Legacy import** — switch role to **Administrator** (profile menu, top right) → **Data Import**. Click "Use sample legacy file" to load `public/samples/legacy_students.xlsx` (messy legacy headers like `stu_id`, `stud_name`, `course_nm`). Review the AI-suggested mapping and confidence scores, then import — it reports new vs. reconciled vs. skipped rows.

**6. Admin AI + action** — still as Administrator, ask *"Show students with attendance below 75% who have exams within the next 7 days"* on `/ai` (or use the filters on `/admin/students`). Select results and click **Notify Parents** — the key "AI can act on aggregate data" moment.

**7. Faculty & Parent** — switch role again to see the same underlying data reshaped: Faculty gets a class roster with per-student risk; Parent gets the same "my child's" dashboard a student would see, with nothing they shouldn't have access to.

## Architecture

```
UI (Next.js App Router, client components for offline-capable pages)
  │
  ├─ AI layer          lib/ai/{engine,tools,provider}.ts
  │                     rule-based NLU today; swap in an LLM tool-use loop later — same tool registry
  │
  ├─ Service layer      lib/services/*.ts
  │                     every read/write goes through here; role-based access enforced centrally
  │
  ├─ Repositories       lib/db/schema.ts (Drizzle ORM) → SQLite (data/campus.db)
  │
  └─ Importer           lib/importer/{adapters,mapping}.ts
                         Legacy ERP → adapter → AI-assisted mapping → validation → canonical model
```

**Offline:** `lib/client/api.ts` wraps every GET/mutation. GETs cache their response into IndexedDB (`lib/offline/db.ts`) and serve from that cache when the simulator is set to Offline. Mutations marked `offlineCapable` (helpdesk tickets, certificate/document requests) queue into an IndexedDB outbox instead of failing, and `lib/client/network.tsx` auto-flushes the queue whenever the mode leaves Offline.

**Why SQLite instead of Postgres:** the spec calls for Postgres, but for a prototype that a judge runs with `npm install && npm run dev` on the spot, requiring a running Postgres instance is friction with no payoff. Drizzle ORM's schema/query API is the same either way — swapping the driver in `lib/db/client.ts` is the only production change required.

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Drizzle ORM · SQLite (better-sqlite3) · Zod · Dexie (IndexedDB) · Recharts · Lucide icons

## Demo accounts

Seeded 1:1 per role — switch between them from the profile menu (top right), no passwords in this prototype:

| Role | Name |
|---|---|
| Student | Samarth Rathore — CSE, Semester 3 |
| Faculty | Rohan Pandey — teaches Samarth's DBMS section |
| Parent | Rakesh Rathore — Samarth's father |
| Admin | Priya Deshpande — Registrar |
