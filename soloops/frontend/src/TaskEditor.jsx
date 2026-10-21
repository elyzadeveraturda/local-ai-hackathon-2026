import { useState } from "react";
import { API, apiFetch } from "./api";
import DateRangeFields from "./DateRangeFields";
import DocumentEditor from "./DocumentEditor";
import Modal from "./Modal";
import { useApi, qs } from "./useApi";
import { toTaskFields, fromTaskFields, IMPORTANCE_OPTIONS } from "./spaces";
import { KINDS, STATUSES, PAYMENT_STATUSES, money, balance, fileSize } from "./records";

function draftFrom(task, spaces) {
  return {
    business_id: String(task.business_id || spaces[0]?.id || ""),
    title: task.title || "",
    kind: task.kind || "task",
    status: task.status || "pending",
    contact_name: task.contact_name || task.customer || "",
    inventory_id: task.inventory_id ? String(task.inventory_id) : "",
    item: task.inventory_id ? "" : task.item || "",
    amount: task.amount ?? "",
    // new bookings and payments start as unpaid; it only counts once
    // there is an amount
    payment_status:
      task.payment_status ||
      (!task.id && ["booking", "payment"].includes(task.kind) ? "unpaid" : ""),
    amount_paid: task.amount_paid ?? "",
    notes: task.notes || "",
    importance: task.importance || "normal",
  };
}

// Create (no task.id) or edit any record: task, event, booking,
// payment or deadline, with its customer, item, payment and documents.
export default function TaskEditor({ task, spaces, onClose, onChanged, onLockIn }) {
  const isNew = !task.id;
  const [form, setForm] = useState(() => draftFrom(task, spaces));
  const [range, setRange] = useState(() => fromTaskFields(task));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(task.availability_warning || "");
  const [savedWithWarning, setSavedWithWarning] = useState(false);
  const [docEditing, setDocEditing] = useState(null);
  const completed = task.status === "completed";

  const contacts = useApi("/contacts");
  const items = useApi(
    form.business_id ? `/inventory${qs({ business_id: form.business_id })}` : null
  );
  const docs = useApi(isNew ? null : `/documents${qs({ task_id: task.id })}`);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const knownContact = (contacts.data || []).some(
    (c) => c.name.trim().toLowerCase() === form.contact_name.trim().toLowerCase()
  );
  const itemList = items.data || [];
  const showMoney =
    form.amount !== "" || form.payment_status || ["booking", "payment"].includes(form.kind);

  async function run(fn, { close = true } = {}) {
    setBusy(true);
    setError("");
    try {
      const res = await fn();
      onChanged?.();
      if (close) onClose();
      else setBusy(false);
      return res;
    } catch (err) {
      setError(err.message);
      setBusy(false);
      return null;
    }
  }

  async function save(e) {
    e.preventDefault();
    if (busy || !form.title.trim() || !form.business_id) return;
    if (range.start && range.end && range.end < range.start) {
      setError("End must be after start.");
      return;
    }
    const payload = {
      business_id: Number(form.business_id),
      title: form.title.trim(),
      kind: form.kind,
      status: form.status,
      contact_name: form.contact_name.trim(),
      inventory_id: form.inventory_id ? Number(form.inventory_id) : null,
      item: form.inventory_id ? null : form.item.trim() || null,
      ...toTaskFields(range),
      amount: form.amount === "" ? null : Number(form.amount),
      // no amount means nothing to track yet
      payment_status: form.amount === "" ? null : form.payment_status || null,
      amount_paid:
        form.payment_status === "partial" && form.amount_paid !== ""
          ? Number(form.amount_paid)
          : null,
      notes: form.notes,
      importance: form.importance,
    };
    const res = await run(
      () =>
        apiFetch(isNew ? "/tasks" : `/tasks/${task.id}`, {
          method: isNew ? "POST" : "PUT",
          body: JSON.stringify(payload),
        }),
      { close: false }
    );
    if (!res) return;
    if (res.availability_warning) {
      // keep the dialog open so the clash is seen, not missed
      setWarning(res.availability_warning);
      setSavedWithWarning(true);
    } else {
      onClose();
    }
  }

  function setStatus(status) {
    run(() =>
      apiFetch(`/tasks/${task.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
    );
  }

  function remove() {
    if (!window.confirm(`Delete "${task.title}"? A backup is saved automatically first.`)) {
      return;
    }
    run(() => apiFetch(`/tasks/${task.id}`, { method: "DELETE" }));
  }

  if (savedWithWarning) {
    return (
      <Modal
        title="Saved — please check"
        onClose={onClose}
        footer={
          <>
            <span />
            <button type="button" className="btn" onClick={onClose}>
              Got it
            </button>
          </>
        }
      >
        <p className="warn-box">{warning}</p>
        <p className="muted">
          The booking is saved. Change the dates or item if it shouldn't overlap.
        </p>
      </Modal>
    );
  }

  const kindLabel = KINDS.find((k) => k.value === form.kind)?.label.toLowerCase() || "record";

  return (
    <>
      <Modal
        title={isNew ? `New ${kindLabel}` : `Edit ${kindLabel}`}
        onClose={onClose}
        busy={busy}
        wide
        onSubmit={save}
        footer={
          <>
            <div className="modal-footer-left">
              {!isNew && (
                <>
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
                    onClick={() => setStatus(completed ? "pending" : "completed")}
                    disabled={busy}
                  >
                    {completed ? "Reopen" : "Mark done"}
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
                </>
              )}
            </div>
            <button type="submit" className="btn" disabled={busy || !form.title.trim()}>
              {busy ? "Saving…" : isNew ? "Create" : "Save changes"}
            </button>
          </>
        }
      >
        {warning && <p className="warn-box">⚠ {warning}</p>}

        <div className="kind-picker" role="radiogroup" aria-label="Type">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={form.kind === k.value}
              className={`pill kind-${k.value}${form.kind === k.value ? " picked" : ""}`}
              onClick={() => {
                update("kind", k.value);
                if (isNew && ["booking", "payment"].includes(k.value) && !form.payment_status) {
                  update("payment_status", "unpaid");
                }
              }}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="task-form">
          <label className="span-2">
            Title *
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
              onChange={(e) => {
                update("business_id", e.target.value);
                update("inventory_id", "");
              }}
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-pair">
            <label>
              Status
              <select value={form.status} onChange={(e) => update("status", e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
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
          </div>
          <div className="span-2">
            <DateRangeFields value={range} onChange={setRange} />
          </div>
          <label>
            Customer
            <input
              list="editor-contacts"
              value={form.contact_name}
              maxLength={120}
              placeholder="Type or pick a name"
              onChange={(e) => update("contact_name", e.target.value)}
            />
            <datalist id="editor-contacts">
              {(contacts.data || []).map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            {form.contact_name.trim() && contacts.data && !knownContact && (
              <small className="field-hint">New customer — will be added to Customers</small>
            )}
          </label>
          {itemList.length > 0 ? (
            <label>
              Item
              <select
                value={form.inventory_id}
                onChange={(e) => update("inventory_id", e.target.value)}
              >
                <option value="">{form.item ? `“${form.item}” (not in inventory)` : "None"}</option>
                {itemList.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                    {i.quantity <= 0 ? " — out of stock" : ` — ${i.quantity} in stock`}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Item / subject
              <input
                value={form.item}
                maxLength={200}
                onChange={(e) => update("item", e.target.value)}
              />
            </label>
          )}

          {showMoney ? (
            <fieldset className="span-2 money-fields">
              <legend>Payment</legend>
              <label>
                Amount (₱)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => update("amount", e.target.value)}
                />
              </label>
              <label>
                Payment status
                <select
                  value={form.payment_status}
                  onChange={(e) => update("payment_status", e.target.value)}
                >
                  <option value="">Not tracked</option>
                  {PAYMENT_STATUSES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.payment_status === "partial" && (
                <label>
                  Paid so far (₱)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount_paid}
                    onChange={(e) => update("amount_paid", e.target.value)}
                    required
                  />
                </label>
              )}
              {form.payment_status === "partial" && form.amount !== "" && form.amount_paid !== "" && (
                <p className="muted small money-left">
                  {money(balance({ amount: Number(form.amount), amount_paid: Number(form.amount_paid) }))} still to collect
                </p>
              )}
            </fieldset>
          ) : (
            <button
              type="button"
              className="link-button span-2 add-money"
              onClick={() => update("payment_status", "unpaid")}
            >
              + Track a payment
            </button>
          )}

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

        {!isNew && (
          <div className="linked-docs">
            <div className="linked-head">
              <strong>Documents</strong>
              <button
                type="button"
                className="link-button"
                onClick={() =>
                  setDocEditing({ business_id: task.business_id, task_id: task.id, contact_id: task.contact_id })
                }
              >
                + Add note or file
              </button>
            </div>
            {docs.loading && !docs.data && <p className="muted small">Loading…</p>}
            {docs.data?.length === 0 && (
              <p className="muted small">Attach contracts, receipts or photos for this record.</p>
            )}
            {docs.data?.map((d) => (
              <div className="doc-row" key={d.id}>
                <button type="button" className="link-button" onClick={() => setDocEditing(d)}>
                  {d.title}
                </button>
                {d.file_name && (
                  <a
                    className="muted small"
                    href={`${API}/documents/${d.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {d.file_name} · {fileSize(d.file_size)}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p role="alert" className="extractor-error">{error}</p>}
      </Modal>

      {docEditing && (
        <DocumentEditor
          doc={docEditing}
          spaces={spaces}
          onClose={() => setDocEditing(null)}
          onChanged={docs.reload}
        />
      )}
    </>
  );
}
