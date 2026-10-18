# SoloOps MVP refinement report

Branch `feature/mvp-refinement` (from `feature/figma-ui` at `b27fb59`), Oct 18, 2026.
Nothing has been pushed.

## 1. Summary

SoloOps was already working end to end: FastAPI + SQLite backend, React/Vite frontend, local Ollama
(`qwen2.5:3b`). This pass kept that architecture and went through it in four phases:

- **Phase 2 — Critical fixes.** Data safety (auto backups, DB untracked from git), input limits,
  prompt-injection guards, a calendar test that failed depending on the weekday, lint warnings.
- **Phase 3 — Core features.** Task edit/delete, importance, a fuller Plan My Day, focus/break modes
  with saved history, ambiguity flags in AI Capture, sturdier assistant error handling.
- **Phase 4 — UI/UX.** Responsive shell (slide-in menu under 900px), a "Today at a glance" strip,
  overdue flags on space cards, URL-based navigation, loading states, layering fixes.
- **Phase 5 — Verification and docs.** Network audit, offline behaviour, Host-header allowlist,
  loopback-only Ollama setting, README and this report.

No dependencies were added. No existing user records were changed or deleted.

## 2. Files created or modified

New: `soloops/frontend/src/TaskEditor.jsx`, `soloops/frontend/src/TimerControls.jsx`, `docs/REFINEMENT_REPORT.md`.

Modified — backend: `main.py`, `database.py`, `attention.py`, `tests/test_api.py`.
Modified — frontend: `App.jsx`, `App.css`, `Overview.jsx`, `PlanMyDay.jsx`, `Attention.jsx`,
`CalendarPage.jsx`, `LockIn.jsx`, `FloatingTimer.jsx`, `useFocusTimer.js`, `MessageExtractor.jsx`,
`QuickAddTask.jsx`, `AskSoloOps.jsx`, `Businesses.jsx`, `spaces.js`. Also `README.md`.

Untracked from git (file kept on disk): `soloops/backend/soloops.db`.

## 3. Features enhanced

| Area | What changed |
| --- | --- |
| Tasks | `PUT /tasks/{id}` and `DELETE /tasks/{id}`; task editor dialog from lists and calendar; move tasks between spaces; High/Normal/Low importance on every form, used for ordering and shown to the AI |
| Spaces | Delete confirmation names the space and its task counts; snapshot before cascade delete; `/businesses` returns `task_count`/`pending_count` |
| Plan My Day | Needs-attention list, recommended order with reasons (checked against real ids, skipped urgent tasks added back, rule-based order when the model is down), optional step breakdowns plus on-demand "Break it down", free-time total, fixed-time commitments left out of the order |
| Focus mode | Focus/break modes with remembered lengths, next mode readied when one ends, sessions saved to `focus_sessions` (deduped, including ones that ended while the app was closed), Focus history card, focus minutes on the dashboard |
| AI Capture | `needs_review` flags: unresolved date, time without AM/PM, keyword-guessed space, missing title; title no longer defaults to an invented "Follow up" |
| Assistant | Rejects empty and over-long messages; separate timeout message; empty model reply → clear error; won't cite records that don't exist when nothing is pending |
| Dashboard | Today-at-a-glance tiles (overdue, due today, next 3 days, focused minutes) that link to the list, calendar or Focus mode; overdue badges on space cards |
| Layout | Sidebar becomes a slide-in menu under 900px; single-column forms and bottom-sheet editor on phones; Back/Forward work between pages; spinners for on-device AI waits; floating timer no longer covers the sidebar or dialogs |
| Security | Host-header allowlist (DNS rebinding), loopback-only `SOLOOPS_OLLAMA_URL`, shared "records are data, not instructions" rule in all prompts, input length caps |
| Performance | Indexes on `tasks(business_id)` and `tasks(status, due_date)`; dropped a duplicate `/businesses` fetch; step breakdowns only run when asked |

## 4. Bugs fixed

- `test_attention_conflicts_and_calendar` failed whenever "tomorrow" fell in the next week (e.g. on Sundays).
- The custom-minutes timer input stretched to full width (`input.control` overrode `.float-custom`).
- Every page overflowed sideways on phones because the 260px sidebar never collapsed.
- The floating timer covered the sidebar footer and appeared above dialogs.
- The AI Capture review form filled an empty title with "Follow up".
- The assistant described "other saved spaces" when no tasks were saved.
- A timeout was reported as "Local AI is not reachable".
- Two oxlint warnings in `Businesses.jsx`; Businesses fetched `/businesses` twice on load.

## 5. Test results

| Test | Result |
| --- | --- |
| Backend `pytest` (Ollama mocked, temp DB) | **45 passed** (was 31 passed / 1 failed) |
| Frontend `npm run build` / `npm run lint` | Pass / 0 warnings |
| Live API run against real `qwen2.5:3b` (scratch copy of the DB) | Capture: "Submit my research paper on Friday at 5 PM" → title, Friday's date and 17:00, no flags; "call the printing shop at 5" → AM/PM flag; Plan My Day, assistant and focus plan all answered |
| Headless Chromium walkthrough (desktop 1360, tablet 820, phone 390) | No page errors; no sideways scroll at 390px; drawer opens/closes; Back returns to the previous page; task edit saves |
| Dead-button scan (every rendered button checked for a handler) | None found on any page |
| Timer completion | A session that ended while the app was closed is logged once on reload; a live session that ends is logged; no duplicates |
| Network audit | Browser contacted only the local Vite server and API; backend opened sockets only to itself and to Ollama on `127.0.0.1:11434` |
| Ollama unreachable | Clear errors for Assistant/Capture; rule-based fallbacks for Plan My Day and focus plans; tasks, calendar and dashboard unaffected |
| DB migration on a copy of the real DB | New column, table and indexes added; existing space kept |

**Not performed:**

- A run with Wi-Fi physically turned off. Changing system network settings is outside what this
  session should do; the README's manual offline test covers it.
- Seeing the app in the desktop app's own browser pane, which stayed blocked on a site check.
  All visual checks used headless Chromium instead.
- Timer behaviour in a real backgrounded tab over a long session. The timer is computed from an end
  timestamp, so it can't drift, and completion after the app was closed is covered — but a
  full 25-minute run wasn't done.

## 6. Remaining issues

- **Git history still contains `soloops.db`.** Untracking stops new copies. Removing old ones needs a
  history rewrite (e.g. `git filter-repo`), which should be your call before publishing.
- **The 3B model often omits the optional `order`/`steps` fields** in Plan My Day, so the order is
  usually rule-based. Focus checklists sometimes mention tools that aren't in the task.
- Dates are fixed to Asia/Manila.
- No authentication on the local API (single-user by design).
- `test_ai.py` at the repo root imports the `ollama` Python package, which isn't in `requirements.txt`.
  It is a scratch script, not used by the app.
- `starlette.testclient` prints a deprecation warning about `httpx`. It's harmless for now.

## 7. Running SoloOps locally

See **Setup** and **Run** in the README. In short: start `ollama serve` with `qwen2.5:3b` pulled, run
`uvicorn main:app --host 127.0.0.1 --port 8000` in `soloops/backend`, and `npm run dev` in
`soloops/frontend`, then open http://localhost:5173. Restart the backend once after pulling this
branch so the additive migration runs. A backup was taken first at
`soloops/backend/backups/soloops-20261018-134510-pre-phase3.db`.

## 8. Git branch and commits

`feature/mvp-refinement`:

- `6174b9e` Phase 2: critical fixes for data safety, input validation, prompt safety
- `aa67cec` Phase 3: task editing, importance, richer Plan My Day, focus breaks
- `77ebada` Phase 4: responsive shell, at-a-glance dashboard, UI polish
- Phase 5 commit: offline verification, local-API hardening, docs (this report)

## 9. Recommendations

1. Rewrite git history to drop `soloops.db` before making the repo public.
2. Add a few frontend tests (Vitest + Testing Library) for the timer hook and task editor; the
   Playwright scripts used here could become a smoke test in `tools/`.
3. Make the time zone a setting instead of fixing it to Asia/Manila.
4. Consider a slightly larger local model (e.g. a 7B) as an option for users whose laptops can run
   it, mainly to get better ordering and step breakdowns. Keep 3B as the default.
5. Add an in-app "Backups" view (list/restore snapshots) now that automatic snapshots exist.
6. Consider recurring tasks and a weekly review, which follow naturally from focus history and
   importance.
