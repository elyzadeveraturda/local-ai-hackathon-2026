
import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

export default function MessageExtractor() {
  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

async function saveAsTask() {
  if (!result) return;

  const title =
    result.action_required || "Follow up on customer request";

  try {
    const response = await fetch(
      "http://127.0.0.1:8000/tasks",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business_id: result.business_id,
          title: title,
          customer: result.customer || null,
          item: result.item || null,
          due_date: result.requested_date || null,
          amount: result.amount ?? null,
          notes: message,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        JSON.stringify(data.detail || data)
      );
    }

    alert("Task saved successfully!");

    setResult(null);
    setMessage("");

  } catch (error) {
    alert("Error saving task: " + error.message);
  }
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
            setResult(null);
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

      {result && (
        <div className="extractor-card">
          <h2>Extracted Information</h2>

          <div className="extracted-fields">
            {Object.entries(result).map(([key, value]) => (
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

          <p className="confirmation-note">
            Review these details before saving them.
            AI extraction may contain mistakes.
          </p>

        <button type="button" onClick={saveAsTask}>
            Save as Task
        </button>
        </div>
      )}
    </section>
  );
}
