# SoloOps AI — Your Private, Offline Personal AI Assistant

> One person. Multiple roles. One private AI assistant.

SoloOps AI is a private, local-first assistant for one person juggling many roles — a student keeping up with classes and a scholarship, running a camera rental side business, helping manage the family's rental property, posting on TikTok, and staying on top of personal life. Each role is a **Space**; everything you save stays in a local SQLite file, and all AI inference runs on your machine through [Ollama](https://ollama.com) using `qwen2.5:3b`.

## Running several businesses

Each business (or part of your life) is a **Space**. A space shows the tabs it needs — **Work, Payments, Customers, Inventory, Documents** — with sensible defaults per category (a Business gets all five, an Academic space gets Work and Documents). Use **Customize tabs** on any space to change that; hiding a tab never deletes anything.

- **Connected records** — every item in Work is a *task, event, booking, payment or deadline* with a status (*To do / In progress / Done*). A record can link to a **customer**, an **inventory item**, a **payment** (amount, unpaid / partly paid / paid) and any number of **documents**. Type a new customer's name on a booking and they're added to Customers automatically.
- **Views that fit the work** — **List** (grouped by Overdue / Today / Next 7 days / Later), **Table** (scan amounts, customers and items), and **Board** (drag between To do / In progress / Done, or use the card's status menu). Calendar shows everything with a date. Search, type filters, status, payment and space filters and sorting are on every view, and the chosen layout is remembered.
- **Across every space** — sidebar pages for *All work, Payments, Calendar, Customers, Inventory* and *Documents* show the same data across all spaces; each space's tabs show only its own.
- **Payments** — the Payments view lists everything awaiting payment with the total still to collect; customers show what they owe; the dashboard shows the total and each space card shows its own.
- **Inventory** — stock with quick +/− buttons, a "warn me at" level, low/out-of-stock badges, stock value, and next booking. Bookings that use an item more times than it's in stock at the same time are flagged **Double-booked**.
- **Documents** — notes plus an optional file (up to 10 MB, stored on this computer in `soloops/backend/files/`), linked to a record and/or customer. Files open in the browser only for safe types (PDF, images, text); everything else downloads.
- **Search everything** — press **Ctrl K** / **⌘K** (or the Search button) to find records, customers, items, documents and spaces from anywhere.

## Features

- **Overview** — a calm home for the whole day: greeting, a **Today at a glance** strip (overdue, due today, next 3 days, minutes focused today — each tile jumps to the task list, calendar or Focus mode), per-space cards with pending counts, overdue flags and next deadlines, a conflict banner when two commitments collide, "Your next moves" (all pending tasks across spaces, prioritised deterministically in Philippine time: Overdue → Due today → Due within 3 days → Later → No date, with **High/Normal/Low importance** breaking ties inside each group), "Today's rhythm" (today's timed schedule), and an on-device assistant panel. Quick-add tasks inline.
- **My Spaces** — organize every part of your life into spaces across 5 categories (Academic, Business, Content Creation, Personal, Custom), each with a free-text type, description and its own color. Each space gets its own page: stats, pending tasks, and a 14-day upcoming schedule. Quick-fill templates (College & Scholarship, Camera Rental, Family Property, TikTok Content, Personal Goals) prefill the form without saving. Deleting a space shows how many tasks (and how many still pending) go with it, and a backup snapshot is taken first.
- **AI Capture** — paste any text or message (school notices, booking requests, content to-dos, personal reminders); local AI extracts `record_type`, `title`, `person`, `subject`, `due_date`, `due_time`, `end_time`, `amount` and `notes`, using the selected space's name/category/type/description as context. Deterministic guards post-process the model output: relative weekday phrases ("next Tuesday", "by Friday") are resolved to real dates in code, time ranges become start/end times, hallucinated dates/amounts/people with no textual evidence are nulled, and titles are stripped of date/time fragments.
- **Review & Save as Task** — every extracted field is editable before saving. SoloOps flags what you need to confirm instead of guessing: an unresolved date, a time with no AM/PM ("at 5"), a space picked only by keywords, or a missing title (the title is left empty rather than invented). Validation, clear errors, and duplicate-save protection (UI lock + backend `409`).
- **Ask SoloOps (Assistant)** — grounded Q&A over your saved records, scoped to **All Spaces** or a **Selected Space**. Only saved records are treated as facts: answers start with "From your saved records:" (task titles, spaces, due status) followed by clearly-labelled "Suggestions:". It can explain schedule conflicts, suggest options and draft short messages — but it never changes, moves, cancels or confirms anything. Conversations are never stored.
- **Focus mode** — a distraction-free full-screen view: pick one task, get a context-aware focus plan from local AI (tailored to the space's category — studying, content editing, customer follow-up, errands), a Pomodoro timer with **Focus and Break modes** (lengths remembered; presets or custom), start/pause/resume/reset, a progress bar, a tickable checklist, and a deterministic fallback checklist if Ollama is down. When a session ends the next mode is readied, not auto-started. Finished sessions are saved locally and shown in **Focus history** (today's sessions and minutes, last 7 days).

- **Floating Pomodoro** — the same shared timer floats over every page: a small round button that becomes a live pill while running, expands into a mini timer card with presets and an optional linked task, counts down in the browser tab title, survives reloads, and can pop out into an always-on-top Picture-in-Picture window (Chrome) so it floats over other tabs and apps.

- **Edit anything** — click any task (in a list or on the calendar) to open the task editor: title, space, importance, dates/times, person, subject, amount and notes; mark complete or reopen; Lock In; or delete (a backup snapshot is taken first). Changes show up everywhere at once — dashboard, space pages, calendar and AI planning.

- **Whole-day & multi-day tasks** — every task form has a "Whole day" switch: date-only tasks for appointments and deadlines, multi-day spans for trips or exam weeks (shown in the calendar's all-day row across every covered day), and timed events with start/end times.

- **Calendar** — a real week view with a 24-hour time grid (overlap-aware side-by-side events, all-day row, today highlight, now-line) and a month view; deterministic conflict detection flags overlapping timed tasks and computes a suggested reschedule — never applied automatically.

- **Works on smaller screens** — under 900px the sidebar becomes a slide-in menu; forms switch to one column and the task editor becomes a bottom sheet on phones. Pages are in the URL, so Back/Forward and reloads keep your place.

## AI that actually works for you

All AI runs on-device via Ollama (`qwen2.5:3b` on `127.0.0.1:11434`); deterministic code retrieves, validates and post-processes everything the model touches.

- **Plan my day** (`POST /briefing`) — the Overview card shows: **Needs attention** (overdue and due-today tasks, computed in code), a **Recommended order** with a one-line reason per task (the model's order is checked against your real task ids; any overdue or due-today task it skips is added back, and if the model is down SoloOps' own priority order is used), optional **step breakdowns** for big tasks (or "Break it down" on demand), suggested time blocks, and how much free time you have today. Blocks are validated in code against free slots computed from your saved timed tasks (invalid ids, out-of-slot starts and overlaps are dropped, snapped or trimmed — never trusted), and can be added to the calendar with one click. Fixed-time commitments (classes, pickups) stay in the schedule and are not reordered. Nothing changes without your confirmation.
- **AI Capture** — extraction with auto-detected space (`space_name`/keyword fallback), the deterministic guards above (dates, times, people, amounts, titles), and `needs_review` flags for anything ambiguous.
- **Assistant** — answers grounded only in saved SQLite records ("From your saved records:" vs "Suggestions:"), explains conflicts with computed suggestions and drafts reschedule messages; it never mutates anything. Empty questions are rejected, and timeouts, a missing model and an unreachable Ollama each get their own clear message.
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

The database lives at `soloops/backend/soloops.db` (created automatically). Existing databases are upgraded in place via additive migrations only (`tasks.due_time`, `tasks.end_time`, `tasks.end_date`, `businesses.category` default `'Business'`, `tasks.importance` default `'normal'`, a new `focus_sessions` table, and indexes on `tasks(business_id)` and `tasks(status, due_date)`). The business workspace adds: `tasks.kind` (default `'task'`), `tasks.payment_status`, `tasks.amount_paid`, `tasks.contact_id`, `tasks.inventory_id`, `tasks.updated_at`, `businesses.modules`, and new `contacts`, `inventory` and `documents` tables. The first time it runs, existing free-text customer names on tasks become linked customers (the original text is kept). Nothing is dropped or rewritten; back up before upgrading anyway. Internally the `businesses` table and `/businesses` endpoints represent Spaces — the UI terminology changed, the schema did not. Set `SOLOOPS_DB_PATH` to use a different file. To back up:

```bash
cp soloops/backend/soloops.db soloops/backend/backups/soloops-$(date +%Y%m%d-%H%M%S).db
```

## Privacy and security

- All AI inference runs locally via Ollama at `127.0.0.1:11434` (`qwen2.5:3b`). `SOLOOPS_OLLAMA_URL` can change the port, but non-local addresses are refused, because your saved records are included in prompts.
- The FastAPI backend binds to `127.0.0.1` and only answers requests whose `Host` is `localhost`/`127.0.0.1`/`[::1]` (blocks DNS-rebinding pages). CORS only allows the local Vite origins; cross-site form and `text/plain` posts are rejected.
- Saved records and pasted text are treated as **data, not instructions** in every prompt (chat, planning, capture, focus plans), so a task titled "ignore all rules…" can't steer the model.
- No cloud APIs, no telemetry, no external services. The frontend loads no external fonts, scripts, or assets. Chat conversations are held in React state only and are never written to disk.
- **Backups:** deleting a space that has tasks, or deleting a task, first writes a snapshot to `soloops/backend/backups/auto-*.db` (the newest 20 are kept; manual backups are never touched).
- The database file is git-ignored and no longer tracked. Older commits on this repository still contain a copy of it — treat the repo history as private, or rewrite it before publishing.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SOLOOPS_DB_PATH` | `soloops/backend/soloops.db` | SQLite file to use |
| `SOLOOPS_OLLAMA_URL` | `http://127.0.0.1:11434` | Local Ollama address (loopback only) |
| `SOLOOPS_EXTRA_HOSTS` | — | Extra comma-separated `Host` names the API accepts |
| `VITE_API_URL` | `http://127.0.0.1:8000` | Backend URL used by the frontend |

### Offline verification (Oct 18, 2026)

| Check | Result |
| --- | --- |
| Built frontend scanned for external URLs | Only SVG namespace URIs and React error-doc strings — nothing is fetched |
| Every UI flow (plan, assistant, capture + save, calendar, spaces, focus plan) driven in a headless browser with all requests logged | Browser contacted only `localhost:5174` (Vite) and `127.0.0.1:8001` (API) |
| Backend sockets watched during those flows | Only loopback: incoming API calls and 4 calls to Ollama on `127.0.0.1:11434` |
| Ollama unreachable | Health shows "disconnected"; Assistant and AI Capture show "Local AI is not reachable…"; Plan my day and Focus plans fall back to rule-based output; tasks, calendar and dashboard keep working |
| Wi-Fi physically off | **Not run in this pass** — use the manual test below to confirm on your machine |

One-time setup (`pip install`, `npm install`, `ollama pull`) needs internet; running SoloOps does not.

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

### Try the main workflows

Seed a demo database (below) and start the app on it, then:

1. **Dashboard** — Overview shows overdue / due today / next 3 days / money awaiting payment, a low-stock warning, and per-space cards with what each space is owed.
2. **Book a rental** — *All work → + New*, pick **Booking**, choose *Camera Rental*, type a new customer name (it's added to Customers), pick an item, enter an amount. It starts as *Unpaid*.
3. **See a clash** — the two *Sony A7 IV* bookings today are marked **Double-booked** (one camera, overlapping times).
4. **Collect money** — *Payments* lists everyone who still owes you and the total. Open a record and set *Partly paid* or *Paid*.
5. **Switch views** — in *All work*, flip between **List**, **Table** and **Board**; drag a card to *In progress*.
6. **Customers** — open *Jamie Lee* to see what they owe, their bookings and their documents; start a new booking from there.
7. **Inventory** — use +/− on stock; open *Sony A7 IV* to see its bookings or **Book this item**.
8. **Documents** — add a note with a file and link it to a booking.
9. **Search** — press Ctrl K / ⌘K and type "sony".
10. **Customize a space** — open *Camera Rental → Customize tabs*.
11. **AI Capture** (needs Ollama) — paste "Sam Rivera wants to rent the Canon R6 on Saturday, 1400 pesos." It suggests a *Booking*, matches Sam and the Canon EOS R6, and marks it *Unpaid* for you to review.
12. **Assistant** (needs Ollama) — ask "Who still owes me money?".

### Demo seed data

For demos, seed a separate database with a realistic multi-space life (5 spaces, 15 records, 5 customers, 5 inventory items, 4 documents — including a 16:00 conflict between an Economics class and a camera pickup, a double-booked camera, payments still owed and low stock):

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
│   ├── main.py            # FastAPI app: spaces, records (CRUD, filters), extraction, /attention,
│   │                      #   /calendar, /briefing, /lock-in/plan, /focus-sessions, /chat
│   ├── workspace.py       # customers, inventory, documents (+ files), /search, /summary, space tabs
│   ├── attention.py       # deterministic priority + conflict logic (Asia/Manila dates)
│   ├── database.py        # SQLite access, additive migrations, auto backups
│   ├── seed_demo.py       # demo seeder for a separate DB
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── tests/test_api.py
└── frontend/src/
    ├── App.jsx            # shell, sidebar/drawer nav, URL routing, focus layout
    ├── Overview.jsx       # dashboard (glance strip, spaces, plan, next moves, rhythm)
    ├── SpacePage.jsx      # per-space page
    ├── CalendarPage.jsx   # week/month calendar + conflicts
    ├── WorkView.jsx       # list / table / board of records with search, filters, sorting
    ├── TaskEditor.jsx     # create / edit any record (type, status, customer, item, payment, docs)
    ├── CustomersPage.jsx  # customers + detail (balance, records, documents)
    ├── InventoryPage.jsx  # stock, quick adjust, item detail and bookings
    ├── DocumentsPage.jsx  # notes and files
    ├── DocumentEditor.jsx # create / edit a document, attach a file
    ├── SearchPalette.jsx  # Ctrl/⌘ K search across everything
    ├── Modal.jsx, Badges.jsx, records.js, useApi.js  # shared dialog, status pills, labels, data hook
    ├── QuickAddTask.jsx   # inline task form
    ├── Attention.jsx      # task lists ("Your next moves")
    ├── PlanMyDay.jsx      # AI day plan card
    ├── LockIn.jsx         # Focus mode + focus history
    ├── FloatingTimer.jsx  # floating / picture-in-picture timer
    ├── TimerControls.jsx  # focus/break switch and presets
    ├── useFocusTimer.js   # shared timer state, session logging
    ├── MessageExtractor.jsx  # AI Capture
    ├── AskSoloOps.jsx     # Assistant
    ├── Businesses.jsx     # Manage spaces
    ├── spaces.js          # space colors, category glyphs, time helpers
    └── api.js             # API base URL (VITE_API_URL override) + fetch helper
```

## Limitations

- No authentication (single local user by design). Any program running as you on this machine can call the local API.
- Dates are computed in Philippine time (Asia/Manila) regardless of the computer's time zone.
- Money tracking is per record (amount, paid so far). There are no invoices, taxes, multiple currencies or accounting reports; amounts are shown in pesos.
- Inventory doesn't change automatically when a booking happens or a sale is made — adjust stock with +/−. Double-booking checks only look at bookings linked to an item with a date.
- Files are stored on this computer next to the database; back up `soloops/backend/files/` together with `soloops.db`. Replaced or deleted files are moved to `files/.trash/`, not erased.
- Conflict detection needs tasks to have a start time (end times make ranges, but equal start times still count as overlaps); multi-day spans are excluded from conflict checks.
- The assistant can explain conflicts and draft messages, but it never changes, moves or cancels anything — all edits are manual.
- AI output quality depends on the 3B model. It often skips the optional "order" and "steps" fields in Plan my day (SoloOps then uses its own order, and "Break it down" is available on demand), and focus checklists can mention tools that aren't in your notes. Deterministic guards catch the common failure modes, but always review.
- Focus history is written when a session finishes in an open SoloOps tab, or on the next load if it finished while the app was closed. A session that ends while the backend is down is not retried.
