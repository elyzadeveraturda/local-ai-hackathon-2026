# SoloOps — Offline AI Business Command Center

> SoloOps gives solo entrepreneurs the organization of a team and the assistance of AI without sending their private business data to the cloud.

SoloOps is a private, local-first workspace for solo entrepreneurs running one or more businesses of **any** type (online shop, freelancer, rental, food, services, ...). All AI inference runs on your machine through [Ollama](https://ollama.com) using `qwen2.5:3b`. Data is stored in a local SQLite file.

## Features

- **Business workspaces** — create/edit/delete any kind of business.
- **AI message extraction** — paste a customer message; local AI extracts customer, item/service, date, time, amount and the action required, using the selected business as context.
- **Review & Save as Task** — every extracted field is editable before saving; validation, clear errors, and duplicate-save protection (UI lock + backend `409`).
- **Today's Attention** (Dashboard) — all pending tasks across businesses, prioritised deterministically in Philippine time: Overdue → Due today → Due within 3 days → Later → No date. Real counts, mark complete / reopen.
- **Lock In Mode** — pick a task, 25-minute Pomodoro (start/pause/reset), a local-AI focus plan built from the task's stored details (with a deterministic fallback checklist if Ollama is down), tickable checklist, complete the task.
- **Grounded AI chat** — "Ask SoloOps AI" on the dashboard answers using your saved businesses and pending tasks.

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

Open http://localhost:5173. Everything binds to `127.0.0.1`/`localhost` only, so business records are not exposed on your network.

The database lives at `soloops/backend/soloops.db` (created automatically). Existing databases are upgraded in place — the only migration is an additive `ALTER TABLE tasks ADD COLUMN due_time`. Set `SOLOOPS_DB_PATH` to use a different file.

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
3. **Turn Wi-Fi off.**
4. Walk through the demo flow below. Extraction, Lock In plans and chat should all still work.
5. Optional: stop Ollama — extraction/chat show a clear "Local AI unavailable" error, while Today's Attention, tasks, and Lock In (fallback checklist) keep working.

## Demo flow / acceptance test

1. **My Businesses** → create e.g. "Lola Bakes" / "Home bakery".
2. **AI Extraction** → select it, paste:
   `Hi! This is Maria Santos. Can I order a chocolate ube cake for October 12 at 3pm pickup? Budget is PHP 1,800. Please confirm.`
3. Click **Extract Information**, review/correct the fields, click **Save as Task**.
4. Refresh the browser → **Dashboard**: the task appears in **Today's Attention** with its business and priority.
5. Click **Lock In** → **Generate Plan** → **Start** the timer → tick checklist items → **Mark Task Complete**.
6. Back on the Dashboard the task is under "Show completed" and the counts update.

## 60–90 second demo script

> **(0:00)** "Solo entrepreneurs juggle customers across several businesses with no team and no time. Cloud AI means handing over private customer data. SoloOps fixes both — and it runs completely offline." *(show Wi-Fi off)*
>
> **(0:12)** "I run a home bakery *and* a camera rental. Each is a workspace — SoloOps works for any business type." *(show My Businesses)*
>
> **(0:20)** "A customer messages me. I paste it in, and qwen2.5 running locally on my Mac pulls out the customer, the cake, the date, time and budget." *(Extract)* "AI can make mistakes, so I can fix anything before saving." *(edit a field, Save as Task)*
>
> **(0:40)** "My Dashboard is Today's Attention: every task across all businesses, ranked by plain code — overdue first, then today, then the next three days. No AI guessing about what's urgent." *(show buckets and counts)*
>
> **(0:55)** "When it's time to work, I hit Lock In. Local AI turns the task into a checklist using the real order details, and I start a 25-minute focus timer." *(Generate Plan, Start, tick items)*
>
> **(1:10)** "Done — mark it complete and it's off my list." *(Complete, back to dashboard)* "The organization of a team, the help of AI, and my business data never leaves my laptop. That's SoloOps."

## Project structure

```text
soloops/
├── backend/
│   ├── main.py            # FastAPI app: businesses, extraction, tasks, /attention, /lock-in/plan, /chat
│   ├── attention.py       # deterministic priority logic (Asia/Manila dates)
│   ├── database.py        # SQLite access + additive migration
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── tests/test_api.py
└── frontend/src/
    ├── App.jsx            # layout, dashboard, AI chat
    ├── Attention.jsx      # Today's Attention
    ├── LockIn.jsx         # Lock In Mode
    ├── MessageExtractor.jsx
    ├── Businesses.jsx
    └── api.js             # API base URL (VITE_API_URL override) + fetch helper
```

## Limitations

- No authentication (single local user by design).
- Due dates are date + optional time; no schedule-conflict detection yet.
- Pomodoro state is not persisted across page reloads.
- AI output quality depends on the 3B model; always review extractions.
