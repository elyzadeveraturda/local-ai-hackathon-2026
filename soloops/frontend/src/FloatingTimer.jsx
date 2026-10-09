import { useState } from "react";
import { createPortal } from "react-dom";
import { formatClock } from "./useFocusTimer";

const PRESETS = [5, 15, 25, 50];

export default function FloatingTimer({
  timer,
  tasks,
  onOpenFocus,
}) {
  const [expanded, setExpanded] = useState(
    () =>
      new URLSearchParams(window.location.search).get("timer") ===
        "open" || localStorage.getItem("soloops-timer-open") === "1"
  );
  const [customMin, setCustomMin] = useState("");
  const [pipWin, setPipWin] = useState(null);

  const hasSession = timer.running || timer.remainingSec < timer.durationSec || timer.finished;

  function toggle(open) {
    setExpanded(open);
    try {
      localStorage.setItem("soloops-timer-open", open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function applyCustom() {
    const m = Number(customMin);
    if (m >= 1) timer.setDurationMin(m);
    setCustomMin("");
  }

  async function popOut() {
    if (!("documentPictureInPicture" in window)) return;
    try {
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 280,
        height: 220,
      });
      for (const el of document.querySelectorAll(
        'link[rel="stylesheet"], style'
      )) {
        pip.document.head.appendChild(el.cloneNode(true));
      }
      pip.document.body.style.margin = "0";
      pip.addEventListener("pagehide", () => setPipWin(null));
      setPipWin(pip);
    } catch {
      /* user closed or unsupported */
    }
  }

  const taskTitle =
    tasks.find((t) => t.id === timer.taskId)?.title || null;

  const pipContent = pipWin && (
    <div className="pip-timer">
      <div className="pip-clock">{formatClock(timer.remainingSec)}</div>
      {taskTitle && <div className="pip-task">{taskTitle}</div>}
      <div className="pip-actions">
        <button
          className="btn btn-small"
          onClick={timer.running ? timer.pause : timer.start}
        >
          {timer.running ? "Pause" : "Start"}
        </button>
        <button
          className="btn btn-secondary btn-small"
          onClick={timer.reset}
        >
          Reset
        </button>
      </div>
    </div>
  );

  return (
    <>
      {expanded ? (
        <div className="float-card">
          <div className="float-head">
            <span>Focus timer</span>
            <button className="link-button" onClick={() => toggle(false)}>
              –
            </button>
          </div>
          <label className="field-label" style={{ marginBottom: 8 }}>
            Linked task
            <select
              className="control"
              value={timer.taskId || ""}
              onChange={(e) =>
                timer.setTaskId(
                  e.target.value ? Number(e.target.value) : null
                )
              }
            >
              <option value="">No task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <div className="float-clock">{formatClock(timer.remainingSec)}</div>
          <div className="progress">
            <div
              style={{
                width: `${
                  (1 - timer.remainingSec / timer.durationSec) * 100
                }%`,
              }}
            />
          </div>
          {timer.finished && (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Session complete! Take a 5-minute break.
            </p>
          )}
          <div className="chip-row" style={{ margin: "8px 0" }}>
            {PRESETS.map((m) => (
              <button
                key={m}
                className={
                  timer.durationSec === m * 60
                    ? "chip chip-active"
                    : "chip"
                }
                disabled={timer.running}
                onClick={() => timer.setDurationMin(m)}
              >
                {m}m
              </button>
            ))}
            <input
              className="control float-custom"
              type="number"
              min="1"
              max="180"
              placeholder="min"
              value={customMin}
              disabled={timer.running}
              onChange={(e) => setCustomMin(e.target.value)}
              onBlur={applyCustom}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyCustom();
              }}
            />
          </div>
          <div className="float-actions">
            <button
              className="btn btn-small"
              onClick={timer.running ? timer.pause : timer.start}
              disabled={timer.remainingSec === 0 && !timer.running}
            >
              {timer.running ? "Pause" : timer.remainingSec < timer.durationSec ? "Resume" : "Start"}
            </button>
            <button
              className="btn btn-secondary btn-small"
              onClick={timer.reset}
            >
              Reset
            </button>
          </div>
          <div className="float-links">
            <button className="link-button" onClick={onOpenFocus}>
              Open Focus mode
            </button>
            {"documentPictureInPicture" in window && !pipWin && (
              <button className="link-button" onClick={popOut}>
                Pop out
              </button>
            )}
          </div>
        </div>
      ) : hasSession ? (
        <button
          className="float-pill"
          onClick={() => toggle(true)}
          title="Focus timer"
        >
          ⏱ {formatClock(timer.remainingSec)}
          <span className="float-dot">{timer.running ? "❚❚" : "▶"}</span>
        </button>
      ) : (
        <button
          className="float-btn"
          onClick={() => toggle(true)}
          title="Focus timer"
        >
          ⏱
        </button>
      )}
      {pipWin &&
        createPortal(pipContent, pipWin.document.body)}
    </>
  );
}
