import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import {
  spaceColor,
  categoryIcon,
  formatTime12,
  shortDate,
} from "./spaces";
import Attention from "./Attention";
import Modal from "./Modal";
import WorkView from "./WorkView";
import CustomersPage from "./CustomersPage";
import InventoryPage from "./InventoryPage";
import DocumentsPage from "./DocumentsPage";
import { useApi, qs } from "./useApi";
import { MODULES, money } from "./records";

function CustomizeTabs({ space, onClose, onSaved }) {
  const [picked, setPicked] = useState(() => new Set(space.modules || ["work"]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(value) {
    if (value === "work") return;
    const next = new Set(picked);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setPicked(next);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/businesses/${space.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: space.name,
          business_type: space.business_type,
          category: space.category || "Business",
          description: space.description || "",
          modules: MODULES.map((m) => m.value).filter((m) => picked.has(m)),
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Tabs for ${space.name}`}
      onClose={onClose}
      busy={busy}
      onSubmit={save}
      footer={
        <>
          <span />
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <p className="muted small">
        Pick what this space needs. Hiding a tab never deletes anything.
      </p>
      <div className="module-list">
        {MODULES.map((m) => (
          <label key={m.value} className={`module-option${m.value === "work" ? " locked" : ""}`}>
            <input
              type="checkbox"
              checked={picked.has(m.value)}
              disabled={m.value === "work"}
              onChange={() => toggle(m.value)}
            />
            <span>
              <strong>{m.label}</strong>
              <small>{m.value === "work" ? "Always on" : m.hint}</small>
            </span>
          </label>
        ))}
      </div>
      {error && <p role="alert" className="extractor-error">{error}</p>}
    </Modal>
  );
}

export default function SpacePage({
  space,
  spaces,
  spacesLoaded,
  attention,
  onNavigate,
  onChanged,
  onLockIn,
  tab = "overview",
  onTab,
  refreshKey,
}) {
  const [schedule, setSchedule] = useState([]);
  const [customizing, setCustomizing] = useState(false);
  const summary = useApi(space ? `/summary${qs({ business_id: space.id })}` : null, [refreshKey]);

  const tasks = (attention?.tasks || []).filter(
    (t) => t.business_id === space?.id
  );

  useEffect(() => {
    if (!attention?.today) return;
    apiFetch(`/calendar?start=${attention.today}&days=14`)
      .then((data) => {
        setSchedule(
          data.days.flatMap((d) =>
            d.tasks
              .filter(
                (t) =>
                  t.business_id === space.id &&
                  t.status !== "completed" &&
                  t.due_time
              )
              .map((t) => ({ ...t, date: d.date }))
          )
        );
      })
      .catch(() => {});
  }, [attention, space]);

  if (!spacesLoaded) return <p className="muted">Loading…</p>;
  if (!space) {
    return (
      <div className="empty-state">
        <p>This space doesn't exist any more.</p>
        <button type="button" className="btn btn-small" onClick={() => onNavigate("overview")}>
          Back to overview
        </button>
      </div>
    );
  }

  const modules = space.modules || ["work"];
  const tabs = [{ value: "overview", label: "Overview" }].concat(
    MODULES.filter((m) => modules.includes(m.value))
  );
  const activeTab = tabs.some((t) => t.value === tab) ? tab : "overview";
  const money_ = summary.data?.money;
  const low = summary.data?.low_stock || [];

  const overdue = tasks.filter((t) => (t.days_until_due ?? 1) < 0);
  const dueToday = tasks.filter((t) => t.days_until_due === 0);
  const dated = tasks.filter((t) => t.due_date);
  const next = dated.length ? dated[0] : null;

  return (
    <>
      <div className="page-head">
        <h1>
          {categoryIcon(space.category)} {space.name}
        </h1>
        <p className="page-sub">
          {space.category} · {space.business_type}
          {space.description ? ` — ${space.description}` : ""}
        </p>
      </div>

      <div className="space-tabs" role="tablist" aria-label={`${space.name} sections`}>
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={activeTab === t.value}
            className={`space-tab${activeTab === t.value ? " active" : ""}`}
            onClick={() => onTab?.(t.value)}
          >
            {t.label}
          </button>
        ))}
        <button type="button" className="link-button customize-btn" onClick={() => setCustomizing(true)}>
          Customize tabs
        </button>
      </div>

      {customizing && (
        <CustomizeTabs space={space} onClose={() => setCustomizing(false)} onSaved={onChanged} />
      )}

      {activeTab === "work" && (
        <WorkView key="work" spaces={spaces} spaceId={space.id} viewKey={`space-${space.id}-work`} refreshKey={refreshKey} onChanged={onChanged} onLockIn={onLockIn} />
      )}
      {activeTab === "payments" && (
        <WorkView
          key="payments"
          spaces={spaces}
          spaceId={space.id}
          viewKey={`space-${space.id}-payments`}
          defaultView="table"
          preset={{ payment: "open", status: "all", sort: "balance", newKind: "payment" }}
          refreshKey={refreshKey}
          onChanged={onChanged}
          onLockIn={onLockIn}
        />
      )}
      {activeTab === "customers" && (
        <CustomersPage spaces={spaces} spaceId={space.id} refreshKey={refreshKey} onChanged={onChanged} onLockIn={onLockIn} />
      )}
      {activeTab === "inventory" && (
        <InventoryPage spaces={spaces} spaceId={space.id} refreshKey={refreshKey} onChanged={onChanged} onLockIn={onLockIn} />
      )}
      {activeTab === "documents" && (
        <DocumentsPage spaces={spaces} spaceId={space.id} refreshKey={refreshKey} onChanged={onChanged} />
      )}

      {activeTab === "overview" && (<>
      <div className="space-actions">
        <button
          className="btn"
          onClick={() =>
            onNavigate("capture", { spaceId: space.id })
          }
        >
          + Capture into this space
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => onNavigate("ask", { spaceId: space.id })}
        >
          Ask about this space
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => onNavigate("spaces")}
        >
          Edit details
        </button>
      </div>

      <div className="stats">
        <div className="stat-card">
          <small>Pending</small>
          <strong>{tasks.length}</strong>
        </div>
        <div className="stat-card">
          <small>Overdue / Due today</small>
          <strong className={overdue.length ? "danger" : ""}>
            {overdue.length} / {dueToday.length}
          </strong>
        </div>
        <div className="stat-card">
          <small>Next deadline</small>
          <strong style={{ fontSize: 15 }}>
            {next ? `${next.title} · ${shortDate(next.due_date)}` : "—"}
          </strong>
        </div>
        {modules.includes("payments") && (
          <button type="button" className="stat-card stat-link" onClick={() => onTab?.("payments")}>
            <small>Awaiting payment</small>
            <strong className={money_?.outstanding > 0 ? "danger" : ""}>
              {money_ ? money(money_.outstanding) : "—"}
            </strong>
          </button>
        )}
      </div>

      {low.length > 0 && (
        <button type="button" className="stock-alert" onClick={() => onTab?.("inventory")}>
          ⚠ Running low: {low.map((i) => `${i.name} (${i.quantity} left)`).join(", ")}
        </button>
      )}

      <div className="card" style={{ marginBottom: 22 }}>
        <Attention
          data={attention}
          spaces={spaces}
          spaceId={space.id}
          onLockIn={onLockIn}
          onChanged={onChanged}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Upcoming schedule</h3>
          <small>next 14 days</small>
        </div>
        {schedule.length === 0 && (
          <p className="muted">Nothing scheduled in the next two weeks.</p>
        )}
        {schedule.map((task) => (
          <div className="rhythm-row" key={task.id}>
            <span className="rhythm-time">
              {formatTime12(task.due_time)}
            </span>
            <span
              className="rhythm-bar"
              style={{ background: spaceColor(space.id, spaces) }}
            />
            <div className="rhythm-body">
              <strong>{task.title}</strong>
              <small>
                {shortDate(task.date)}
                {task.end_time && ` · until ${formatTime12(task.end_time)}`}
              </small>
            </div>
          </div>
        ))}
      </div>
      </>)}
    </>
  );
}
