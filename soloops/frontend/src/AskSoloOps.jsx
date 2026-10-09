
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";
import RichText from "./RichText";

const SUGGESTIONS = [
  "What should I prioritize today?",
  "Which deadlines are approaching?",
  "What responsibilities do I have across all my spaces?",
  "What scholarship requirements do I need to finish?",
  "Help me plan my study session.",
  "Help me brainstorm TikTok content ideas.",
  "Draft a reply for my most urgent task",
];

export default function AskSoloOps({
  spaces,
  initialSpaceId,
  initialQuestion,
  autoAsk,
}) {
  const [scope, setScope] = useState(initialSpaceId ? "space" : "all");
  const [spaceId, setSpaceId] = useState(
    initialSpaceId ? String(initialSpaceId) : ""
  );
  const [message, setMessage] = useState("");
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const askedRef = useRef(false);

  useEffect(() => {
    if (spaces.length > 0 && !spaceId) {
      setSpaceId(String(initialSpaceId || spaces[0].id));
    }
  }, [spaces, spaceId, initialSpaceId]);

  async function ask(text, scopeOverride, spaceOverride) {
    const q = (text ?? message).trim();
    const useScope = scopeOverride ?? scope;
    const useSpace = spaceOverride ?? spaceId;
    if (!q || loading) return;
    if (useScope === "space" && !useSpace) return;

    setLoading(true);
    setError("");

    try {
      const data = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          message: q,
          space_id: useScope === "space" ? Number(useSpace) : null,
        }),
      });
      setExchanges((prev) => [
        ...prev,
        { question: q, reply: data.reply, sources: data.sources },
      ]);
      setMessage("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoAsk && initialQuestion && !askedRef.current) {
      askedRef.current = true;
      ask(
        initialQuestion,
        initialSpaceId ? "space" : "all",
        initialSpaceId ? String(initialSpaceId) : ""
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAsk, initialQuestion]);

  function onKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      ask();
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Assistant</h1>
        <p className="page-sub">
          Context-aware help grounded only in what you've saved. It
          never changes your tasks or bookings.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="scope-toggle">
          <div className="seg">
            <button
              type="button"
              className={scope === "all" ? "seg-active" : ""}
              onClick={() => setScope("all")}
            >
              All spaces
            </button>
            <button
              type="button"
              className={scope === "space" ? "seg-active" : ""}
              onClick={() => setScope("space")}
            >
              One space
            </button>
          </div>
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
              onClick={() => ask(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <label className="field-label">
          Message
          <textarea
            className="control"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about your tasks, deadlines, or responsibilities..."
          />
        </label>

        <button
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => ask()}
          disabled={
            loading || !message.trim() || (scope === "space" && !spaceId)
          }
        >
          {loading ? "Thinking..." : "Ask local AI"}
        </button>

        {error && <p className="extractor-error">{error}</p>}
      </div>

      {exchanges.length > 0 && (
        <div className="card">
          {exchanges.map((exchange, i) => (
            <div className="conv" key={i}>
              <div className="bubble bubble-user">
                {exchange.question}
              </div>
              <div className="bubble bubble-ai">
                <RichText text={exchange.reply} />
                {exchange.sources && (
                  <small className="muted">
                    Grounded in {exchange.sources.task_count} saved
                    tasks from:{" "}
                    {exchange.sources.spaces.join(", ") || "none"}
                  </small>
                )}
              </div>
            </div>
          ))}
          {loading && <p className="muted">Thinking...</p>}
        </div>
      )}
    </>
  );
}
