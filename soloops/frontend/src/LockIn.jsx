import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { spaceColor, dueText } from "./spaces";

const SESSION_SECONDS = 25 * 60;

function formatClock(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function LockIn({ initialTaskId, spaces = [], onChanged }) {
  const [tasks, setTasks] = useState([]);
  const [taskId, setTaskId] = useState(
    initialTaskId ? String(initialTaskId) : ""
  );
  const [plan, setPlan] = useState(null);
  const [checked, setChecked] = useState([]);
  const [planning, setPlanning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [completedTask, setCompletedTask] = useState(null);

  useEffect(() => {
    apiFetch("/tasks?status=pending")
      .then((data) => {
        const today = new Date(
          `${new Date().toLocaleDateString("en-CA")}T00:00:00`
        );
        data.forEach((t) => {
          if (t.due_date && t.days_until_due == null) {
            t.days_until_due = Math.round(
              (new Date(`${t.due_date}T00:00:00`) - today) / 86400000
            );
          }
        });
        setTasks(data);
        if (!initialTaskId && data.length > 0) {
          setTaskId(String(data[0].id));
        }
      })
      .catch((err) => setError(err.message));
  }, [initialTaskId]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  const task = tasks.find((t) => String(t.id) === taskId);

  function selectTask(id) {
    setTaskId(id);
    setPlan(null);
    setChecked([]);
    setCompletedTask(null);
    setRunning(false);
    setSecondsLeft(SESSION_SECONDS);
  }

  async function generatePlan() {
    if (!task || planning) return;
    setPlanning(true);
    setError("");
    try {
      const result = await apiFetch("/lock-in/plan", {
        method: "POST",
        body: JSON.stringify({ task_id: task.id }),
      });
      setPlan(result);
      setChecked(result.steps.map(() => false));
    } catch (err) {
      setError(err.message);
    } finally {
      setPlanning(false);
    }
  }

  async function completeTask() {
    if (!task) return;
    setError("");
    try {
      await apiFetch(`/tasks/${task.id}/complete`, { method: "PATCH" });
      setCompletedTask(task);
      setRunning(false);
      setTasks(tasks.filter((t) => t.id !== task.id));
      setTaskId("");
      setPlan(null);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  const doneCount = checked.filter(Boolean).length;
  const elapsed = 1 - secondsLeft / SESSION_SECONDS;

  return (
    <>
      {error && <p role="alert" className="extractor-error">{error}</p>}

      {completedTask && (
        <div className="save-success">
          ✓ "{completedTask.title}" marked complete. Nice work!
        </div>
      )}

      <div className="focus-select">
        Focusing on
        <select
          value={taskId}
          onChange={(e) => selectTask(e.target.value)}
        >
          {tasks.length === 0 && <option value="">No pending tasks</option>}
          {tasks.length > 0 && !task && (
            <option value="">Select a task</option>
          )}
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} — {t.business_name}
            </option>
          ))}
        </select>
      </div>

      {task && (
        <>
          <div>
            <h1 className="focus-title">{task.title}</h1>
            <div className="focus-meta">
              <span
                className="nav-dot"
                style={{
                  background: spaceColor(task.business_id, spaces),
                }}
              />
              <span>{task.business_name}</span>
              {task.customer && ` · ${task.customer}`}
              {task.item && ` · ${task.item}`}
              {task.due_date && ` · ${dueText(task)}`}
            </div>
          </div>

          <div className="card timer-card">
            <div className="timer">{formatClock(secondsLeft)}</div>
            <div className="progress">
              <div style={{ width: `${elapsed * 100}%` }} />
            </div>
            {secondsLeft === 0 && (
              <p className="muted">Session complete! Take a 5-minute break.</p>
            )}
            <div className="timer-actions">
              <button
                className="btn"
                onClick={() => setRunning(!running)}
                disabled={secondsLeft === 0}
              >
                {running
                  ? "Pause"
                  : secondsLeft < SESSION_SECONDS
                  ? "Resume"
                  : "Start"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setRunning(false);
                  setSecondsLeft(SESSION_SECONDS);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Focus plan</h3>
            </div>
            {!plan && (
              <button
                className="btn btn-secondary"
                onClick={generatePlan}
                disabled={planning}
              >
                {planning ? "Planning with Local AI..." : "✦ Generate Plan"}
              </button>
            )}
            {plan && (
              <>
                <p className="plan-goal">
                  <strong>Goal:</strong> {plan.goal}
                </p>
                <small className="muted">
                  {plan.source === "ai"
                    ? "Generated by local AI (qwen2.5:3b)"
                    : "Local AI unavailable — using built-in checklist"}{" "}
                  · {doneCount}/{plan.steps.length} done
                </small>
                <ul className="checklist">
                  {plan.steps.map((step, i) => (
                    <li key={i} className={checked[i] ? "done" : ""}>
                      <label>
                        <input
                          type="checkbox"
                          checked={!!checked[i]}
                          onChange={() =>
                            setChecked(
                              checked.map((c, j) => (j === i ? !c : c))
                            )
                          }
                        />
                        {step}
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <button
            className="complete-button"
            style={{ width: "100%", padding: "14px" }}
            onClick={completeTask}
          >
            ✓ Mark task complete
          </button>
        </>
      )}
    </>
  );
}
