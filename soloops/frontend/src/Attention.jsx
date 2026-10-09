import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";

function formatDue(task) {
  if (!task.due_date) return "No due date";
  return task.due_time ? `${task.due_date} ${task.due_time}` : task.due_date;
}

export default function Attention({ onLockIn, onData }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch("/attention");
      setData(result);
      onData?.(result);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [onData]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(taskId, action) {
    setBusyId(taskId);
    try {
      await apiFetch(`/tasks/${taskId}/${action}`, { method: "PATCH" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (error && !data) {
    return <p role="alert" className="extractor-error">{error}</p>;
  }
  if (!data) return <p>Loading today's attention...</p>;

  const groups = data.groups.filter((g) => g.tasks.length > 0);

  return (
    <section className="attention">
      <div className="attention-header">
        <h2>Today's Attention</h2>
        <small>
          {data.today} (Philippine time) · {data.counts.pending} pending
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
          {group.tasks.map((task) => (
            <article key={task.id} className="task-row">
              <div className="task-main">
                <strong>{task.title}</strong>
                <small>
                  <span className="business-pill">
                    {task.space_category ? `${task.space_category} · ` : ""}
                    {task.business_name}
                  </span>
                  {task.customer && ` · ${task.customer}`}
                  {task.item && ` · ${task.item}`}
                  {task.amount != null && ` · ₱${task.amount}`}
                </small>
              </div>
              <span className={`due due-${task.priority_bucket}`}>
                {formatDue(task)}
              </span>
              <div className="task-actions">
                <button onClick={() => onLockIn?.(task.id)}>Lock In</button>
                <button
                  disabled={busyId === task.id}
                  onClick={() => setStatus(task.id, "complete")}
                >
                  ✓ Complete
                </button>
              </div>
            </article>
          ))}
        </div>
      ))}

      {data.completed.length > 0 && (
        <div className="attention-group">
          <button
            className="link-button"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? "Hide" : "Show"} completed ({data.completed.length})
          </button>
          {showCompleted &&
            data.completed.map((task) => (
              <article key={task.id} className="task-row completed">
                <div className="task-main">
                  <strong>{task.title}</strong>
                  <small>
                    <span className="business-pill">
                      {task.space_category ? `${task.space_category} · ` : ""}
                      {task.business_name}
                    </span>
                  </small>
                </div>
                <span className="due">{formatDue(task)}</span>
                <div className="task-actions">
                  <button
                    disabled={busyId === task.id}
                    onClick={() => setStatus(task.id, "reopen")}
                  >
                    Reopen
                  </button>
                </div>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}
