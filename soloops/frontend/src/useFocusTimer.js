import { useCallback, useEffect, useState } from "react";

const KEY = "soloops-focus-timer";
const BASE_TITLE = "SoloOps";

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
    const base = {
      durationSec: 300,
      remainingSec: 300,
      endAt: null,
      running: false,
      taskId: null,
      finished: false,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved) {
        base.durationSec = saved.durationSec || 300;
        base.taskId = saved.taskId ?? null;
        if (saved.endAt) {
          const rem = Math.ceil((saved.endAt - Date.now()) / 1000);
          if (rem > 0) {
            base.remainingSec = rem;
            base.endAt = saved.endAt;
            base.running = true;
          } else {
            base.remainingSec = 0;
            base.finished = true;
          }
        } else if (saved.remainingSec != null) {
          base.remainingSec = saved.remainingSec;
        }
      }
    } catch {
      /* ignore */
    }
    return base;
  });

  // drift-free tick from endAt; also correct after tab sleep
  useEffect(() => {
    if (!timer.running || !timer.endAt) return undefined;
    const id = setInterval(() => {
      const rem = Math.ceil((timer.endAt - Date.now()) / 1000);
      if (rem <= 0) {
        setTimer((t) => ({
          ...t,
          running: false,
          endAt: null,
          remainingSec: 0,
          finished: true,
        }));
        chime();
        try {
          if (Notification.permission === "granted") {
            new Notification("Focus session complete");
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
      timer.running || (timer.endAt === null && false) ||
      (!timer.finished && timer.remainingSec < timer.durationSec);
    if (active) {
      document.title = `${formatClock(timer.remainingSec)} · Focus · ${BASE_TITLE}`;
    } else {
      document.title = BASE_TITLE;
    }
    return () => {
      document.title = BASE_TITLE;
    };
  }, [timer.running, timer.remainingSec, timer.durationSec, timer.finished, timer.endAt]);

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

  const setDurationMin = useCallback((m) => {
    const sec = Math.min(180, Math.max(1, Math.round(m))) * 60;
    setTimer((t) => ({
      ...t,
      durationSec: sec,
      remainingSec: sec,
      running: false,
      endAt: null,
      finished: false,
    }));
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
    setTaskId,
  };
}
