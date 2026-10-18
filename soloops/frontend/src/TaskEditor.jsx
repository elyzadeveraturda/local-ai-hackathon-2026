import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import DateRangeFields from "./DateRangeFields";
import { toTaskFields, fromTaskFields, IMPORTANCE_OPTIONS } from "./spaces";

function draftFrom(task) {
  return {
    business_id: String(task.business_id),
    title: task.title || "",
    customer: task.customer || "",
    item: task.item || "",
    amount: task.amount ?? "",
    notes: task.notes || "",
    importance: task.importance || "normal",
  };
}

export default function TaskEditor({ task, spaces, onClose, onChanged, onLockIn }) {
  const [form, setForm] = useState(() => draftFrom(task));
  const [range, setRange] = useState(() => fromTaskFields(task));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const completed = task.status === "completed";

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function save(e) {
    e.preventDefault();
    if (busy || !form.title.trim()) return;
    if (range.start && range.end && range.end < range.start) {
      setError("End must be after start.");
      return;
    }
    run(() =>
      apiFetch(`/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({
          business_id: Number(form.business_id),
          title: form.title.trim(),
          customer: form.customer.trim() || null,
          item: form.item.trim() || null,
          ...toTaskFields(range),
          amount: form.amount === "" ? null : Number(form.amount),
          notes: form.notes,
          importance: form.importance,
        }),
      })
    );
  }

  function toggleStatus() {
    run(() =>
      apiFetch(`/tasks/${task.id}/${completed ? "reopen" : "complete"}`, {
        method: "PATCH",
      })
    );
  }

  function remove() {
    if (
      !window.confirm(
        `Delete "${task.title}"? A backup is saved automatically first.`
      )
    ) {
      return;
    }
    run(() => apiFetch(`/tasks/${task.id}`, { method: "DELETE" }));
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        className="card modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
        onSubmit={save}
      >
        <div className="card-head">
          <h3 id="task-editor-title">Edit task</h3>
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </div>

        <div className="task-form">
          <label className="span-2">
            Task title *
            <input
              autoFocus
              value={form.title}
              maxLength={200}
              onChange={(e) => update("title", e.target.value)}
              required
            />
          </label>
          <label>
            Space
            <select
              value={form.business_id}
              onChange={(e) => update("business_id", e.target.value)}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Importance
            <select
              value={form.importance}
              onChange={(e) => update("importance", e.target.value)}
            >
              {IMPORTANCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="span-2">
            <DateRangeFields value={range} onChange={setRange} />
          </div>
          <label>
            Person
            <input
              value={form.customer}
              maxLength={200}
              onChange={(e) => update("customer", e.target.value)}
            />
          </label>
          <label>
            Item / subject
            <input
              value={form.item}
              maxLength={200}
              onChange={(e) => update("item", e.target.value)}
            />
          </label>
          <label>
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => update("amount", e.target.value)}
            />
          </label>
          <label className="span-2">
            Notes
            <textarea
              rows={3}
              value={form.notes}
              maxLength={5000}
              onChange={(e) => update("notes", e.target.value)}
            />
          </label>
        </div>

        {error && <p role="alert" className="extractor-error">{error}</p>}

        <div className="modal-footer">
          <div className="modal-footer-left">
            <button
              type="button"
              className="btn btn-secondary btn-small btn-danger-text"
              onClick={remove}
              disabled={busy}
            >
              Delete
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={toggleStatus}
              disabled={busy}
            >
              {completed ? "Reopen" : "Mark complete"}
            </button>
            {!completed && onLockIn && (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => {
                  onClose();
                  onLockIn(task.id);
                }}
                disabled={busy}
              >
                Lock In
              </button>
            )}
          </div>
          <button
            type="submit"
            className="btn"
            disabled={busy || !form.title.trim()}
          >
            {busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
