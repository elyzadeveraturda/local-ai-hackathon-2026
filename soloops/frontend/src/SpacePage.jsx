import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import {
  spaceColor,
  categoryIcon,
  formatTime12,
  shortDate,
} from "./spaces";
import Attention from "./Attention";

export default function SpacePage({
  space,
  spaces,
  spacesLoaded,
  attention,
  onNavigate,
  onChanged,
  onLockIn,
}) {
  const [schedule, setSchedule] = useState([]);

  const tasks = (attention?.tasks || []).filter(
    (t) => t.business_id === space?.id
  );

  useEffect(() => {
    if (!attention?.today) return;
    apiFetch(`/calendar?start=${attention.today}&days=14`)
      .then((data) => {
        setSchedule(
          data.days.flatMap((d) =>
            d.tasks
              .filter(
                (t) =>
                  t.business_id === space.id &&
                  t.status !== "completed" &&
                  t.due_time
              )
              .map((t) => ({ ...t, date: d.date }))
          )
        );
      })
      .catch(() => {});
  }, [attention, space]);

  if (!spacesLoaded) return <p className="muted">Loading…</p>;
  if (!space) return <p className="muted">Space not found.</p>;

  const overdue = tasks.filter((t) => (t.days_until_due ?? 1) < 0);
  const dueToday = tasks.filter((t) => t.days_until_due === 0);
  const dated = tasks.filter((t) => t.due_date);
  const next = dated.length ? dated[0] : null;

  return (
    <>
      <div className="page-head">
        <h1>
          {categoryIcon(space.category)} {space.name}
        </h1>
        <p className="page-sub">
          {space.category} · {space.business_type}
          {space.description ? ` — ${space.description}` : ""}
        </p>
      </div>

      <div className="space-actions">
        <button
          className="btn"
          onClick={() =>
            onNavigate("capture", { spaceId: space.id })
          }
        >
          + Capture into this space
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => onNavigate("ask", { spaceId: space.id })}
        >
          Ask about this space
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => onNavigate("spaces")}
        >
          Edit
        </button>
      </div>

      <div className="stats">
        <div className="stat-card">
          <small>Pending</small>
          <strong>{tasks.length}</strong>
        </div>
        <div className="stat-card">
          <small>Overdue / Due today</small>
          <strong className={overdue.length ? "danger" : ""}>
            {overdue.length} / {dueToday.length}
          </strong>
        </div>
        <div className="stat-card">
          <small>Next deadline</small>
          <strong style={{ fontSize: 15 }}>
            {next ? `${next.title} · ${shortDate(next.due_date)}` : "—"}
          </strong>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <Attention
          data={attention}
          spaces={spaces}
          spaceId={space.id}
          onLockIn={onLockIn}
          onChanged={onChanged}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Upcoming schedule</h3>
          <small>next 14 days</small>
        </div>
        {schedule.length === 0 && (
          <p className="muted">Nothing scheduled in the next two weeks.</p>
        )}
        {schedule.map((task) => (
          <div className="rhythm-row" key={task.id}>
            <span className="rhythm-time">
              {formatTime12(task.due_time)}
            </span>
            <span
              className="rhythm-bar"
              style={{ background: spaceColor(space.id, spaces) }}
            />
            <div className="rhythm-body">
              <strong>{task.title}</strong>
              <small>
                {shortDate(task.date)}
                {task.end_time && ` · until ${formatTime12(task.end_time)}`}
              </small>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
