import { useState } from "react";
import { PRESETS } from "./useFocusTimer";

// shared by Focus mode and the floating timer

export function ModeSwitch({ timer }) {
  return (
    <div className="seg timer-mode" role="group" aria-label="Timer mode">
      {["focus", "break"].map((m) => (
        <button
          key={m}
          type="button"
          className={timer.mode === m ? "seg-active" : ""}
          aria-pressed={timer.mode === m}
          disabled={timer.running}
          onClick={() => timer.setMode(m)}
        >
          {m === "focus" ? `Focus ${timer.focusMin}m` : `Break ${timer.breakMin}m`}
        </button>
      ))}
    </div>
  );
}

export function PresetRow({ timer, style }) {
  const [customMin, setCustomMin] = useState("");

  function applyCustom() {
    const m = Number(customMin);
    if (m >= 1) timer.setDurationMin(m);
    setCustomMin("");
  }

  return (
    <div className="chip-row" style={style}>
      {PRESETS[timer.mode].map((m) => (
        <button
          key={m}
          type="button"
          className={timer.durationSec === m * 60 ? "chip chip-active" : "chip"}
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
        aria-label={`Custom ${timer.mode} minutes`}
        value={customMin}
        disabled={timer.running}
        onChange={(e) => setCustomMin(e.target.value)}
        onBlur={applyCustom}
        onKeyDown={(e) => {
          if (e.key === "Enter") applyCustom();
        }}
      />
    </div>
  );
}
