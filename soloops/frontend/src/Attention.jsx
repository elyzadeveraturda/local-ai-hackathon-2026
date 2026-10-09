import { useState } from "react";
import { apiFetch } from "./api";
import { spaceColor, dueText } from "./spaces";

export default function Attention({
  data,
  spaces,
  spaceId,
  onLockIn,
  onChanged,
  title = "Your next moves",
}) {
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

  async function setStatus(taskId, action) {
    setBusyId(taskId);
    try {
      await apiFetch(`/tasks/${taskId}/${action}`, { method: "PATCH" });
      setError("");
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return <p className="muted">Loading...</p>;

  const inSpace = (t) => !spaceId || t.business_id === spaceId;
  const groups = data.groups
    .map((g) => ({ ...g, tasks: g.tasks.filter(inSpace) }))
    .filter((g) => g.tasks.length > 0);
  const completed = data.completed.filter(inSpace);
  const pending = groups.reduce((n, g) => n + g.tasks.length, 0);
  const overdue =
    groups.find((g) => g.key === "overdue")?.tasks.length || 0;

  return (
    <div>
      <div className="card-head">
        <h3>{title}</h3>
        <small>
          {pending} pending{overdue ? ` · ${overdue} overdue` : ""}
        </small>
      </div>

      {error && <p role="alert" className="extractor-error">{error}</p>}

      {groups.length === 0 && (
        <p className="muted">
          No pending tasks. Capture something with AI Capture to see it here.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.key} className="attention-group">
          <h3 className={`bucket bucket-${group.key}`}>
            {group.label} <span>{group.tasks.length}</span>
          </h3>
          {group.tasks.map((task) => {
            const urgent =
              group.key === "overdue" || group.key === "today";
            return (
              <article key={task.id} className="task-row">
                <button
                  className={`check-btn${urgent ? " urgent" : ""}`}
                  title="Mark complete"
                  disabled={busyId === task.id}
                  onClick={() => setStatus(task.id, "complete")}
                />
                {urgent && <span className="urgent-dot" />}
                <div className="task-main">
                  <strong>{task.title}</strong>
                  <small>
                    <span
                      className="space-name"
                      style={{ color: spaceColor(task.business_id, spaces) }}
                    >
                      {task.business_name}
                    </span>
                    {` · ${dueText(task)}`}
                    {task.customer && ` · ${task.customer}`}
                    {task.amount != null && ` · ₱${task.amount}`}
                  </small>
                </div>
                <div className="task-actions">
                  <button
                    className="link-button"
                    onClick={() => onLockIn?.(task.id)}
                  >
                    Lock In
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ))}

      {completed.length > 0 && (
        <div className="attention-group">
          <button
            className="link-button"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? "Hide" : "Show"} completed ({completed.length})
          </button>
          {showCompleted &&
            completed.map((task) => (
              <article key={task.id} className="task-row completed">
                <button
                  className="check-btn"
                  title="Reopen"
                  disabled={busyId === task.id}
                  onClick={() => setStatus(task.id, "reopen")}
                />
                <div className="task-main">
                  <strong>{task.title}</strong>
                  <small>
                    <span
                      className="space-name"
                      style={{ color: spaceColor(task.business_id, spaces) }}
                    >
                      {task.business_name}
                    </span>
                  </small>
                </div>
              </article>
            ))}
        </div>
      )}
    </div>
  );
}
