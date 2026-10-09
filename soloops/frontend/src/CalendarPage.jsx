import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./api";
import { spaceColor, formatRange, formatTime12, shortDate } from "./spaces";
import QuickAddTask from "./QuickAddTask";

const HOUR_PX = 60;
const PAD_TOP = 8;

// pure string/UTC date math — never local-time toISOString
function shiftDaysUTC(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const p = (v) => String(v).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

function mondayOnOrBefore(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  return shiftDaysUTC(iso, -((dow + 6) % 7));
}

function shiftMonthUTC(anchor, n) {
  const dt = new Date(Date.UTC(anchor.y, anchor.m - 1 + n, 1));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1 };
}

function monthGridStart(anchor) {
  const p = (v) => String(v).padStart(2, "0");
  return mondayOnOrBefore(`${anchor.y}-${p(anchor.m)}-01`);
}

function shortRange(t) {
  if (!t.end_time) return formatTime12(t.due_time);
  const a = formatTime12(t.due_time);
  const b = formatTime12(t.end_time);
  const aTxt =
    a.slice(-2) === b.slice(-2)
      ? a.slice(0, -3).replace(/:00$/, "")
      : a;
  return `${aTxt}–${b}`;
}

function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
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

function monthLabel(anchor) {
  return new Date(Date.UTC(anchor.y, anchor.m - 1, 1)).toLocaleDateString(
    "en-US", { month: "long", year: "numeric", timeZone: "UTC" }
  );
}

// assign side-by-side columns to overlapping events within one day
function layoutDay(events) {
  const sorted = [...events].sort((a, b) => a.s - b.s || a.e - b.e);
  const clusters = [];
  let cur = null;
  for (const ev of sorted) {
    if (cur && ev.s < cur.end) {
      cur.events.push(ev);
      cur.end = Math.max(cur.end, ev.e);
    } else {
      cur = { events: [ev], end: ev.e };
      clusters.push(cur);
    }
  }
  const placed = new Map();
  for (const cl of clusters) {
    const cols = [];
    for (const ev of cl.events) {
      let c = cols.findIndex((last) => last <= ev.s);
      if (c === -1) {
        c = cols.length;
        cols.push(0);
      }
      cols[c] = ev.e;
      placed.set(ev.t.id, { col: c, cols: null });
    }
    for (const ev of cl.events) {
      placed.get(ev.t.id).cols = cols.length;
    }
  }
  return placed;
}

export default function CalendarPage({
  spaces,
  attention,
  onNavigate,
  onChanged,
  onLockIn,
}) {
  const [view, setView] = useState(
    () =>
      new URLSearchParams(window.location.search).get("view") === "month"
        ? "month"
        : "week"
  );
  const [start, setStart] = useState(null); // week anchor (ISO) | null = current
  const [month, setMonth] = useState(null); // {y,m} | null = derive from today
  const [cal, setCal] = useState(null);
  const [error, setError] = useState("");
  const [quickAdd, setQuickAdd] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const bodyRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // null anchors -> backend computes the Asia/Manila "current" week;
  // navigation shifts RESPONSE dates with pure UTC math.
  useEffect(() => {
    let url;
    if (view === "week") {
      url = start ? `/calendar?start=${start}&days=7` : "/calendar?days=7";
    } else if (month) {
      url = `/calendar?start=${monthGridStart(month)}&days=42`;
    } else {
      url = "/calendar?days=7"; // bootstrap: grab today, then anchor month
    }
    apiFetch(url)
      .then((data) => {
        setCal(data);
        setError("");
        if (view === "month" && !month && data.today) {
          setMonth({
            y: Number(data.today.slice(0, 4)),
            m: Number(data.today.slice(5, 7)),
          });
        }
      })
      .catch((err) => setError(err.message));
  }, [view, start, month, attention]);

  const conflictTaskIds = useMemo(
    () =>
      new Set(
        (cal?.conflicts || []).flatMap((c) => c.tasks.map((t) => t.id))
      ),
    [cal]
  );

  // visible hour range for the week grid
  const { startHour, endHour } = useMemo(() => {
    if (!cal) return { startHour: 7, endHour: 22 };
    let lo = 7;
    let hi = 22;
    for (const day of cal.days) {
      for (const t of day.tasks) {
        if (!t.due_time) continue;
        const s = Math.floor(toMin(t.due_time) / 60);
        const e = t.end_time
          ? Math.ceil(toMin(t.end_time) / 60)
          : Math.floor(toMin(t.due_time) / 60) + 1;
        lo = Math.min(lo, s);
        hi = Math.max(hi, e);
      }
    }
    return { startHour: Math.max(0, lo), endHour: Math.min(24, hi) };
  }, [cal]);

  useEffect(() => {
    // on fresh data, scroll so ~1h before the earliest event (or 8 AM) is top
    if (!cal || view !== "week" || !bodyRef.current) return;
    let earliest = 8;
    for (const day of cal.days) {
      for (const t of day.tasks) {
        if (t.due_time) earliest = Math.min(earliest, toMin(t.due_time) / 60);
      }
    }
    const top =
      Math.max(0, earliest - 1 - startHour) * HOUR_PX + PAD_TOP;
    bodyRef.current.scrollTop = Math.max(0, top - 16);
  }, [cal, view, startHour]);

  if (!cal) {
    return error
      ? <p className="extractor-error">{error}</p>
      : <p className="muted">Loading...</p>;
  }

  const hours = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMin / 60 - startHour) * HOUR_PX;
  const visibleConflicts =
    view === "month" && month
      ? cal.conflicts.filter((c) =>
          c.date.startsWith(
            `${month.y}-${String(month.m).padStart(2, "0")}`
          )
        )
      : cal.conflicts;

  function goToday() {
    setStart(null);
    setMonth(null);
  }

  function prev() {
    if (view === "week") setStart(shiftDaysUTC(cal.start, -7));
    else setMonth(shiftMonthUTC(month, -1));
  }

  function next() {
    if (view === "week") setStart(shiftDaysUTC(cal.start, 7));
    else setMonth(shiftMonthUTC(month, 1));
  }

  function openWeek(iso) {
    setView("week");
    setStart(mondayOnOrBefore(iso));
  }

  const label =
    view === "week"
      ? rangeLabel(cal.days.slice(0, 7))
      : month
        ? monthLabel(month)
        : rangeLabel(cal.days.slice(0, 7));

  function ConflictActions({ c }) {
    return (
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
                      c.tasks.find((t) => t.id !== c.suggestion.move_task_id)
                        ?.title
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
        <span className="cb-note">Unresolved · no changes made</span>
      </div>
    );
  }

  const conflictsCard = (
    <div className="card" style={{ marginTop: 22 }}>
      <div className="card-head">
        <h3>Overlaps this {view}</h3>
      </div>
      {visibleConflicts.length === 0 && (
        <p className="muted">No overlaps this {view}.</p>
      )}
      {visibleConflicts.map((c, i) => (
        <div key={i} className="conflict-banner" style={{ marginBottom: 12 }}>
          <div className="cb-title">
            <span>
              ⚠ Two places at one time · {formatRange({ due_time: c.time })}
            </span>
            <small>{c.date === cal.today ? "Today" : shortDate(c.date)}</small>
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
          <ConflictActions c={c} />
        </div>
      ))}
      {cal.undated_count > 0 && (
        <p className="muted">
          {cal.undated_count} undated task
          {cal.undated_count !== 1 ? "s are" : " is"} on the Overview.
        </p>
      )}
      <p className="muted" style={{ fontSize: 12 }}>
        Overlaps are computed from saved start/end times — no AI guessing.
        Nothing is moved automatically.
      </p>
    </div>
  );

  const weekView = (
    <div className="cal-scroll">
      <div className="cal-week">
        <div className="cal-week-head">
          <div className="cal-gutter" />
          {cal.days.slice(0, 7).map((day) => (
            <div
              key={day.date}
              className={
                "cal-head" + (day.date === cal.today ? " cal-today" : "")
              }
            >
              <div className="wd">{day.weekday.slice(0, 3)}</div>
              <div className="num">{Number(day.date.slice(8))}</div>
            </div>
          ))}
        </div>
        <div className="cal-allday">
          <div className="cal-gutter">Due</div>
          {cal.days.slice(0, 7).map((day) => (
            <div key={day.date} className="cal-allday-cell">
              {day.tasks
                .filter((t) => !t.due_time)
                .map((t) => (
                  <button
                    key={t.id}
                    className="cal-chip"
                    title={t.title}
                    onClick={() => onLockIn?.(t.id)}
                  >
                    <span
                      className="nav-dot"
                      style={{
                        background: spaceColor(t.business_id, spaces),
                      }}
                    />
                    <span className="cal-chip-text">{t.title}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
        <div className="cal-week-body" ref={bodyRef}>
          <div className="cal-gutter cal-gutter-hours">
            {hours.map((h) => (
              <div
                key={h}
                className="cal-hour-label"
                style={{ top: PAD_TOP + (h - startHour) * HOUR_PX - 7 }}
              >
                {formatTime12(`${String(h).padStart(2, "0")}:00`)}
              </div>
            ))}
          </div>
          {cal.days.slice(0, 7).map((day) => {
            const timed = day.tasks
              .filter((t) => t.due_time)
              .map((t) => ({
                t,
                s: toMin(t.due_time),
                e: t.end_time ? toMin(t.end_time) : toMin(t.due_time),
              }));
            const layout = layoutDay(timed);
            return (
              <div
                key={day.date}
                className={
                  "cal-day-col" +
                  (day.date === cal.today ? " cal-today" : "")
                }
                style={{
                  height: PAD_TOP + (endHour - startHour) * HOUR_PX,
                }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="cal-hour-line"
                    style={{ top: PAD_TOP + (h - startHour) * HOUR_PX }}
                  />
                ))}
                {hours.slice(0, -1).map((h) => (
                  <div
                    key={`${h}-h`}
                    className="cal-half-line"
                    style={{
                      top: PAD_TOP + (h - startHour) * HOUR_PX + HOUR_PX / 2,
                    }}
                  />
                ))}
                {timed.map(({ t, s, e }) => {
                  const color = spaceColor(t.business_id, spaces);
                  const { col, cols } = layout.get(t.id);
                  const w = 100 / cols;
                  const hPx = Math.max(e - s, 30) * (HOUR_PX / 60) - 2;
                  const compact = hPx < 44 || (1 / cols < 0.5 && hPx < 60);
                  const narrow = cols > 1;
                  return (
                    <button
                      key={t.id}
                      className={
                        "cal-event" +
                        (compact ? " compact" : "") +
                        (!compact && narrow ? " narrow" : "") +
                        (conflictTaskIds.has(t.id) ? " conflict" : "") +
                        (t.status === "completed" ? " done" : "")
                      }
                      title={`${formatRange(t)} · ${t.title} · ${t.business_name}`}
                      onClick={() => onLockIn?.(t.id)}
                      style={{
                        top: Math.max(
                          0,
                          PAD_TOP + (s / 60 - startHour) * HOUR_PX
                        ),
                        height: hPx,
                        left: `calc(${col * w}% + 2px)`,
                        width: `calc(${w}% - 4px)`,
                        background: `${color}1f`,
                        borderLeftColor: color,
                      }}
                    >
                      {compact ? (
                        <span className="ti">
                          {conflictTaskIds.has(t.id) && "⚠ "}
                          {formatTime12(t.due_time)} · {t.title}
                        </span>
                      ) : (
                        <>
                          <span className="t">
                            {conflictTaskIds.has(t.id) && "⚠ "}
                            {narrow ? shortRange(t) : formatRange(t)}
                          </span>
                          <span className="ti">{t.title}</span>
                          {hPx >= 72 && !narrow && (
                            <span className="sp">{t.business_name}</span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
                {day.date === cal.today &&
                  nowMin >= startHour * 60 &&
                  nowMin <= endHour * 60 && (
                    <div
                      className="cal-now"
                      style={{ top: PAD_TOP + nowTop }}
                    />
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const monthView = (
    <div className="cal-scroll">
      <div className="cal-month">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((wd) => (
          <div key={wd} className="cal-month-wd">
            {wd}
          </div>
        ))}
        {cal.days.map((day) => {
          const inMonth =
            month &&
            Number(day.date.slice(5, 7)) === month.m &&
            Number(day.date.slice(0, 4)) === month.y;
          const items = day.tasks;
          return (
            <button
              key={day.date}
              className={
                "cal-month-cell" +
                (inMonth ? "" : " outside") +
                (day.date === cal.today ? " cal-today" : "")
              }
              onClick={() => openWeek(day.date)}
            >
              <span className="num">{Number(day.date.slice(8))}</span>
              {items.slice(0, 3).map((t) => (
                <span
                  key={t.id}
                  className={
                    "cal-month-item" +
                    (conflictTaskIds.has(t.id) ? " conflict" : "")
                  }
                  title={`${formatRange(t) || "Due"} · ${t.title} · ${t.business_name}`}
                >
                  <span
                    className="nav-dot"
                    style={{ background: spaceColor(t.business_id, spaces) }}
                  />
                  {t.due_time
                    ? `${formatTime12(t.due_time)} ${t.title}`
                    : `Due · ${t.title}`}
                </span>
              ))}
              {items.length > 3 && (
                <span className="cal-month-more">
                  +{items.length - 3} more
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <h1>One calendar. All of you.</h1>
        <p className="page-sub">
          See every commitment together — and keep a little room between them.
        </p>
      </div>

      <div className="cal-controls">
        <button className="cal-nav" onClick={goToday}>
          Today
        </button>
        <button className="cal-nav" onClick={prev}>
          ‹
        </button>
        <button className="cal-nav" onClick={next}>
          ›
        </button>
        <span className="cal-label">{label}</span>
        <span style={{ flex: 1 }} />
        <div className="seg">
          <button
            className={view === "week" ? "seg-active" : ""}
            onClick={() => setView("week")}
          >
            Week
          </button>
          <button
            className={view === "month" ? "seg-active" : ""}
            onClick={() => setView("month")}
          >
            Month
          </button>
        </div>
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

      {view === "week" ? weekView : monthView}
      {conflictsCard}
    </>
  );
}
