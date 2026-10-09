export default function DateRangeFields({ value, onChange, disabled }) {
  const inputType = value.allDay ? "date" : "datetime-local";
  const invalid =
    value.start && value.end && value.end < value.start;
  return (
    <div className="drf">
      <label className="drf-toggle">
        <input
          type="checkbox"
          checked={value.allDay}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...value, allDay: e.target.checked })
          }
        />
        <span className="drf-switch" />
        Whole day
      </label>
      <div className="drf-grid">
        <label>
          Start
          <input
            type={inputType}
            value={value.start}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, start: e.target.value })
            }
          />
        </label>
        <label>
          End (optional)
          <input
            type={inputType}
            value={value.end}
            disabled={disabled}
            min={value.start || undefined}
            onChange={(e) =>
              onChange({ ...value, end: e.target.value })
            }
          />
        </label>
      </div>
      {invalid && (
        <p className="drf-error">End must be after start.</p>
      )}
    </div>
  );
}
