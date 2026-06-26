# Support Router

**Support Router** automatically classifies incoming customer support messages—assigning priority, sentiment, summary, and department—so teams spend less time on manual triage. Operators review results on a dashboard and can override routing when needed.

**Live demo:** [support-router.vercel.app](https://support-router.vercel.app/)

---

## Why this exists

Support teams often read every ticket by hand to decide urgency and who should handle it. That work is slow, inconsistent, and does not scale with volume. Support Router handles the first pass: AI reads each message, routes it to the right department, and logs the decision. Humans stay in control with one-click overrides.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend & API | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| AI | OpenAI Chat Completions (`gpt-4o-mini`) |
| Deployment | Vercel |

---

## What it does

1. **Ingest** — Customer tickets arrive via `POST /api/tickets` (email, subject, message).
2. **Classify** — OpenAI returns structured JSON: sentiment, priority, summary, suggested department, and confidence score.
3. **Route** — The ticket is saved to Postgres with the matched department.
4. **Audit** — Every AI run is logged in `ai_logs` for review and debugging.
5. **Override** — Staff can reassign departments from the dashboard; manual changes are tracked separately from AI routing.

---

## Screenshots

### Dashboard — metrics and ticket queue

![Operations dashboard overview](public/images/dashboard-main.png)

Open ticket counts, high-priority load, and average AI confidence appear above a live ticket table backed by Supabase.

### Simulate a customer ticket

![Simulate Customer Ticket modal](public/images/ticket-modal.png)

Submit a test ticket through the same API path used in production—no internal tools required.

### Department override

![Department dropdown override control](public/images/dropdown-override.png)

Operators can change the assigned department; the system records whether routing was AI-driven or manual.

---

## Local setup

**Prerequisites:** Node.js 18+, a Supabase project, and an OpenAI API key.

```bash
git clone https://github.com/RichTravels/support-router.git
cd support-router
npm install
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | From Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | Server-side reads and writes |
| `OPENAI_API_KEY` | Yes | Server-only; never expose as `NEXT_PUBLIC_*` |

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the dashboard. Use the "Simulate Customer Ticket" button or send a POST to `/api/tickets`:

```json
{
  "customer_email": "customer@example.com",
  "subject": "Billing question",
  "message": "I was charged twice this month."
}
```

**Other commands:**

```bash
npm run lint
npm run build
```

---

## Database

The app expects three Supabase/Postgres tables: `departments`, `tickets`, and `ai_logs`. See `.env.example` for the full environment variable list.

---

## License

Private / portfolio use unless otherwise noted by the repository owner.
