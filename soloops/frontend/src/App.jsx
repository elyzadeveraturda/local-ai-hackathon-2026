
import { useState, useEffect, useCallback } from "react";
import "./App.css";
import Businesses from "./Businesses";
import MessageExtractor from "./MessageExtractor";
import Attention from "./Attention";
import LockIn from "./LockIn";
import AskSoloOps from "./AskSoloOps";
import { API } from "./api";

function App() {
  const [page, setPage] = useState("dashboard");
  const [businessCount, setBusinessCount] = useState(0);
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

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>✦ SoloOps</h2>
        <p className="sidebar-label">PERSONAL AI</p>
        
      <nav>
        <button
          className={page === "dashboard" ? "nav-active" : ""}
          onClick={() => setPage("dashboard")}
        >
          ▦ Dashboard
        </button>

        <button
          className={page === "spaces" ? "nav-active" : ""}
          onClick={() => setPage("spaces")}
        >
          ▣ My Spaces
        </button>

        <button
          className={page === "extract" ? "nav-active" : ""}
          onClick={() => setPage("extract")}
        >
          ✦ AI Capture
        </button>

        <button
          className={page === "ask" ? "nav-active" : ""}
          onClick={() => setPage("ask")}
        >
          ◎ Ask SoloOps
        </button>

        <button
          className={page === "lockin" ? "nav-active" : ""}
          onClick={() => openLockIn(null)}
        >
          ◷ Lock In Mode
        </button>
      </nav>

        <div className="sidebar-bottom">
          One person. Multiple roles. One private AI assistant.
        </div>
      </aside>

      <main className="main">
          {page === "dashboard" ? (
          <>
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Everything you're responsible for, across every space.</p>
          </div>
          <span className="status">
            {aiOnline ? "● Local AI Connected" : "○ AI Unavailable"}
          </span>
        </header>

        <section className="welcome">
          <h2>Welcome to SoloOps</h2>
          <p>
            Your private, local AI assistant for school, business,
            content and life.
          </p>
        </section>

        <section className="stats">
          <div className="stat-card">
  <span>My Spaces</span>
  <strong>{businessCount}</strong>
  <small>Your contexts</small>
</div>
          <div className="stat-card">
            <span>Pending Tasks</span>
            <strong>{counts ? counts.pending : "–"}</strong>
            <small>Across all spaces</small>
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

        <section className="ai-panel">
          <button onClick={() => setPage("ask")}>
            ◎ Ask SoloOps what to prioritize →
          </button>
        </section>

        <Attention onLockIn={openLockIn} onData={handleAttention} />
         </>
          ) : page === "spaces" ? (
          <Businesses onCountChange={setBusinessCount} />
        ) : page === "extract" ? (
          <MessageExtractor />
        ) : page === "ask" ? (
          <AskSoloOps />
        ) : page === "lockin" ? (
          <LockIn key={lockInTaskId ?? "none"} initialTaskId={lockInTaskId} />
        ) : null}
      </main>
    </div>
  );
}

export default App;
