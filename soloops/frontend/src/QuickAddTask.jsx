import { useState } from "react";
import { apiFetch } from "./api";

export default function QuickAddTask({ spaces, initialSpaceId, onSaved, onCancel }) {
  const [form, setForm] = useState({
    business_id: initialSpaceId ? String(initialSpaceId) : "",
    title: "",
    due_date: "",
    due_time: "",
    end_time: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm({ ...form, [field]: value });
  }

  async function save(e) {
    e.preventDefault();
    if (busy || !form.title.trim() || !form.business_id) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          business_id: Number(form.business_id),
          title: form.title.trim(),
          due_date: form.due_date || null,
          due_time: form.due_time || null,
          end_time: form.end_time || null,
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
    <form className="card" onSubmit={save} style={{ marginBottom: 22 }}>
      <h3 className="card-title">New task</h3>
      <div className="task-form">
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
        <label>
          Date
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => update("due_date", e.target.value)}
          />
        </label>
        <label>
          Start time
          <input
            type="time"
            value={form.due_time}
            onChange={(e) => update("due_time", e.target.value)}
          />
        </label>
        <label>
          End time
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => update("end_time", e.target.value)}
          />
        </label>
        <label>
          Notes
          <input
            value={form.notes}
            maxLength={2000}
            onChange={(e) => update("notes", e.target.value)}
          />
        </label>
      </div>
      {error && <p className="extractor-error">{error}</p>}
      <div className="business-actions">
        <button type="submit" className="btn" disabled={busy || !form.title.trim() || !form.business_id}>
          {busy ? "Saving..." : "Save task"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
