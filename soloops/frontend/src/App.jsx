
import { useState, useEffect } from "react";
import "./App.css";
import Businesses from "./Businesses";
import MessageExtractor from "./MessageExtractor";

const API = "http://127.0.0.1:8000";

function App() {
  const [page, setPage] = useState("dashboard");
  const [businessCount, setBusinessCount] = useState(0);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiOnline, setAiOnline] = useState(false);
  

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

        <div>▤ Calendar</div>
        <div>◷ Lock In Mode</div>
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
            <strong>0</strong>
            <small>Across all businesses</small>
          </div>
          <div className="stat-card">
            <span>Schedule Conflicts</span>
            <strong>0</strong>
            <small>No conflicts detected</small>
          </div>
        </section>

        <section className="ai-panel">
          <h2>✦ Ask SoloOps AI</h2>
          <p>
            Ask your private local assistant for
            help organizing your work.
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
        ) : null}
      </main>
    </div>
  );
}

export default App;
