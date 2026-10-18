import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { spaceColor, dueText } from "./spaces";
import { formatClock, finishedMessage, FOCUS_LOGGED_EVENT } from "./useFocusTimer";
import { ModeSwitch, PresetRow } from "./TimerControls";

function FocusHistory() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiFetch("/focus-sessions?days=7")
        .then((d) => alive && setData(d))
        .catch(() => alive && setData(null));
    load();
    window.addEventListener(FOCUS_LOGGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(FOCUS_LOGGED_EVENT, load);
    };
  }, []);

  if (!data) return null;
  const recent = data.sessions.filter((x) => x.kind === "focus").slice(0, 5);
  return (
    <div className="card focus-history">
      <div className="card-head">
        <h3>Focus history</h3>
        <small>
          Today: {data.today.focus_sessions} session
          {data.today.focus_sessions === 1 ? "" : "s"} ·{" "}
          {data.today.focus_minutes} min
        </small>
      </div>
      {recent.length === 0 ? (
        <p className="muted">
          Finished focus sessions from the last 7 days appear here.
        </p>
      ) : (
        <ul className="history-list">
          {recent.map((x) => (
            <li key={x.id}>
              <span>{x.task_title || "Untitled session"}</span>
              <small>
                {x.minutes} min ·{" "}
                {new Date(`${x.completed_at.replace(" ", "T")}Z`).toLocaleString(
                  undefined,
                  { weekday: "short", hour: "numeric", minute: "2-digit" }
                )}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function LockIn({ initialTaskId, spaces = [], onChanged, timer }) {
  const [tasks, setTasks] = useState([]);
  const [taskId, setTaskId] = useState(
    initialTaskId ? String(initialTaskId) : ""
  );
  const [plan, setPlan] = useState(null);
  const [checked, setChecked] = useState([]);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState("");
  const [completedTask, setCompletedTask] = useState(null);

  const secondsLeft = timer.remainingSec;
  const running = timer.running;

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

  // link the shared timer to the focused task when idle
  useEffect(() => {
    if (taskId && !timer.running) {
      timer.setTaskId(Number(taskId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const task = tasks.find((t) => String(t.id) === taskId);

  function selectTask(id) {
    setTaskId(id);
    setPlan(null);
    setChecked([]);
    setCompletedTask(null);
    if (!timer.running) timer.reset();
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
      timer.reset();
      timer.setTaskId(null);
      setTasks(tasks.filter((t) => t.id !== task.id));
      setTaskId("");
      setPlan(null);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  const doneCount = checked.filter(Boolean).length;
  const elapsed = 1 - secondsLeft / timer.durationSec;

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
            <ModeSwitch timer={timer} />
            <div className="timer">{formatClock(secondsLeft)}</div>
            <div className="progress">
              <div style={{ width: `${elapsed * 100}%` }} />
            </div>
            <PresetRow
              timer={timer}
              style={{ justifyContent: "center", margin: "0 0 10px" }}
            />
            {timer.finished && (
              <p className="muted">{finishedMessage(timer)}</p>
            )}
            <div className="timer-actions">
              <button
                className="btn"
                onClick={running ? timer.pause : timer.start}
                disabled={secondsLeft === 0 && !running}
              >
                {running
                  ? "Pause"
                  : secondsLeft < timer.durationSec
                  ? "Resume"
                  : "Start"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={timer.reset}
              >
                Reset
              </button>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              Focus and break lengths are remembered · keeps time
              in background tabs · shared with the floating timer
            </p>
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

      <FocusHistory />
    </>
  );
}
