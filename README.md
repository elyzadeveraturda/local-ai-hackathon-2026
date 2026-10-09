# SoloOps AI — Your Private, Offline Personal AI Assistant

> One person. Multiple roles. One private AI assistant.

SoloOps AI is a private, local-first assistant for one person juggling many roles — a student keeping up with classes and a scholarship, running a camera rental side business, helping manage the family's rental property, posting on TikTok, and staying on top of personal life. Each role is a **Space**; everything you save stays in a local SQLite file, and all AI inference runs on your machine through [Ollama](https://ollama.com) using `qwen2.5:3b`.

## Features

- **Overview** — a calm home for the whole day: greeting, per-space cards with pending counts and next deadlines, a conflict banner when two commitments collide, "Your next moves" (all pending tasks across spaces, prioritised deterministically in Philippine time: Overdue → Due today → Due within 3 days → Later → No date), "Today's rhythm" (today's timed schedule), and an on-device assistant panel. Quick-add tasks inline.
- **My Spaces** — organize every part of your life into spaces across 5 categories (Academic, Business, Content Creation, Personal, Custom), each with a free-text type, description and its own color. Each space gets its own page: stats, pending tasks, and a 14-day upcoming schedule. Quick-fill templates (College & Scholarship, Camera Rental, Family Property, TikTok Content, Personal Goals) prefill the form without saving.
- **Calendar** — one week view (Mon–Sun columns) across every space: untimed "Due" chips, timed blocks in each space's color, and **conflict detection** computed deterministically from saved start/end times — overlapping commitments get a danger border and a "Two places at one time" card. Nothing is moved automatically.
- **AI Capture** — paste any text or message (school notices, booking requests, content to-dos, personal reminders); local AI extracts `record_type`, `title`, `person`, `subject`, `due_date`, `due_time`, `end_time`, `amount` and `notes`, using the selected space's name/category/type/description as context. Deterministic guards post-process the model output: relative weekday phrases ("next Tuesday", "by Friday") are resolved to real dates in code, time ranges become start/end times, hallucinated dates/amounts/people with no textual evidence are nulled, and titles are stripped of date/time fragments.
- **Review & Save as Task** — every extracted field is editable before saving; validation, clear errors, and duplicate-save protection (UI lock + backend `409`).
- **Ask SoloOps (Assistant)** — grounded Q&A over your saved records, scoped to **All Spaces** or a **Selected Space**. Only saved records are treated as facts: answers start with "From your saved records:" (task titles, spaces, due status) followed by clearly-labelled "Suggestions:". It can explain schedule conflicts, suggest options and draft short messages — but it never changes, moves, cancels or confirms anything. Conversations are never stored.
- **Focus mode** — a distraction-free full-screen view: pick one task, get a context-aware focus plan from local AI (tailored to the space's category — studying, content editing, customer follow-up, errands), a Pomodoro timer (5/15/25/50 min or custom) with a progress bar, a tickable checklist, and a deterministic fallback checklist if Ollama is down.

- **Floating Pomodoro** — the same shared timer floats over every page: a small round button that becomes a live pill while running, expands into a mini timer card with presets and an optional linked task, counts down in the browser tab title, survives reloads, and can pop out into an always-on-top Picture-in-Picture window (Chrome) so it floats over other tabs and apps.

- **Whole-day & multi-day tasks** — every task form has a "Whole day" switch: date-only tasks for appointments and deadlines, multi-day spans for trips or exam weeks (shown in the calendar's all-day row across every covered day), and timed events with start/end times.

- **Calendar** — a real week view with a 24-hour time grid (overlap-aware side-by-side events, all-day row, today highlight, now-line) and a month view; deterministic conflict detection flags overlapping timed tasks and computes a suggested reschedule — never applied automatically.

## AI that actually works for you

All AI runs on-device via Ollama (`qwen2.5:3b` on `127.0.0.1:11434`); deterministic code retrieves, validates and post-processes everything the model touches.

- **Plan my day** (`POST /briefing`) — the Overview card asks local AI for a 2-sentence summary, ordered priorities and suggested time blocks. Blocks are validated in code against free slots computed from your saved timed tasks (invalid ids, out-of-slot starts and overlaps are dropped, snapped or trimmed — never trusted), and can be added to the calendar with one click. Nothing changes without your confirmation; if Ollama is down you get a deterministic basic plan.
- **AI Capture** — extraction with auto-detected space (`space_name`/keyword fallback), plus the deterministic guards above (dates, times, people, amounts, titles).
- **Assistant** — answers grounded only in saved SQLite records ("From your saved records:" vs "Suggestions:"), explains conflicts with computed suggestions and drafts reschedule messages; it never mutates anything.
- **Lock In focus plans** — space-aware checklists generated for the task at hand, with a built-in fallback.

## Requirements

- Python 3.10+
- Node.js 20+ (npm)
- Ollama with the `qwen2.5:3b` model

## Setup (macOS, one time)

```bash
# 1. Ollama + model (needs internet once)
brew install ollama            # or download from https://ollama.com/download
ollama serve                   # skip if the Ollama app is already running
ollama pull qwen2.5:3b         # in another terminal

# 2. Backend
cd soloops/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Frontend
cd ../frontend
npm install
```

Windows: same steps, but activate the venv with `.venv\Scripts\activate`.

## Run (three terminals)

```bash
# Terminal 1 — local AI (skip if the Ollama app is running)
ollama serve

# Terminal 2 — API on http://127.0.0.1:8000
cd soloops/backend && source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 3 — UI on http://localhost:5173
cd soloops/frontend
npm run dev
```

Open http://localhost:5173. Everything binds to `127.0.0.1`/`localhost` only, so your records are not exposed on your network.

The database lives at `soloops/backend/soloops.db` (created automatically). Existing databases are upgraded in place via additive migrations only (`tasks.due_time`, `tasks.end_time`, `tasks.end_date`, `businesses.category` default `'Business'`). Internally the `businesses` table and `/businesses` endpoints represent Spaces — the UI terminology changed, the schema did not. Set `SOLOOPS_DB_PATH` to use a different file. To back up:

```bash
cp soloops/backend/soloops.db soloops/backend/backups/soloops-$(date +%Y%m%d-%H%M%S).db
```

## Privacy

- All AI inference runs locally via Ollama at `127.0.0.1:11434` (`qwen2.5:3b`); the FastAPI backend binds to `127.0.0.1` and the Vite dev server to `localhost`.
- No cloud APIs, no telemetry, no external services. The frontend loads no external fonts, scripts, or assets — everything is served locally. Chat conversations are held in React state only and are never written to disk.
- Verify offline operation yourself with the manual test below.

## Tests

```bash
cd soloops/backend && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q tests          # Ollama is mocked; uses a temp database

cd ../frontend
npm run build && npm run lint
```

## Offline test (manual)

1. Make sure `qwen2.5:3b` is already pulled (`ollama list`).
2. Start Ollama, the backend and the frontend as above.
3. **Turn Wi-Fi off** (Control Center) and unplug ethernet.
4. Verify: `curl http://127.0.0.1:11434/api/tags` responds, and `curl http://127.0.0.1:8000/health` returns `{"ollama":"connected"}`.
5. Run an AI Capture, generate a Lock In plan (badge shows "Generated by local AI"), and ask a question in Ask SoloOps — all should work.
6. Optional: quit Ollama entirely — AI Capture and Ask SoloOps show a clear "Local AI unavailable" error, while the Dashboard, tasks, and Lock In's fallback checklist keep working.

## Acceptance workflows

1. **Academic** — My Spaces → click the *College & Scholarship* template chip → Create Space → AI Capture → select it, paste `Reminder: Scholarship renewal documents must be submitted on October 15.` → Analyze with Local AI → review → Save as Task → Dashboard shows it under Today's Attention → Lock In → Generate Plan → Start the timer → tick a step → Mark Task Complete.
2. **Business** — create a Camera Rental space → AI Capture → paste `Maria wants to rent the camera on Saturday at 3 PM.` → extraction fills person, subject, date and time → Save → refresh the browser → the task persists in Today's Attention.
3. **Content** — create a TikTok Content space → AI Capture → paste `I need to finish editing my TikTok video by Friday.` → Save → Ask SoloOps → "What should I prioritize today?" → the reply cites the task under "From your saved records:".
4. **Offline** — follow the manual offline test above; every feature except live AI inference works without any network.

### Demo seed data

For demos, seed a separate database with a realistic multi-space life (5 spaces, 12 tasks, including a real 16:00 conflict between an Economics class and a camera pickup):

```bash
cd soloops/backend && source .venv/bin/activate
python seed_demo.py --db demo.db
SOLOOPS_DB_PATH=demo.db uvicorn main:app --host 127.0.0.1 --port 8000
```

The seeder refuses to touch the real `soloops.db` (unless `--allow-main-db`) and refuses non-empty databases; it never deletes anything.

## 60–90 second demo script

> **(0:00)** "Meet a college student who's also running a camera rental, helping with the family's rental property, and posting on TikTok. Four roles, one brain — and no assistant. SoloOps AI is that assistant, and it runs entirely on this laptop." *(Wi-Fi off in menu bar)*
>
> **(0:12)** "Each role is a Space — Academic, Business, Content, Personal." *(My Spaces, show the four cards)*
>
> **(0:20)** "Anything that lands on my plate, I paste into AI Capture. A scholarship notice…" *(paste, Analyze with Local AI)* "…qwen2.5 running locally pulls out the action and the October 15 deadline. It never invents details, and I review before saving." *(Save)* "Same for a camera booking — Maria, Saturday, 3 PM." *(capture + save)*
>
> **(0:40)** "Today's Attention ranks everything across every space with plain code: overdue, today, next three days." *(Dashboard)*
>
> **(0:45)** "'Plan my day' — local AI reads my saved tasks and free time and proposes time blocks; I add one to the calendar with a click." *(Plan my day → Add to calendar)*
>
> **(0:55)** "Ask SoloOps: what should I prioritize today?" *(ask)* "The answer separates what's actually saved from AI suggestions — it only knows what I chose to save, and nothing leaves my machine."
>
> **(1:10)** "Time to work: Lock In on the scholarship task. Local AI builds a checklist from the task and my space, and the Pomodoro timer starts — it floats over every page and can pop out to its own always-on-top window." *(Generate Plan, Start, tick a step, Mark Complete)*
>
> **(1:20)** "One person. Multiple roles. One private AI assistant. That's SoloOps AI."

## Project structure

```text
soloops/
├── backend/
│   ├── main.py            # FastAPI app: spaces, extraction, tasks, /attention, /calendar, /briefing, /lock-in/plan, /chat
│   ├── attention.py       # deterministic priority + conflict logic (Asia/Manila dates)
│   ├── database.py        # SQLite access + additive migrations
│   ├── seed_demo.py       # demo seeder for a separate DB
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── tests/test_api.py
└── frontend/src/
    ├── App.jsx            # shell, sidebar nav, routing, focus layout
    ├── Overview.jsx       # overview dashboard
    ├── SpacePage.jsx      # per-space page
    ├── CalendarPage.jsx   # week calendar + conflicts
    ├── QuickAddTask.jsx   # inline task form
    ├── Attention.jsx      # task lists ("Your next moves")
    ├── LockIn.jsx         # Focus mode
    ├── MessageExtractor.jsx  # AI Capture
    ├── AskSoloOps.jsx     # Assistant
    ├── Businesses.jsx     # Manage spaces
    ├── spaces.js          # space colors, category glyphs, time helpers
    └── api.js             # API base URL (VITE_API_URL override) + fetch helper
```

## Limitations

- No authentication (single local user by design).
- No specialized modules (no inventory, ledger, GPA tracking) — spaces are general-purpose contexts.
- Conflict detection needs tasks to have a start time (end times make ranges, but equal start times still count as overlaps); multi-day spans are excluded from conflict checks.
- The assistant can explain conflicts and draft messages, but it never changes, moves or cancels anything — all edits are manual.
- AI output quality depends on the 3B model; deterministic guards catch the common failure modes, but always review extractions.
