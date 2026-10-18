import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";

const KEY = "soloops-focus-timer";
const LOG_KEY = "soloops-focus-logged";
const BASE_TITLE = "SoloOps";
export const FOCUS_LOGGED_EVENT = "soloops-focus-logged";

export const PRESETS = {
  focus: [15, 25, 50],
  break: [5, 10, 15],
};

export function finishedMessage(timer) {
  if (!timer.finished) return null;
  return timer.finishedMode === "focus"
    ? `Focus session complete — your ${timer.breakMin}-min break is ready.`
    : `Break over — ready for a ${timer.focusMin}-min focus session?`;
}

const clampMin = (m, fallback) => {
  const n = Math.round(Number(m));
  return n >= 1 ? Math.min(180, n) : fallback;
};

// Log a finished session exactly once per endAt, even across reloads
// or two open tabs (the endAt stamp is the dedupe key).
function logSession({ endAt, mode, durationSec, taskId }) {
  try {
    if (localStorage.getItem(LOG_KEY) === String(endAt)) return;
    localStorage.setItem(LOG_KEY, String(endAt));
  } catch {
    /* storage unavailable: still log once from this tab */
  }
  apiFetch("/focus-sessions", {
    method: "POST",
    body: JSON.stringify({
      kind: mode,
      minutes: Math.max(1, Math.round(durationSec / 60)),
      task_id: mode === "focus" ? taskId : null,
    }),
  })
    .then(() => window.dispatchEvent(new Event(FOCUS_LOGGED_EVENT)))
    .catch(() => {
      /* history is optional; the timer keeps working offline */
    });
}

// after a session ends, ready (not start) the next one
function nextAfter(t) {
  const mode = t.mode === "focus" ? "break" : "focus";
  const sec = (mode === "focus" ? t.focusMin : t.breakMin) * 60;
  return {
    ...t,
    mode,
    durationSec: sec,
    remainingSec: sec,
    running: false,
    endAt: null,
    finished: true,
    finishedMode: t.mode,
  };
}

export function formatClock(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch {
    /* audio unavailable */
  }
}

export function useFocusTimer() {
  const [timer, setTimer] = useState(() => {
    let base = {
      mode: "focus",
      focusMin: 25,
      breakMin: 5,
      durationSec: 1500,
      remainingSec: 1500,
      endAt: null,
      running: false,
      taskId: null,
      finished: false,
      finishedMode: null,
      missedEnd: null,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved) {
        base.mode = saved.mode === "break" ? "break" : "focus";
        base.focusMin = clampMin(saved.focusMin, 25);
        base.breakMin = clampMin(saved.breakMin, 5);
        base.durationSec = saved.durationSec || base.focusMin * 60;
        base.remainingSec = base.durationSec;
        base.taskId = saved.taskId ?? null;
        if (saved.endAt) {
          const rem = Math.ceil((saved.endAt - Date.now()) / 1000);
          if (rem > 0) {
            base.remainingSec = rem;
            base.endAt = saved.endAt;
            base.running = true;
          } else {
            // it ended while SoloOps was closed: log it on mount
            base.missedEnd = {
              endAt: saved.endAt,
              mode: base.mode,
              durationSec: base.durationSec,
              taskId: base.taskId,
            };
            base = nextAfter(base);
          }
        } else if (saved.remainingSec > 0) {
          base.remainingSec = Math.min(saved.remainingSec, base.durationSec);
        }
      }
    } catch {
      /* ignore */
    }
    return base;
  });

  const latest = useRef(timer);
  useEffect(() => {
    latest.current = timer;
  });

  useEffect(() => {
    if (timer.missedEnd) logSession(timer.missedEnd);
    // mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // drift-free tick from endAt; also correct after tab sleep
  useEffect(() => {
    if (!timer.running || !timer.endAt) return undefined;
    const id = setInterval(() => {
      const rem = Math.ceil((timer.endAt - Date.now()) / 1000);
      if (rem <= 0) {
        const t = latest.current;
        logSession({
          endAt: t.endAt,
          mode: t.mode,
          durationSec: t.durationSec,
          taskId: t.taskId,
        });
        setTimer((cur) => nextAfter(cur));
        chime();
        try {
          if (Notification.permission === "granted") {
            new Notification(
              t.mode === "focus"
                ? "Focus session complete — time for a break"
                : "Break over — ready to focus?"
            );
          }
        } catch {
          /* notifications unavailable */
        }
      } else {
        setTimer((t) => ({ ...t, remainingSec: rem }));
      }
    }, 250);
    return () => clearInterval(id);
  }, [timer.running, timer.endAt]);

  // persist across reloads
  useEffect(() => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          mode: timer.mode,
          focusMin: timer.focusMin,
          breakMin: timer.breakMin,
          durationSec: timer.durationSec,
          remainingSec: timer.remainingSec,
          endAt: timer.endAt,
          taskId: timer.taskId,
        })
      );
    } catch {
      /* ignore */
    }
  }, [timer]);

  // live countdown in the tab title while a session exists
  useEffect(() => {
    const active =
      timer.running || timer.remainingSec < timer.durationSec;
    if (active) {
      const label = timer.mode === "break" ? "Break" : "Focus";
      document.title = `${formatClock(timer.remainingSec)} · ${label} · ${BASE_TITLE}`;
    } else {
      document.title = BASE_TITLE;
    }
    return () => {
      document.title = BASE_TITLE;
    };
  }, [timer.running, timer.remainingSec, timer.durationSec, timer.mode]);

  const start = useCallback(() => {
    setTimer((t) => {
      if (t.running || t.remainingSec <= 0) return t;
      return {
        ...t,
        running: true,
        finished: false,
        endAt: Date.now() + t.remainingSec * 1000,
      };
    });
    try {
      if (
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        Notification.requestPermission();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const pause = useCallback(() => {
    setTimer((t) => {
      if (!t.running || !t.endAt) return t;
      return {
        ...t,
        running: false,
        endAt: null,
        remainingSec: Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000)),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setTimer((t) => ({
      ...t,
      running: false,
      endAt: null,
      remainingSec: t.durationSec,
      finished: false,
    }));
  }, []);

  // sets the length of the current mode (focus or break) and remembers it
  const setDurationMin = useCallback((m) => {
    setTimer((t) => {
      const min = clampMin(m, t.mode === "focus" ? t.focusMin : t.breakMin);
      return {
        ...t,
        [t.mode === "focus" ? "focusMin" : "breakMin"]: min,
        durationSec: min * 60,
        remainingSec: min * 60,
        running: false,
        endAt: null,
        finished: false,
      };
    });
  }, []);

  const setMode = useCallback((mode) => {
    setTimer((t) => {
      if (t.running || (mode !== "focus" && mode !== "break")) return t;
      const sec = (mode === "focus" ? t.focusMin : t.breakMin) * 60;
      return {
        ...t,
        mode,
        durationSec: sec,
        remainingSec: sec,
        endAt: null,
        finished: false,
      };
    });
  }, []);

  const setTaskId = useCallback((id) => {
    setTimer((t) => ({ ...t, taskId: id ?? null }));
  }, []);

  return {
    ...timer,
    start,
    pause,
    reset,
    setDurationMin,
    setMode,
    setTaskId,
  };
}
