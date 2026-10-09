import { useState } from "react";
import { apiFetch } from "./api";
import {
  spaceColor,
  categoryIcon,
  formatTime12,
  formatRange,
  shortDate,
} from "./spaces";
import Attention from "./Attention";
import QuickAddTask from "./QuickAddTask";
import PlanMyDay from "./PlanMyDay";
import RichText from "./RichText";

const ASK_CHIPS = [
  "What should I prioritize today?",
  "Which deadlines are approaching?",
  "Draft a reply for my most urgent task",
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function soonest(tasks) {
  const dated = tasks.filter((t) => t.due_date);
  if (!dated.length) return null;
  return dated[0];
}

export default function Overview({
  spaces,
  attention,
  onNavigate,
  onChanged,
  onLockIn,
}) {
  const [quickAdd, setQuickAdd] = useState(
    () =>
      new URLSearchParams(window.location.search).get("quickadd") ===
      "1"
  );
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [sources, setSources] = useState(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");

  const pending = attention?.tasks || [];
  const conflicts = attention?.conflicts || [];
  const today = attention?.today;

  function pendingFor(spaceId) {
    return pending.filter((t) => t.business_id === spaceId);
  }

  function dateLabel(iso) {
    if (iso === today) return "Today";
    return shortDate(iso);
  }

  function conflictQuestion(c) {
    const [a, b] = c.tasks;
    return (
      `Explain my schedule conflict on ${c.date}: "${a.title}" ` +
      `(${formatRange(a)}) overlaps "${b.title}" (${formatRange(b)}). ` +
      "Suggest options and draft a short message if helpful. " +
      "Do not change anything."
    );
  }

  async function ask(text) {
    const q = (text ?? question).trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError("");
    try {
      const data = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({ message: q }),
      });
      setAnswer(data.reply);
      setSources(data.sources);
      setQuestion("");
    } catch (err) {
      setAskError(err.message);
    } finally {
      setAsking(false);
    }
  }

  const todayTasks = pending
    .filter((t) => t.due_date === today)
    .sort((a, b) => (a.due_time || "99") .localeCompare(b.due_time || "99"));
  const timedToday = todayTasks.filter((t) => t.due_time);
  const untimedToday = todayTasks.filter((t) => !t.due_time);
  const conflictTaskIds = new Set(
    conflicts.filter((c) => c.date === today).flatMap((c) =>
      c.tasks.map((t) => t.id)
    )
  );

  const todayLabel = today
    ? new Date(`${today}T00:00:00`)
        .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
        .toUpperCase()
    : "";

  return (
    <>
      <div className="overview-header">
        <div className="page-head">
          <h1>A little space for everything.</h1>
          <p className="page-sub">
            {greeting()}. Let's give each part of your life its moment.
          </p>
        </div>
        <button className="btn" onClick={() => setQuickAdd(!quickAdd)}>
          + Add task
        </button>
      </div>

      {quickAdd && (
        <QuickAddTask
          spaces={spaces}
          onSaved={() => {
            setQuickAdd(false);
            onChanged?.();
          }}
          onCancel={() => setQuickAdd(false)}
        />
      )}

      <div className="space-cards">
        {[...spaces].sort((a, b) => a.id - b.id).map((space) => {
          const list = pendingFor(space.id);
          const next = soonest(list);
          return (
            <button
              key={space.id}
              className="space-card"
              style={{ "--space-color": spaceColor(space.id, spaces) }}
              onClick={() => onNavigate("space", { spaceId: space.id })}
            >
              <div className="space-card-head">
                <span>
                  {categoryIcon(space.category)} {space.name}
                </span>
                <span className="arrow">↗</span>
              </div>
              <div className="space-card-count">
                {list.length} <small>tasks</small>
              </div>
              <div className="space-card-next">
                {next
                  ? `${next.title} · due ${shortDate(next.due_date)}`
                  : "Nothing scheduled"}
              </div>
            </button>
          );
        })}
        {spaces.length === 0 && (
          <button
            className="space-card"
            onClick={() => onNavigate("spaces")}
          >
            <div className="space-card-name">Create your first space</div>
            <div className="space-card-next">
              Academic, business, content, personal — give each a home.
            </div>
          </button>
        )}
      </div>

      <PlanMyDay
        key={today || "none"}
        attention={attention}
        spaces={spaces}
        onChanged={onChanged}
      />

      {conflicts.length > 0 && (
        <div className="conflict-banner">
          <div className="cb-title">
            <span>
              ⚠ Two places at one time · {formatTime12(conflicts[0].time)}
            </span>
            <small>{dateLabel(conflicts[0].date)}</small>
          </div>
          <p>
            {conflicts[0].tasks[0].title} (
            {conflicts[0].tasks[0].business_name},{" "}
            {formatRange(conflicts[0].tasks[0]) || "no time"}) overlaps{" "}
            {conflicts[0].tasks[1].title} (
            {conflicts[0].tasks[1].business_name},{" "}
            {formatRange(conflicts[0].tasks[1]) || "no time"}).
          </p>
          {conflicts[0].suggestion && (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Suggestion: move {conflicts[0].suggestion.move_task_title} to{" "}
              {formatRange({
                due_time: conflicts[0].suggestion.time,
                end_time: conflicts[0].suggestion.end_time,
              })}{" "}
              — {conflicts[0].suggestion.reason}. Not applied.
            </p>
          )}
          <div className="cb-actions">
            <button
              className="btn btn-small"
              onClick={() =>
                onNavigate("ask", {
                  askPreset: {
                    question: conflictQuestion(conflicts[0]),
                    spaceId: null,
                    autoAsk: true,
                  },
                })
              }
            >
              Review with assistant
            </button>
            {conflicts[0].suggestion?.person && (
              <button
                className="btn btn-secondary btn-small"
                onClick={() =>
                  onNavigate("ask", {
                    askPreset: {
                      question:
                        `Draft a short, friendly message to ${conflicts[0].suggestion.person} ` +
                        `asking to move "${conflicts[0].suggestion.move_task_title}" from ` +
                        `${formatRange({ due_time: conflicts[0].time })} to ` +
                        `${formatRange({
                          due_time: conflicts[0].suggestion.time,
                          end_time: conflicts[0].suggestion.end_time,
                        })} ` +
                        `on ${conflicts[0].date === today ? "today" : shortDate(conflicts[0].date)} ` +
                        `because of my "${
                          conflicts[0].tasks.find(
                            (t) => t.id !== conflicts[0].suggestion.move_task_id
                          )?.title
                        }". Do not change anything.`,
                      spaceId: null,
                      autoAsk: true,
                    },
                  })
                }
              >
                Draft message to {conflicts[0].suggestion.person.split(" ")[0]}
              </button>
            )}
            <span className="cb-note">Unresolved · no changes made</span>
            {conflicts.length > 1 && (
              <button
                className="link-button"
                onClick={() => onNavigate("calendar")}
              >
                +{conflicts.length - 1} more conflict
                {conflicts.length > 2 ? "s" : ""}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="ov-grid">
        <div className="card">
          <Attention
            data={attention}
            spaces={spaces}
            onLockIn={onLockIn}
            onChanged={onChanged}
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Today's rhythm</h3>
            <button
              className="link-button"
              onClick={() => onNavigate("calendar")}
            >
              Calendar ↗
            </button>
          </div>
          <div className="rhythm-date">{todayLabel}</div>
          {timedToday.length === 0 && untimedToday.length === 0 && (
            <p className="muted">Nothing scheduled today.</p>
          )}
          {timedToday.map((task) => (
            <div className="rhythm-row" key={task.id}>
              <span className="rhythm-time">
                {formatTime12(task.due_time)}
              </span>
              <span
                className="rhythm-bar"
                style={{
                  background: spaceColor(task.business_id, spaces),
                }}
              />
              <div className="rhythm-body">
                <strong>
                  {task.title}
                  {conflictTaskIds.has(task.id) && (
                    <span className="rhythm-conflict">⚠</span>
                  )}
                </strong>
                <small>
                  {task.end_time && `until ${formatTime12(task.end_time)} · `}
                  {task.business_name}
                </small>
              </div>
            </div>
          ))}
          {untimedToday.length > 0 && (
            <>
              <div
                className="rhythm-date"
                style={{ marginTop: 14 }}
              >
                Anytime today
              </div>
              {untimedToday.map((task) => (
                <div className="rhythm-row" key={task.id}>
                  <span className="rhythm-time">—</span>
                  <span
                    className="rhythm-bar"
                    style={{
                      background: spaceColor(task.business_id, spaces),
                    }}
                  />
                  <div className="rhythm-body">
                    <strong>{task.title}</strong>
                    <small>{task.business_name}</small>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="clarity-card">
          <span className="badge">On-device · qwen2.5:3b</span>
          <div className="card-head">
            <h3>A little clarity</h3>
          </div>
          <small className="muted">Context: all spaces</small>
          <div className="chip-row">
            {ASK_CHIPS.map((chip) => (
              <button
                key={chip}
                className="chip"
                onClick={() => ask(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="ask-input">
            <input
              value={question}
              placeholder="Ask about your day..."
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ask();
              }}
            />
            <button
              className="btn btn-small"
              disabled={asking || !question.trim()}
              onClick={() => ask()}
            >
              {asking ? "..." : "→"}
            </button>
          </div>
          {askError && <p className="extractor-error">{askError}</p>}
          {answer && (
            <div className="clarity-reply">
              <RichText text={answer} />
              {sources && (
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  Grounded in {sources.task_count} saved tasks from:{" "}
                  {sources.spaces.join(", ") || "none"}
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              className="link-button"
              onClick={() => onNavigate("ask")}
            >
              Open full assistant ↗
            </button>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
              Answers use only your saved records. Nothing is uploaded.
            </div>
          </div>
        </div>
      </div>

      <p className="footnote">
        ⛉ Your life, on your device. Records live in local SQLite; AI
        runs on local Ollama.
      </p>
    </>
  );
}
