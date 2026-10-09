
import { useState, useEffect, useCallback } from "react";
import "./App.css";
import Businesses from "./Businesses";
import MessageExtractor from "./MessageExtractor";
import Attention from "./Attention";
import LockIn from "./LockIn";
import { API } from "./api";

function App() {
  const [page, setPage] = useState("dashboard");
  const [businessCount, setBusinessCount] = useState(0);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiOnline, setAiOnline] = useState(false);
  const [counts, setCounts] = useState(null);
  const [lockInTaskId, setLockInTaskId] = useState(null);

  const handleAttention = useCallback((data) => setCounts(data.counts), []);

  function openLockIn(taskId) {
    setLockInTaskId(taskId ?? null);
    setPage("lockin");
  }

  useEffect(() => {
    if (page !== "dashboard") return;
    fetch(`${API}/businesses`)
      .then((res) => res.json())
      .then((data) => setBusinessCount(data.length))
      .catch(() => {});
  }, [page]);

  useEffect(() => {
    fetch(`${API}/health`)
      .then((res) => res.json())
      .then((data) => setAiOnline(data.ollama === "connected"))
      .catch(() => setAiOnline(false));
  }, []);

  async function askAI() {
    if (!message.trim() || loading) return;

    setLoading(true);
    setReply("");

    try {
      const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "AI request failed");
      }

      setReply(data.reply);
    } catch (error) {
      setReply(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>✦ SoloOps</h2>
        <p className="sidebar-label">WORKSPACE</p>
        
      <nav>
        <button
          className={page === "dashboard" ? "nav-active" : ""}
          onClick={() => setPage("dashboard")}
        >
          ▦ Dashboard
        </button>

        <button
          className={page === "businesses" ? "nav-active" : ""}
          onClick={() => setPage("businesses")}
        >
          ▣ My Businesses
        </button>

        <button
          className={page === "extract" ? "nav-active" : ""}
          onClick={() => setPage("extract")}
        >
          ✦ AI Extraction
        </button>

        <button
          className={page === "lockin" ? "nav-active" : ""}
          onClick={() => openLockIn(null)}
        >
          ◷ Lock In Mode
        </button>
      </nav>

        <div className="sidebar-bottom">
          Private Business Command Center
        </div>
      </aside>

      <main className="main">
          {page === "dashboard" ? (
          <>
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Manage all your businesses in one place.</p>
          </div>
          <span className="status">
            {aiOnline ? "● Local AI Connected" : "○ AI Unavailable"}
          </span>
        </header>

        <section className="welcome">
          <h2>Welcome to SoloOps</h2>
          <p>
            Your private AI-powered workspace for
            managing multiple businesses.
          </p>
        </section>

        <section className="stats">
          <div className="stat-card">
  <span>My Businesses</span>
  <strong>{businessCount}</strong>
  <small>Custom workspaces</small>
</div>
          <div className="stat-card">
            <span>Pending Tasks</span>
            <strong>{counts ? counts.pending : "–"}</strong>
            <small>Across all businesses</small>
          </div>
          <div className="stat-card">
            <span>Overdue</span>
            <strong className={counts?.overdue ? "danger" : ""}>
              {counts ? counts.overdue : "–"}
            </strong>
            <small>Past their due date</small>
          </div>
          <div className="stat-card">
            <span>Due Today / Next 3 Days</span>
            <strong>
              {counts ? `${counts.due_today} / ${counts.upcoming}` : "–"}
            </strong>
            <small>Upcoming deadlines</small>
          </div>
        </section>

        <Attention onLockIn={openLockIn} onData={handleAttention} />

        <section className="ai-panel">
          <h2>✦ Ask SoloOps AI</h2>
          <p>
            Ask about your saved tasks and deadlines. Answers are
            grounded in your local SoloOps records.
          </p>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What should I focus on today?"
            rows={4}
          />

          <button onClick={askAI} disabled={loading}>
            {loading ? "Thinking..." : "Ask Local AI →"}
          </button>

          {reply && (
            <div className="ai-response">
              <strong>SoloOps AI</strong>
              <p>{reply}</p>
            </div>
          )}
        </section>
         </>
          ) : page === "businesses" ? (
          <Businesses onCountChange={setBusinessCount} />
        ) : page === "extract" ? (
          <MessageExtractor />
        ) : page === "lockin" ? (
          <LockIn key={lockInTaskId ?? "none"} initialTaskId={lockInTaskId} />
        ) : null}
      </main>
    </div>
  );
}

export default App;
