# AI Job Search Platform

An AI-powered job search application that combines semantic search, resume-based recommendations, and automated multi-source job ingestion.

This project was built to solve three practical problems in job discovery:

1. Keyword-only search misses relevant jobs.
2. Recommendations are weak without user profile context.
3. Job feeds go stale quickly if freshness is not actively managed.

---

## Product Highlights

- Semantic job search using OpenAI embeddings and Supabase pgvector.
- Resume upload + parsing + profile enrichment.
- Personalized recommendations from resume/profile signals.
- AI job match explanation including:
	- why this role matches
	- what is missing
	- what to learn next
- Responsive feed UI with modern card + modal detail flow.
- Multi-source ingestion (Adzuna + Greenhouse) with stale job pruning.
- Free-tier-friendly cron architecture with split sync jobs.

---

## Tech Stack

- Frontend: Next.js 16, React 19, Tailwind CSS, Framer Motion
- Auth: NextAuth v5 (Google)
- Database: Supabase (Postgres + pgvector)
- Caching: Upstash Redis
- AI:
	- OpenAI embeddings for semantic retrieval
	- Anthropic for explanation generation
- Automation: Vercel Cron + secure internal cron routes

---

## System Architecture

```mermaid
flowchart TD
	U[User] --> F[Feed UI]
	F --> S[/api/search]
	F --> R[/api/recommendations]
	F --> E[/api/explain]
	U --> O[Onboarding Resume Upload]
	O --> RU[/api/resume]

	S --> OE[OpenAI Embeddings]
	S --> DB[(Supabase Jobs + pgvector)]
	R --> DB
	R --> OE
	E --> AN[Anthropic]
	E --> RC[(Upstash Redis)]
	S --> RC

	C1[Vercel Cron: Adzuna] --> J1[/api/cron/sync-adzuna]
	C2[Vercel Cron: Greenhouse] --> J2[/api/cron/sync-greenhouse]
	C3[Vercel Cron: Prune] --> J3[/api/cron/prune-jobs]

	J1 --> ING[scripts/real-time-data.ts]
	J2 --> ING
	J3 --> ING
	ING --> DB
	ING --> OE
```

---

## Core Features

### 1) Semantic Search
- Converts user query to embedding.
- Runs vector similarity search via Supabase RPC (`match_jobs`).
- Returns relevant jobs beyond exact keyword matches.
- Redis cache speeds up repeated searches.

### 2) Resume-Powered Recommendations
- Users upload resume in onboarding.
- Resume text and skills are extracted.
- Embedding is generated and saved.
- Recommendations endpoint retrieves high-similarity jobs via resume embedding.

### 3) AI Match Explanation
- Explanation endpoint returns structured JSON:
	- summary
	- matchScore
	- whyMatch
	- missingAreas
	- learningPlan
- UI renders explanation progressively for a streaming-like experience.

### 4) Job Freshness and Pipeline Reliability
- Source-specific external IDs avoid cross-source collisions.
- Unchanged jobs are skipped to reduce embedding cost.
- Old jobs are pruned to avoid stale/closed listings.
- Ingestion split into separate cron routes to reduce timeout risk on free tier.

---

## Cron Strategy (Free Tier Optimized)

Configured in `vercel.json`:

- `/api/cron/sync-adzuna` at `0 3 * * *`
- `/api/cron/sync-greenhouse` at `30 3 * * *`
- `/api/cron/prune-jobs` at `15 4 */2 * *`

Why split cron jobs?

- Smaller execution windows per source
- Lower timeout probability on Vercel Hobby
- Better observability and simpler retries

---

## Project Structure (Important Paths)

- `app/feed/page.tsx` - main search and recommendation UI
- `app/onboarding/page.tsx` - resume upload flow
- `app/api/search/route.ts` - semantic search API
- `app/api/recommendations/route.ts` - resume recommendation API
- `app/api/explain/route.ts` - AI explanation API
- `scripts/real-time-data.ts` - ingestion + dedupe + freshness pipeline
- `app/api/cron/*` - scheduled and manual sync endpoints
- `lib/auth.ts` - NextAuth setup and onboarding state wiring
- `lib/openai.ts` - embedding helper
- `lib/redis.ts` - cache client and key helpers

---

## Environment Variables

Create `.env.development` with values for:

### Core
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Authentication
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### AI and Cache
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Ingestion Sources
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`
- `GREENHOUSE_BOARDS` (comma-separated, optional)

### Cron Security
- `CRON_SECRET`

### Ingestion Tuning (optional)
- `JOB_MAX_AGE_DAYS` (default `30`)
- `JOB_PRUNE_AGE_DAYS` (default `45`)
- `ADZUNA_RESULTS_PER_QUERY` (default `20`)
- `ADZUNA_PAGES` (default `2`)

---

## Local Setup

```bash
npm install
npm run dev
```

App URL: `http://localhost:3000`

---

## Useful Commands

```bash
npm run dev
npm run lint
npm run build
npm run jobs:realtime
```

---

## Manual Sync Trigger (Interview Demo Friendly)

A secure on-demand trigger is available at:

- `GET /api/cron/manual-trigger?target=adzuna`
- `GET /api/cron/manual-trigger?target=greenhouse`
- `GET /api/cron/manual-trigger?target=all`
- `GET /api/cron/manual-trigger?target=prune`

Requires header:

`Authorization: Bearer <CRON_SECRET>`

This is useful during demos so you can refresh data live without waiting for scheduled cron.

---

## Data Model Expectations

The jobs table is expected to include fields used by APIs and UI, including:

- core metadata (`title`, `company`, `location`, `type`, `description`)
- salary fields (`salary_min`, `salary_max`, `currency`)
- source tracking (`source`, `external_id`, `posted_at`)
- vector column for similarity search (`embedding`)

Supabase functions used:

- `match_jobs`
- `match_jobs_for_resume` (with fallback behavior in API)

---

## Engineering Decisions and Trade-offs

### What this project does well
- Strong retrieval quality using embeddings.
- Fast repeat response times via Redis caching.
- Clear onboarding gate and resume update flow.
- Separation of scheduled tasks to fit free-tier constraints.

### Trade-offs
- Streaming explanation is UI-simulated for reliability and consistent payload structure.
- Freshness is primarily date-driven; true closed-role detection can be further improved with optional link-health checks.

---

## Future Improvements

- Add source-level health metrics and dashboard.
- Add apply URL validity checks (HEAD/GET probe) before surfacing roles.
- Add lightweight admin panel to trigger and inspect sync stats.
- Add unit/integration tests for ingestion and API contracts.

---

## Interview Walkthrough Script (2-3 minutes)

1. Problem: job discovery is noisy and stale.
2. Solution: semantic retrieval + resume grounding + freshness pipeline.
3. Demo flow:
	 - sign in and upload resume
	 - open feed recommendations
	 - run manual trigger for new jobs
	 - open job detail modal to show AI explanation and gap analysis
4. Scale/free-tier note:
	 - split cron architecture prevents timeouts and reduces cost.

---

## License

For interview and educational use.
