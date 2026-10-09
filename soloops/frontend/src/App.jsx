
import { useState, useEffect, useCallback } from "react";
import "./App.css";
import Businesses from "./Businesses";
import MessageExtractor from "./MessageExtractor";
import LockIn from "./LockIn";
import AskSoloOps from "./AskSoloOps";
import Overview from "./Overview";
import SpacePage from "./SpacePage";
import CalendarPage from "./CalendarPage";
import { apiFetch } from "./api";
import { spaceColor } from "./spaces";
import { useFocusTimer } from "./useFocusTimer";
import FloatingTimer from "./FloatingTimer";

const PAGE_NAMES = {
  overview: "Overview",
  space: "Space",
  calendar: "Calendar",
  ask: "Assistant",
  capture: "AI Capture",
  spaces: "Manage spaces",
  focus: "Focus mode",
};

function initialPage() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");
  const spaceId = params.get("space");
  return {
    page: PAGE_NAMES[page] ? page : "overview",
    spaceId: spaceId ? Number(spaceId) : null,
  };
}

function App() {
  const init = initialPage();
  const [page, setPage] = useState(init.page);
  const [prevPage, setPrevPage] = useState("overview");
  const [spaceId, setSpaceId] = useState(init.spaceId);
  const [askPreset, setAskPreset] = useState(null);
  const [captureSpaceId, setCaptureSpaceId] = useState(null);
  const [lockInTaskId, setLockInTaskId] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [attention, setAttention] = useState(null);
  const [aiOnline, setAiOnline] = useState(false);
  const timer = useFocusTimer();

  const refresh = useCallback(() => {
    apiFetch("/businesses").then(setSpaces).catch(() => {});
    apiFetch("/attention").then(setAttention).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [page, refresh]);

  useEffect(() => {
    apiFetch("/health")
      .then((data) => setAiOnline(data.ollama === "connected"))
      .catch(() => setAiOnline(false));
  }, []);

  function navigate(target, opts = {}) {
    if (target === "focus") setPrevPage(page);
    if (target === "ask") {
      setAskPreset(opts.askPreset || null);
      if (opts.spaceId != null) {
        setAskPreset({ question: null, spaceId: opts.spaceId, autoAsk: false });
      }
    }
    if (target === "capture") {
      setCaptureSpaceId(opts.spaceId ?? null);
    }
    if (target === "space") {
      setSpaceId(opts.spaceId ?? spaceId);
    }
    setPage(target);
  }

  function openLockIn(taskId) {
    setPrevPage(page);
    setLockInTaskId(taskId ?? null);
    setPage("focus");
  }

  const pendingBySpace = {};
  (attention?.tasks || []).forEach((t) => {
    pendingBySpace[t.business_id] =
      (pendingBySpace[t.business_id] || 0) + 1;
  });

  const currentSpace = spaces.find((s) => s.id === spaceId);
  const crumbName =
    page === "space" && currentSpace ? currentSpace.name : PAGE_NAMES[page];
  const dateLabel = attention?.today
    ? new Date(`${attention.today}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  function navItem(key, label, opts = {}) {
    return (
      <button
        key={key}
        className={`nav-item${page === key ? " nav-active" : ""}`}
        onClick={() => navigate(key)}
      >
        {opts.dot && (
          <span className="nav-dot" style={{ background: opts.dot }} />
        )}
        <span className="nav-name">{label}</span>
        {opts.count != null && opts.count > 0 && (
          <span className="nav-count">{opts.count}</span>
        )}
      </button>
    );
  }

  const spaceSelect = (
    <>
      {navItem("overview", "Overview")}
      <p className="sidebar-label">Spaces</p>
      {[...spaces]
        .sort((a, b) => a.id - b.id)
        .map((s) => (
          <button
            key={s.id}
            className={`nav-item${
              page === "space" && spaceId === s.id ? " nav-active" : ""
            }`}
            onClick={() => navigate("space", { spaceId: s.id })}
          >
            <span
              className="nav-dot"
              style={{ background: spaceColor(s.id, spaces) }}
            />
            <span className="nav-name">{s.name}</span>
            {pendingBySpace[s.id] > 0 && (
              <span className="nav-count">{pendingBySpace[s.id]}</span>
            )}
          </button>
        ))}
      <p className="sidebar-label">Tools</p>
      {navItem("calendar", "Calendar")}
      {navItem("ask", "Assistant")}
      {navItem("capture", "AI Capture")}
      {navItem("spaces", "Manage spaces")}
    </>
  );

  if (page === "focus") {
    return (
      <div className="focus-page">
        <div className="focus-top">
          <button
            className="exit"
            onClick={() => setPage(prevPage || "overview")}
          >
            ← Exit focus
          </button>
          <span className="focus-label">
            Focus mode · One thing at a time
          </span>
        </div>
        <div className="focus-wrap">
          <LockIn
            key={lockInTaskId ?? "none"}
            initialTaskId={lockInTaskId}
            spaces={spaces}
            onChanged={refresh}
            timer={timer}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-glyph">✦</span>
          SoloOps
        </div>
        <p className="sidebar-label">Personal workspace</p>
        <nav>{spaceSelect}</nav>
        <button className="focus-nav-button" onClick={() => openLockIn(null)}>
          <strong>◷ Focus mode</strong>
          <small>One thing at a time</small>
        </button>
        <div className="sidebar-bottom">
          <span className={`status-dot${aiOnline ? " online" : ""}`} />
          {aiOnline
            ? "Local-first · data stays on this device"
            : "Local AI offline"}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <span className="crumb">My workspace / {crumbName}</span>
          <span className="topbar-date">{dateLabel}</span>
        </div>

        {page === "overview" && (
          <Overview
            spaces={spaces}
            attention={attention}
            onNavigate={navigate}
            onChanged={refresh}
            onLockIn={openLockIn}
          />
        )}
        {page === "space" && (
          <SpacePage
            space={currentSpace}
            spaces={spaces}
            spacesLoaded={spaces.length > 0 || attention !== null}
            attention={attention}
            onNavigate={navigate}
            onChanged={refresh}
            onLockIn={openLockIn}
          />
        )}
        {page === "calendar" && (
          <CalendarPage
            spaces={spaces}
            attention={attention}
            onNavigate={navigate}
            onChanged={refresh}
            onLockIn={openLockIn}
          />
        )}
        {page === "ask" && (
          <AskSoloOps
            key={JSON.stringify(askPreset)}
            spaces={spaces}
            initialSpaceId={askPreset?.spaceId}
            initialQuestion={askPreset?.question}
            autoAsk={askPreset?.autoAsk}
          />
        )}
        {page === "capture" && (
          <MessageExtractor
            key={captureSpaceId ?? "any"}
            initialSpaceId={captureSpaceId}
            onChanged={refresh}
          />
        )}
        {page === "spaces" && (
          <Businesses onCountChange={() => refresh()} />
        )}
      </main>
      <FloatingTimer
        timer={timer}
        tasks={attention?.tasks || []}
        onOpenFocus={() => openLockIn(timer.taskId)}
      />
    </div>
  );
}

export default App;
