
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import DateRangeFields from "./DateRangeFields";
import { toTaskFields, fromTaskFields } from "./spaces";

const EXAMPLES = [
  "Reminder: Scholarship renewal documents must be submitted on October 15.",
  "I need to finish editing my TikTok video by Friday.",
  "Maria wants to rent the camera on Saturday at 3 PM.",
  "Schedule my dental appointment next Tuesday.",
];

const HIDDEN_KEYS = new Set([
  "business_id",
  "space_id",
  "space_auto",
  "space_reason",
  "requires_confirmation",
]);

const LABELS = {
  record_type: "Record type",
  title: "Title",
  person: "Person",
  subject: "Subject",
  due_date: "Due date",
  due_time: "Time",
  amount: "Amount",
  notes: "Notes",
};

function draftFromResult(result) {
  return {
    title: result.title || "Follow up",
    person: result.person || "",
    subject: result.subject || "",
    range: fromTaskFields(result),
    spaceId: result.business_id,
    amount: result.amount ?? "",
    notes: result.notes || "",
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
          customer: draft.person.trim() || null,
          item: draft.subject.trim() || null,
          ...toTaskFields(draft.range),
          amount: draft.amount === "" ? null : Number(draft.amount),
          notes,
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
            {Object.entries(result)
              .filter(([key]) => !HIDDEN_KEYS.has(key))
              .map(([key, value]) => (
              <div className="extracted-field" key={key}>
                <strong>{LABELS[key] || key.replaceAll("_", " ")}</strong>
                <span>
                  {value === null
                    ? "Not provided"
                    : typeof value === "boolean"
                    ? value ? "Yes" : "No"
                    : typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)}
                </span>
              </div>
            ))}
          </div>

          <h3 className="card-title">Review &amp; save</h3>
          <p className="confirmation-note">
            AI extraction may contain mistakes. Correct anything below
            before saving.
          </p>

          <div className="task-form">
            <label>
              Task title *
              <input
                value={draft.title}
                maxLength={200}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("title", e.target.value)}
              />
            </label>
            <label>
              Person
              <input
                value={draft.person}
                maxLength={200}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("person", e.target.value)}
              />
            </label>
            <label>
              Item / subject
              <input
                value={draft.subject}
                maxLength={200}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("subject", e.target.value)}
              />
            </label>
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
                ✓ Saved as task #{savedTask.id} in{" "}
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
                {saving ? "Saving..." : "Save as Task"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
