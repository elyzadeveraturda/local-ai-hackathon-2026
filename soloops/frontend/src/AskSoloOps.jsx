
import { useEffect, useState } from "react";
import { apiFetch } from "./api";

const SUGGESTIONS = [
  "What should I prioritize today?",
  "Which deadlines are approaching?",
  "What responsibilities do I have across all my spaces?",
  "What scholarship requirements do I need to finish?",
  "Help me plan my study session.",
  "Help me brainstorm TikTok content ideas.",
];

export default function AskSoloOps() {
  const [spaces, setSpaces] = useState([]);
  const [scope, setScope] = useState("all");
  const [spaceId, setSpaceId] = useState("");
  const [message, setMessage] = useState("");
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/businesses")
      .then((data) => {
        setSpaces(data);
        if (data.length > 0) setSpaceId(String(data[0].id));
      })
      .catch((err) => setError(err.message));
  }, []);

  async function ask() {
    const text = message.trim();
    if (!text || loading) return;
    if (scope === "space" && !spaceId) return;

    setLoading(true);
    setError("");

    try {
      const data = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          space_id: scope === "space" ? Number(spaceId) : null,
        }),
      });
      setExchanges((prev) => [
        ...prev,
        { question: text, reply: data.reply, sources: data.sources },
      ]);
      setMessage("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      ask();
    }
  }

  return (
    <section className="extractor-page">
      <h1>Ask SoloOps</h1>
      <p>
        Your private assistant, grounded only in what you've saved.
        Conversations are not stored.
      </p>

      <div className="extractor-card">
        <div className="scope-toggle">
          <button
            type="button"
            className={scope === "all" ? "chip chip-active" : "chip"}
            onClick={() => setScope("all")}
          >
            All Spaces
          </button>
          <button
            type="button"
            className={scope === "space" ? "chip chip-active" : "chip"}
            onClick={() => setScope("space")}
          >
            Selected Space
          </button>
          {scope === "space" && (
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
            >
              {spaces.length === 0 && (
                <option value="">Create a space first</option>
              )}
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name} ({space.category || "Business"})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="chip-row">
          {SUGGESTIONS.map((suggestion) => (
            <button
              type="button"
              className="chip"
              key={suggestion}
              onClick={() => setMessage(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about your tasks, deadlines, or responsibilities..."
        />

        <button
          onClick={ask}
          disabled={
            loading || !message.trim() || (scope === "space" && !spaceId)
          }
        >
          {loading ? "Thinking..." : "Ask Local AI →"}
        </button>

        {error && <p className="extractor-error">{error}</p>}
      </div>

      {exchanges.map((exchange, i) => (
        <div className="extractor-card" key={i}>
          <p>
            <strong>You:</strong> {exchange.question}
          </p>
          <div className="ai-response">
            <strong>SoloOps</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>{exchange.reply}</p>
            {exchange.sources && (
              <small className="muted">
                Grounded in {exchange.sources.task_count} saved tasks
                from: {exchange.sources.spaces.join(", ") || "none"}
              </small>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
