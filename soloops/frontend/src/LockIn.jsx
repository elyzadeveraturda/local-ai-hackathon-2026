import { useEffect, useState } from "react";
import { apiFetch } from "./api";

const SESSION_SECONDS = 25 * 60;

function formatClock(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function LockIn({ initialTaskId }) {
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
    } catch (err) {
      setError(err.message);
    }
  }

  const doneCount = checked.filter(Boolean).length;

  return (
    <section className="lockin-page">
      <h1>◷ Lock In Mode</h1>
      <p className="muted">
        Pick one task, get a local AI plan, and focus for 25 minutes.
      </p>

      {error && <p role="alert" className="extractor-error">{error}</p>}

      {completedTask && (
        <div className="save-success">
          ✓ "{completedTask.title}" marked complete. Nice work!
        </div>
      )}

      <div className="extractor-card">
        <label htmlFor="lockin-task">Task</label>
        <select
          id="lockin-task"
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

        {task && (
          <div className="lockin-task">
            <strong>{task.title}</strong>
            <small>
              <span className="business-pill">
                {task.space_category ? `${task.space_category} · ` : ""}
                {task.business_name}
              </span>
              {task.customer && ` · ${task.customer}`}
              {task.item && ` · ${task.item}`}
              {task.due_date &&
                ` · due ${task.due_date}${task.due_time ? " " + task.due_time : ""}`}
            </small>
          </div>
        )}
      </div>

      {task && (
        <div className="lockin-grid">
          <div className="extractor-card timer-card">
            <div className="timer">{formatClock(secondsLeft)}</div>
            {secondsLeft === 0 && <p>Session complete! Take a 5-minute break.</p>}
            <div className="business-actions">
              <button
                onClick={() => setRunning(!running)}
                disabled={secondsLeft === 0}
              >
                {running ? "Pause" : secondsLeft < SESSION_SECONDS ? "Resume" : "Start"}
              </button>
              <button
                onClick={() => {
                  setRunning(false);
                  setSecondsLeft(SESSION_SECONDS);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="extractor-card">
            <h2>Focus Plan</h2>
            {!plan && (
              <button onClick={generatePlan} disabled={planning}>
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
                            setChecked(checked.map((c, j) => (j === i ? !c : c)))
                          }
                        />
                        {step}
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button className="complete-button" onClick={completeTask}>
              ✓ Mark Task Complete
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
