
import { useEffect, useState } from "react";
import { apiFetch } from "./api";

const EXAMPLES = [
  "Reminder: Scholarship renewal documents must be submitted on October 15.",
  "I need to finish editing my TikTok video by Friday.",
  "Maria wants to rent the camera on Saturday at 3 PM.",
  "Schedule my dental appointment next Tuesday.",
];

const HIDDEN_KEYS = new Set([
  "business_id",
  "space_id",
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
    due_date: result.due_date || "",
    due_time: result.due_time || "",
    end_time: result.end_time || "",
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

        if (data.length > 0 && !initialSpaceId) {
          setBusinessId(String(data[0].id));
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
      const data = await apiFetch("/extract/message", {
        method: "POST",
        body: JSON.stringify({
          business_id: Number(businessId),
          message: message.trim(),
        }),
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
          business_id: result.business_id,
          title,
          customer: draft.person.trim() || null,
          item: draft.subject.trim() || null,
          due_date: draft.due_date || null,
          due_time: draft.due_time || null,
          end_time: draft.end_time || null,
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
    <section className="extractor-page">
      <h1>AI Capture</h1>
      <p>
        Paste any text or message — school notices, bookings, content
        to-dos, personal reminders. Your local AI turns it into a task
        you review before saving.
      </p>

      <div className="extractor-card">
        <label htmlFor="business-select">Select Space</label>
        <select
          id="business-select"
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
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name} ({business.category || "Business"})
            </option>
          ))}
        </select>

        <label htmlFor="customer-message">Paste Text or Message</label>
        <textarea
          id="customer-message"
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
        <div className="extractor-card">
          <h2>Extracted Information</h2>

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

          <h2>Review &amp; Save as Task</h2>
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
            <label>
              Due date
              <input
                type="date"
                value={draft.due_date}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("due_date", e.target.value)}
              />
            </label>
            <label>
              Time
              <input
                type="time"
                value={draft.due_time}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("due_time", e.target.value)}
              />
            </label>
            <label>
              End time
              <input
                type="time"
                value={draft.end_time}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("end_time", e.target.value)}
              />
            </label>
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
            <button
              type="button"
              onClick={saveAsTask}
              disabled={saving || !draft.title.trim()}
            >
              {saving ? "Saving..." : "Save as Task"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
