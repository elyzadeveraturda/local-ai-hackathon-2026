import { useState } from "react";
import { apiFetch } from "./api";
import DateRangeFields from "./DateRangeFields";
import { toTaskFields } from "./spaces";

export default function QuickAddTask({ spaces, initialSpaceId, onSaved, onCancel }) {
  const [form, setForm] = useState({
    business_id: initialSpaceId ? String(initialSpaceId) : "",
    title: "",
    notes: "",
  });
  const [range, setRange] = useState({
    allDay: false,
    start: "",
    end: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm({ ...form, [field]: value });
  }

  async function save(e) {
    e.preventDefault();
    if (busy || !form.title.trim() || !form.business_id) return;
    if (range.start && range.end && range.end < range.start) {
      setError("End must be after start.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          business_id: Number(form.business_id),
          title: form.title.trim(),
          ...toTaskFields(range),
          notes: form.notes.trim(),
        }),
      });
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card task-form-card" onSubmit={save} style={{ marginBottom: 22 }}>
      <h3 className="card-title">New task</h3>
      <div className="task-form task-form-qa">
        <label>
          Space *
          <select
            value={form.business_id}
            onChange={(e) => update("business_id", e.target.value)}
            required
          >
            <option value="">Select a space</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Task title *
          <input
            value={form.title}
            maxLength={200}
            onChange={(e) => update("title", e.target.value)}
            required
          />
        </label>
        <div className="span-2">
          <DateRangeFields value={range} onChange={setRange} />
        </div>
        <label className="span-2">
          Notes
          <textarea
            rows={2}
            value={form.notes}
            maxLength={2000}
            onChange={(e) => update("notes", e.target.value)}
          />
        </label>
      </div>
      {error && <p className="extractor-error">{error}</p>}
      <div className="form-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={busy || !form.title.trim() || !form.business_id}>
          {busy ? "Saving..." : "Save task"}
        </button>
      </div>
    </form>
  );
}
