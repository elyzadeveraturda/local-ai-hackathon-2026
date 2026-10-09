import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";
import { spaceColor, formatRange, shortDate } from "./spaces";
import QuickAddTask from "./QuickAddTask";

// pure string/UTC date math — never local-time toISOString
function shiftDaysUTC(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const p = (v) => String(v).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

function rangeLabel(days) {
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const fmt = (iso, withMonth) => {
    const [y, m, d] = iso.split("-").map(Number);
    const month = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
      "en-US", { month: "long", timeZone: "UTC" }
    );
    return withMonth ? `${month} ${d}` : `${d}`;
  };
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return sameMonth
    ? `${fmt(first, true)}–${fmt(last, false)}, ${first.slice(0, 4)}`
    : `${fmt(first, true)} – ${fmt(last, true)}, ${last.slice(0, 4)}`;
}

export default function CalendarPage({ spaces, attention, onNavigate, onChanged }) {
  const [start, setStart] = useState(null);
  const [cal, setCal] = useState(null);
  const [error, setError] = useState("");
  const [quickAdd, setQuickAdd] = useState(false);

  // null start -> backend computes the Asia/Manila Monday;
  // prev/next shifts the RESPONSE start with pure UTC math.
  useEffect(() => {
    const url = start
      ? `/calendar?start=${start}&days=7`
      : "/calendar?days=7";
    apiFetch(url)
      .then((data) => {
        setCal(data);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [start, attention]);

  const conflictTaskIds = useMemo(
    () =>
      new Set(
        (cal?.conflicts || []).flatMap((c) => c.tasks.map((t) => t.id))
      ),
    [cal]
  );

  if (!cal) {
    return error
      ? <p className="extractor-error">{error}</p>
      : <p className="muted">Loading...</p>;
  }

  return (
    <>
      <div className="page-head">
        <h1>One calendar. All of you.</h1>
        <p className="page-sub">
          See every commitment together — and keep a little room between
          them.
        </p>
      </div>

      <div className="cal-controls">
        <button
          className="cal-nav"
          onClick={() => setStart(null)}
        >
          Today
        </button>
        <button
          className="cal-nav"
          onClick={() => setStart(shiftDaysUTC(cal.start, -7))}
        >
          ‹
        </button>
        <button
          className="cal-nav"
          onClick={() => setStart(shiftDaysUTC(cal.start, 7))}
        >
          ›
        </button>
        <span className="cal-label">{rangeLabel(cal.days)}</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-small" onClick={() => setQuickAdd(!quickAdd)}>
          + New event
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

      <div className="cal-legend">
        {spaces.map((s) => (
          <span key={s.id}>
            <span
              className="nav-dot"
              style={{ background: spaceColor(s.id, spaces) }}
            />
            {s.name}
          </span>
        ))}
      </div>

      {error && <p className="extractor-error">{error}</p>}

      <div className="cal-scroll">
        <div className="cal-grid">
          {cal.days.map((day) => {
            const untimed = day.tasks.filter((t) => !t.due_time);
            const timed = day.tasks
              .filter((t) => t.due_time)
              .sort((a, b) => a.due_time.localeCompare(b.due_time));
            return (
              <div
                key={day.date}
                className={`cal-col${day.date === cal.today ? " cal-today" : ""}`}
              >
                <div className="cal-head">
                  <div className="wd">{day.weekday.slice(0, 3)}</div>
                  <div className="num">{Number(day.date.slice(8))}</div>
                </div>
                {untimed.map((t) => (
                  <span
                    key={t.id}
                    className="cal-chip"
                    title={t.title}
                  >
                    Due · {t.title}
                  </span>
                ))}
                {timed.map((t) => {
                  const color = spaceColor(t.business_id, spaces);
                  const done = t.status === "completed";
                  return (
                    <div
                      key={t.id}
                      className={
                        "cal-item" +
                        (conflictTaskIds.has(t.id) ? " conflict" : "") +
                        (done ? " done" : "")
                      }
                      style={{
                        borderLeftColor: color,
                        background: `${color}14`,
                      }}
                    >
                      <div className="t">{formatRange(t)}</div>
                      <div className="ti">{t.title}</div>
                      <div className="sp">{t.business_name}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-head">
          <h3>Overlaps this week</h3>
        </div>
        {cal.conflicts.length === 0 && (
          <p className="muted">No overlaps this week.</p>
        )}
        {cal.conflicts.map((c, i) => (
          <div
            key={i}
            className="conflict-banner"
            style={{ marginBottom: 12 }}
          >
            <div className="cb-title">
              <span>
                ⚠ Two places at one time ·{" "}
                {formatRange({ due_time: c.time })}
              </span>
              <small>
                {c.date === cal.today ? "Today" : shortDate(c.date)}
              </small>
            </div>
            <p>
              {c.tasks[0].title} ({c.tasks[0].business_name},{" "}
              {formatRange(c.tasks[0])}) overlaps {c.tasks[1].title} (
              {c.tasks[1].business_name}, {formatRange(c.tasks[1])}).
            </p>
            {c.suggestion && (
              <p className="muted" style={{ fontSize: 12.5 }}>
                Suggestion: move {c.suggestion.move_task_title} to{" "}
                {formatRange({
                  due_time: c.suggestion.time,
                  end_time: c.suggestion.end_time,
                })}{" "}
                — {c.suggestion.reason}. Not applied.
              </p>
            )}
            <div className="cb-actions">
              <button
                className="btn btn-small"
                onClick={() =>
                  onNavigate("ask", {
                    askPreset: {
                      question:
                        `Explain my schedule conflict on ${c.date}: ` +
                        `"${c.tasks[0].title}" (${formatRange(c.tasks[0])}) ` +
                        `overlaps "${c.tasks[1].title}" (${formatRange(c.tasks[1])}). ` +
                        "Suggest options and draft a short message if helpful. " +
                        "Do not change anything.",
                      spaceId: null,
                      autoAsk: true,
                    },
                  })
                }
              >
                Review with assistant
              </button>
              {c.suggestion?.person && (
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() =>
                    onNavigate("ask", {
                      askPreset: {
                        question:
                          `Draft a short, friendly message to ${c.suggestion.person} ` +
                          `asking to move "${c.suggestion.move_task_title}" from ` +
                          `${formatRange({ due_time: c.time })} to ` +
                          `${formatRange({
                            due_time: c.suggestion.time,
                            end_time: c.suggestion.end_time,
                          })} ` +
                          `on ${c.date === cal.today ? "today" : shortDate(c.date)} ` +
                          `because of my "${
                            c.tasks.find(
                              (t) => t.id !== c.suggestion.move_task_id
                            )?.title
                          }". Do not change anything.`,
                        spaceId: null,
                        autoAsk: true,
                      },
                    })
                  }
                >
                  Draft message to {c.suggestion.person.split(" ")[0]}
                </button>
              )}
              <span className="cb-note">
                Unresolved · no changes made
              </span>
            </div>
          </div>
        ))}
        {cal.undated_count > 0 && (
          <p className="muted">
            {cal.undated_count} undated task
            {cal.undated_count !== 1 ? "s are" : " is"} on the Overview.
          </p>
        )}
        <p className="muted" style={{ fontSize: 12 }}>
          Overlaps are computed from saved start/end times — no AI
          guessing. Nothing is moved automatically.
        </p>
      </div>
    </>
  );
}
