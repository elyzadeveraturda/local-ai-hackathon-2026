
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import DateRangeFields from "./DateRangeFields";
import { toTaskFields, fromTaskFields, IMPORTANCE_OPTIONS, formatTime12, shortDate } from "./spaces";
import { KINDS, KIND_LABEL, PAYMENT_STATUSES, money } from "./records";
import { useApi, qs } from "./useApi";

const EXAMPLES = [
  "Maria wants to rent the camera on Saturday at 3 PM, ₱1,500.",
  "Unit C rent of 1100 is still unpaid, due on the 15th.",
  "Reminder: Scholarship renewal documents must be submitted on October 15.",
  "I need to finish editing my TikTok video by Friday.",
];

// what the AI found, in plain words (internal fields stay hidden)
const SHOWN = [
  ["kind", "Type", (r) => KIND_LABEL[r.kind]],
  ["title", "Title"],
  ["person", "Person"],
  ["subject", "Item / subject"],
  ["due_date", "Date", (r) => r.due_date && shortDate(r.due_date)],
  ["due_time", "Time", (r) => r.due_time && formatTime12(r.due_time)],
  ["end_time", "Until", (r) => r.end_time && formatTime12(r.end_time)],
  ["amount", "Amount", (r) => r.amount != null && money(r.amount)],
  ["notes", "Notes"],
];

function draftFromResult(result) {
  return {
    // never invent a title — leave it empty so the user must write one
    title: result.title || "",
    person: result.person || "",
    subject: result.subject || "",
    range: fromTaskFields(result),
    spaceId: result.business_id,
    amount: result.amount ?? "",
    notes: result.notes || "",
    importance: "normal",
    kind: result.kind || "task",
    inventoryId: result.inventory_id ? String(result.inventory_id) : "",
    paymentStatus: result.payment_status || "",
  };
}

export default function MessageExtractor({ initialSpaceId, onChanged }) {
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState(
    initialSpaceId ? String(initialSpaceId) : ""
  );
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedTask, setSavedTask] = useState(null);
  const inventory = useApi(
    draft?.spaceId ? `/inventory${qs({ business_id: draft.spaceId })}` : null
  );
  const itemOptions = inventory.data || [];

  useEffect(() => {
    async function loadBusinesses() {
      try {
        const data = await apiFetch("/businesses");
        setBusinesses(data);

        if (!initialSpaceId) {
          if (data.length >= 2) {
            setBusinessId("auto");
          } else if (data.length === 1) {
            setBusinessId(String(data[0].id));
          }
        }
      } catch (err) {
        setError(err.message);
      }
    }

    loadBusinesses();
  }, [initialSpaceId]);

  async function extractMessage() {
    if (!businessId || !message.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);
    setDraft(null);
    setSaveError("");
    setSavedTask(null);

    try {
      const body = { message: message.trim() };
      if (businessId !== "auto") {
        body.business_id = Number(businessId);
      }
      const data = await apiFetch("/extract/message", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setResult(data);
      setDraft(draftFromResult(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAsTask() {
    if (!result || !draft || saving || savedTask) return;

    const title = draft.title.trim();
    if (!title) {
      setSaveError("Task title is required.");
      return;
    }
    if (draft.amount !== "" && !(Number(draft.amount) >= 0)) {
      setSaveError("Amount must be a positive number.");
      return;
    }

    setSaving(true);
    setSaveError("");

    if (
      draft.range.start &&
      draft.range.end &&
      draft.range.end < draft.range.start
    ) {
      setSaveError("End must be after start.");
      return;
    }

    const notes = [
      draft.notes.trim(),
      `Original text: ${message.trim()}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const task = await apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          business_id: draft.spaceId || result.business_id,
          title,
          contact_name: draft.person.trim(),
          inventory_id: draft.inventoryId ? Number(draft.inventoryId) : null,
          item: draft.inventoryId ? null : draft.subject.trim() || null,
          ...toTaskFields(draft.range),
          amount: draft.amount === "" ? null : Number(draft.amount),
          payment_status:
            draft.amount !== "" && draft.paymentStatus ? draft.paymentStatus : null,
          kind: draft.kind,
          notes,
          importance: draft.importance,
        }),
      });
      setSavedTask(task);
      onChanged?.();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startOver() {
    setResult(null);
    setDraft(null);
    setSavedTask(null);
    setSaveError("");
    setMessage("");
  }

  function updateDraft(field, value) {
    setDraft({ ...draft, [field]: value });
  }

  return (
    <>
      <div className="page-head">
        <h1>AI Capture</h1>
        <p className="page-sub">
          Paste any text or message — school notices, bookings,
          content to-dos, personal reminders. Your local AI turns it
          into a task you review before saving.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>Paste text or message</h3>
        </div>
        <label className="field-label" htmlFor="business-select">
          Space
        </label>
        <select
          id="business-select"
          className="control"
          value={businessId}
          onChange={(e) => {
            setBusinessId(e.target.value);
            setResult(null);
            setDraft(null);
            setSavedTask(null);
          }}
        >
          {businesses.length === 0 && (
            <option value="">Create a space first</option>
          )}
          {businesses.length >= 2 && (
            <option value="auto">✦ Auto-detect space (AI)</option>
          )}
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name} ({business.category || "Business"})
            </option>
          ))}
        </select>

        <label
          className="field-label"
          htmlFor="customer-message"
          style={{ marginTop: 14 }}
        >
          Text or message
        </label>
        <textarea
          id="customer-message"
          className="control"
          rows={6}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (!savedTask) {
              setResult(null);
              setDraft(null);
            }
          }}
          placeholder="e.g. Maria wants to rent the camera on Saturday at 3 PM."
        />

        <div className="chip-row">
          {EXAMPLES.map((example) => (
            <button
              type="button"
              className="chip"
              key={example}
              onClick={() => {
                setMessage(example);
                if (!savedTask) {
                  setResult(null);
                  setDraft(null);
                }
              }}
            >
              {example}
            </button>
          ))}
        </div>

        <button
          className="btn"
          onClick={extractMessage}
          disabled={loading || !businessId || !message.trim()}
        >
          {loading
            ? "Analyzing with Local AI..."
            : "Analyze with Local AI"}
        </button>

        {error && <p className="extractor-error">{error}</p>}
      </div>

      {result && draft && (
        <div className="card">
          <h3 className="card-title">Extracted information</h3>

          {result.space_auto && (
            <div className="auto-space-note">
              <span>
                {result.space_source === "keyword"
                  ? "Matched by keywords: "
                  : "✦ AI suggested space: "}
                {" "}
                <strong>
                  {
                    businesses.find((b) => b.id === result.business_id)
                      ?.name
                  }
                </strong>
                {result.space_reason
                  ? ` — ${result.space_reason}`
                  : ""}
              </span>
              <select
                value={draft.spaceId}
                disabled={!!savedTask}
                onChange={(e) =>
                  updateDraft("spaceId", Number(e.target.value))
                }
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="extracted-fields">
            {SHOWN.map(([key, label, fmt]) => {
              const value = fmt ? fmt(result) : result[key];
              return (
                <div className="extracted-field" key={key}>
                  <strong>{label}</strong>
                  <span className={value ? "" : "muted"}>{value || "Not found"}</span>
                </div>
              );
            })}
          </div>

          <h3 className="card-title">Review &amp; save</h3>
          <p className="confirmation-note">
            AI extraction may contain mistakes. Correct anything below
            before saving.
          </p>
          {result.needs_review?.length > 0 && (
            <ul className="review-flags">
              {result.needs_review.map((f, i) => (
                <li key={i} className={`review-flag ${f.level}`}>
                  {f.level === "info" ? "ⓘ" : "⚠"} {f.message}
                </li>
              ))}
            </ul>
          )}

          <div className="kind-picker" role="radiogroup" aria-label="Type">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={draft.kind === k.value}
                disabled={!!savedTask}
                className={`pill kind-${k.value}${draft.kind === k.value ? " picked" : ""}`}
                onClick={() => updateDraft("kind", k.value)}
              >
                {k.label}
              </button>
            ))}
          </div>

          <div className="task-form">
            <label>
              Title *
              <input
                value={draft.title}
                maxLength={200}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("title", e.target.value)}
              />
            </label>
            <label>
              Customer
              <input
                value={draft.person}
                maxLength={120}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("person", e.target.value)}
              />
              {draft.person.trim() && result.contact_is_new && draft.person.trim() === (result.person || "").trim() && (
                <small className="field-hint">New customer — will be added to Customers</small>
              )}
              {draft.person.trim() && result.contact_id && draft.person.trim() === (result.person || "").trim() && (
                <small className="muted">Matched an existing customer</small>
              )}
            </label>
            {itemOptions.length > 0 ? (
              <label>
                Item
                <select
                  value={draft.inventoryId}
                  disabled={!!savedTask}
                  onChange={(e) => updateDraft("inventoryId", e.target.value)}
                >
                  <option value="">
                    {draft.subject ? `“${draft.subject}” (not in inventory)` : "None"}
                  </option>
                  {itemOptions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Item / subject
                <input
                  value={draft.subject}
                  maxLength={200}
                  disabled={!!savedTask}
                  onChange={(e) => updateDraft("subject", e.target.value)}
                />
              </label>
            )}
            <div className="span-2">
              <DateRangeFields
                value={draft.range}
                disabled={!!savedTask}
                onChange={(v) => updateDraft("range", v)}
              />
            </div>
            <label>
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.amount}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("amount", e.target.value)}
              />
            </label>
            <label>
              Payment
              <select
                value={draft.paymentStatus}
                disabled={!!savedTask || draft.amount === ""}
                onChange={(e) => updateDraft("paymentStatus", e.target.value)}
              >
                <option value="">Not tracked</option>
                {PAYMENT_STATUSES.filter((p) => p.value !== "partial").map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Importance
              <select
                value={draft.importance}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("importance", e.target.value)}
              >
                {IMPORTANCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notes
              <textarea
                rows={3}
                value={draft.notes}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("notes", e.target.value)}
              />
            </label>
          </div>

          {saveError && (
            <p role="alert" className="extractor-error">{saveError}</p>
          )}

          {savedTask ? (
            <div className="save-success">
              <p>
                ✓ Saved “{savedTask.title}” to{" "}
                <strong>{savedTask.business_name}</strong>.
              </p>
              <button type="button" onClick={startOver}>
                Capture another
              </button>
            </div>
          ) : (
            <div className="form-footer">
              <button
                type="button"
                className="btn"
                onClick={saveAsTask}
                disabled={saving || !draft.title.trim()}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
