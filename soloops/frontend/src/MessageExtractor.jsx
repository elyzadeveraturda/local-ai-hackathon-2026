
import { useEffect, useState } from "react";
import { API, apiFetch } from "./api";

function draftFromResult(result) {
  return {
    title: result.action_required || "Follow up on customer request",
    customer: result.customer || "",
    item: result.item || "",
    due_date: result.requested_date || "",
    due_time: result.requested_time || "",
    amount: result.amount ?? "",
  };
}

export default function MessageExtractor() {
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState("");
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
        const response = await fetch(`${API}/businesses`);
        if (!response.ok) throw new Error("Failed to load businesses");

        const data = await response.json();
        setBusinesses(data);

        if (data.length > 0) {
          setBusinessId(String(data[0].id));
        }
      } catch (err) {
        setError(err.message);
      }
    }

    loadBusinesses();
  }, []);

  async function extractMessage() {
    if (!businessId || !message.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);
    setDraft(null);
    setSaveError("");
    setSavedTask(null);

    try {
      const response = await fetch(`${API}/extract/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business_id: Number(businessId),
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Extraction failed"
        );
      }

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

    try {
      const task = await apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          business_id: result.business_id,
          title,
          customer: draft.customer.trim() || null,
          item: draft.item.trim() || null,
          due_date: draft.due_date || null,
          due_time: draft.due_time || null,
          amount: draft.amount === "" ? null : Number(draft.amount),
          notes: message.trim(),
        }),
      });
      setSavedTask(task);
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
      <h1>AI Message Extraction</h1>
      <p>
        Turn customer messages into structured business information
        using your private local AI.
      </p>

      <div className="extractor-card">
        <label htmlFor="business-select">Select Business</label>
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
            <option value="">Create a business first</option>
          )}
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>

        <label htmlFor="customer-message">Customer Message</label>
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
          placeholder="Paste a customer message here..."
        />

        <button
          onClick={extractMessage}
          disabled={loading || !businessId || !message.trim()}
        >
          {loading ? "Extracting with Local AI..." : "Extract Information"}
        </button>

        {error && <p className="extractor-error">{error}</p>}
      </div>

      {result && draft && (
        <div className="extractor-card">
          <h2>Extracted Information</h2>

          <div className="extracted-fields">
            {Object.entries(result)
              .filter(([key]) => key !== "business_id")
              .map(([key, value]) => (
              <div className="extracted-field" key={key}>
                <strong>{key.replaceAll("_", " ")}</strong>
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
              Customer
              <input
                value={draft.customer}
                maxLength={200}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("customer", e.target.value)}
              />
            </label>
            <label>
              Item / service
              <input
                value={draft.item}
                maxLength={200}
                disabled={!!savedTask}
                onChange={(e) => updateDraft("item", e.target.value)}
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
                Process another message
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
