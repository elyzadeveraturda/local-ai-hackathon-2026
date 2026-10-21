import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import TaskEditor from "./TaskEditor";
import { KindBadge, StatusBadge, PaymentBadge } from "./Badges";
import { useApi, qs } from "./useApi";
import { spaceColor, dueText } from "./spaces";
import { KINDS, STATUSES, money, balance } from "./records";

const VIEWS = [
  { value: "list", label: "List" },
  { value: "table", label: "Table" },
  { value: "board", label: "Board" },
];

const SORTS = [
  { value: "due", label: "Due date" },
  { value: "updated", label: "Recently changed", direction: "desc" },
  { value: "created", label: "Newest", direction: "desc" },
  { value: "title", label: "Title" },
  { value: "balance", label: "Amount owed", direction: "desc" },
];

function readView(key, fallback) {
  try {
    return localStorage.getItem(`soloops-view-${key}`) || fallback;
  } catch {
    return fallback;
  }
}

function bucketOf(t) {
  if (t.status === "completed") return "done";
  const d = t.days_until_due;
  if (d == null) return "none";
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 7) return "week";
  return "later";
}

const BUCKETS = [
  ["overdue", "Overdue"],
  ["today", "Today"],
  ["week", "Next 7 days"],
  ["later", "Later"],
  ["none", "No date"],
  ["done", "Done"],
];

// Every record in one place: list / table / board, with search,
// filters and sorting. `spaceId` fixes it to one space; `preset`
// sets starting filters (e.g. the Payments view).
export default function WorkView({
  spaces,
  spaceId = null,
  preset = {},
  viewKey = "work",
  defaultView = "list",
  refreshKey,
  onChanged,
  onLockIn,
  openId,
}) {
  const [view, setView] = useState(() => readView(viewKey, preset.view || defaultView));
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState(preset.kind || "");
  const [status, setStatus] = useState(preset.status || "open");
  const [payment, setPayment] = useState(preset.payment || "");
  const [space, setSpace] = useState("");
  const [sort, setSort] = useState(preset.sort || "due");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    try {
      localStorage.setItem(`soloops-view-${viewKey}`, view);
    } catch {
      /* ignore */
    }
  }, [view, viewKey]);

  // open a record handed in from search
  useEffect(() => {
    if (!openId) return;
    apiFetch(`/tasks/${openId}`).then(setEditing).catch(() => {});
  }, [openId]);

  const sortDef = SORTS.find((s) => s.value === sort) || SORTS[0];
  const path = `/tasks${qs({
    business_id: spaceId ?? space,
    kind,
    // the board shows every status as columns
    status: view === "board" ? "" : status === "all" ? "" : status,
    payment,
    q,
    sort,
    direction: sortDef.direction || "asc",
  })}`;
  const records = useApi(path, [refreshKey]);
  const rows = records.data || [];

  const filtered =
    !!(q || kind || payment || space) || (status !== "open" && view !== "board");

  function clearFilters() {
    setQuery("");
    setQ("");
    setKind(preset.kind || "");
    setPayment(preset.payment || "");
    setSpace("");
    setStatus(preset.status || "open");
  }

  function changed() {
    records.reload();
    onChanged?.();
  }

  async function moveTo(record, nextStatus) {
    if (record.status === nextStatus) return;
    setError("");
    try {
      await apiFetch(`/tasks/${record.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      changed();
    } catch (err) {
      setError(err.message);
    }
  }

  function newRecord(extra = {}) {
    setEditing({
      business_id: spaceId ?? (space ? Number(space) : spaces[0]?.id),
      kind: kind || preset.newKind || "task",
      payment_status: preset.payment ? "unpaid" : undefined,
      ...extra,
    });
  }

  const awaiting = rows.filter((r) => ["unpaid", "partial"].includes(r.payment_status));
  const owed = awaiting.reduce((sum, r) => sum + (balance(r) || 0), 0);

  const spaceName = (id) => spaces.find((s) => s.id === id)?.name || "";

  const meta = (r) => (
    <>
      {!spaceId && (
        <span className="space-name" style={{ color: spaceColor(r.business_id, spaces) }}>
          {r.business_name}
        </span>
      )}
      {r.due_date && <span>{dueText(r)}</span>}
      {r.contact_name && <span>{r.contact_name}</span>}
      {(r.inventory_name || r.item) && <span>{r.inventory_name || r.item}</span>}
      {r.document_count > 0 && (
        <span>
          {r.document_count} doc{r.document_count === 1 ? "" : "s"}
        </span>
      )}
    </>
  );

  const toolbar = (
    <div className="work-toolbar">
      <div className="work-search">
        <input
          type="search"
          value={query}
          placeholder="Search titles, notes, customers, items…"
          aria-label="Search records"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="seg" role="group" aria-label="Layout">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            className={view === v.value ? "seg-active" : ""}
            aria-pressed={view === v.value}
            onClick={() => setView(v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-small" onClick={() => newRecord()}>
        + New
      </button>
    </div>
  );

  const filters = (
    <div className="work-filters">
      <div className="chip-row" role="group" aria-label="Type">
        <button
          type="button"
          className={`chip${!kind ? " chip-active" : ""}`}
          onClick={() => setKind("")}
        >
          All types
        </button>
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            className={`chip${kind === k.value ? " chip-active" : ""}`}
            onClick={() => setKind(kind === k.value ? "" : k.value)}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="filter-selects">
        {view !== "board" && (
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">Not done</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
              <option value="all">Everything</option>
            </select>
          </label>
        )}
        <label>
          Payment
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="">Any</option>
            <option value="open">Awaiting payment</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partly paid</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        {spaceId == null && (
          <label>
            Space
            <select value={space} onChange={(e) => setSpace(e.target.value)}>
              <option value="">All spaces</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );

  let body;
  if (records.error && !records.data) {
    body = (
      <div className="empty-state">
        <p>{records.error}</p>
        <button type="button" className="btn btn-secondary btn-small" onClick={records.reload}>
          Try again
        </button>
      </div>
    );
  } else if (!records.data) {
    body = (
      <div className="skeleton-list" aria-busy="true" aria-label="Loading records">
        <div />
        <div />
        <div />
      </div>
    );
  } else if (rows.length === 0 && view !== "board") {
    body = (
      <div className="empty-state">
        {filtered ? (
          <>
            <p>Nothing matches these filters.</p>
            <button type="button" className="btn btn-secondary btn-small" onClick={clearFilters}>
              Clear filters
            </button>
          </>
        ) : (
          <>
            <p>
              {preset.payment
                ? "No payments to chase. Records with an amount and a payment status show up here."
                : "No records yet. Add tasks, bookings, payments or deadlines and they'll show up here."}
            </p>
            <button type="button" className="btn btn-small" onClick={() => newRecord()}>
              + New record
            </button>
          </>
        )}
      </div>
    );
  } else if (view === "table") {
    body = (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              {spaceId == null && <th>Space</th>}
              <th>Status</th>
              <th>Due</th>
              <th>Customer</th>
              <th>Item</th>
              <th className="num">Amount</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setEditing(r)} className={r.status === "completed" ? "row-done" : ""}>
                <td>
                  <button
                    type="button"
                    className="cell-title"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(r);
                    }}
                  >
                    {r.title}
                  </button>
                  <div className="cell-sub">
                    <KindBadge kind={r.kind} />
                    {r.availability_warning && (
                      <span className="pill pay-unpaid" title={r.availability_warning}>
                        Double-booked
                      </span>
                    )}
                  </div>
                </td>
                {spaceId == null && (
                  <td>
                    <span className="nav-dot" style={{ background: spaceColor(r.business_id, spaces) }} />{" "}
                    {r.business_name}
                  </td>
                )}
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td className={r.days_until_due < 0 && r.status !== "completed" ? "danger" : ""}>
                  {r.due_date ? dueText(r) : "—"}
                </td>
                <td>{r.contact_name || r.customer || "—"}</td>
                <td>{r.inventory_name || r.item || "—"}</td>
                <td className="num">{r.amount != null ? money(r.amount) : "—"}</td>
                <td>
                  <PaymentBadge record={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else if (view === "board") {
    body = (
      <div className="board">
        {STATUSES.map((col) => {
          const cards = rows.filter((r) => r.status === col.value);
          return (
            <section
              key={col.value}
              className={`board-col${dragId ? " drop-ready" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const rec = rows.find((r) => r.id === dragId);
                setDragId(null);
                if (rec) moveTo(rec, col.value);
              }}
              aria-label={col.label}
            >
              <header>
                <StatusBadge status={col.value} />
                <span className="muted small">{cards.length}</span>
              </header>
              {cards.map((r) => (
                <article
                  key={r.id}
                  className="board-card"
                  draggable
                  onDragStart={() => setDragId(r.id)}
                  onDragEnd={() => setDragId(null)}
                >
                  <button type="button" className="cell-title" onClick={() => setEditing(r)}>
                    {r.title}
                  </button>
                  <div className="board-meta">{meta(r)}</div>
                  <div className="cell-sub">
                    <KindBadge kind={r.kind} />
                    <PaymentBadge record={r} />
                    {r.availability_warning && (
                      <span className="pill pay-unpaid" title={r.availability_warning}>
                        Double-booked
                      </span>
                    )}
                  </div>
                  <label className="board-move">
                    <span className="sr-only">Move to</span>
                    <select
                      value={r.status}
                      onChange={(e) => moveTo(r, e.target.value)}
                      aria-label={`Move "${r.title}" to`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
              {cards.length === 0 && <p className="muted small board-empty">Drop records here</p>}
              {col.value !== "completed" && (
                <button
                  type="button"
                  className="link-button board-add"
                  onClick={() => newRecord({ status: col.value })}
                >
                  + Add
                </button>
              )}
            </section>
          );
        })}
      </div>
    );
  } else {
    const groups = BUCKETS.map(([key, label]) => ({
      key,
      label,
      items: rows.filter((r) => bucketOf(r) === key),
    })).filter((g) => g.items.length);
    body = (
      <div className="work-list">
        {groups.map((g) => (
          <div key={g.key} className="attention-group">
            <h3 className={`bucket bucket-${g.key}`}>
              {g.label} <span>{g.items.length}</span>
            </h3>
            {g.items.map((r) => (
              <article key={r.id} className={`task-row${r.status === "completed" ? " completed" : ""}`}>
                <button
                  className={`check-btn${g.key === "overdue" || g.key === "today" ? " urgent" : ""}`}
                  title={r.status === "completed" ? "Reopen" : "Mark done"}
                  aria-label={r.status === "completed" ? `Reopen ${r.title}` : `Mark ${r.title} done`}
                  onClick={() => moveTo(r, r.status === "completed" ? "pending" : "completed")}
                />
                <button type="button" className="task-main task-open" onClick={() => setEditing(r)}>
                  <strong>
                    {r.title}
                    {r.importance === "high" && <span className="imp-badge">High</span>}
                  </strong>
                  <small className="row-meta">{meta(r)}</small>
                </button>
                <div className="row-pills">
                  {r.kind !== "task" && <KindBadge kind={r.kind} />}
                  {r.status === "in_progress" && <StatusBadge status="in_progress" />}
                  <PaymentBadge record={r} />
                  {r.availability_warning && (
                    <span className="pill pay-unpaid" title={r.availability_warning}>
                      Double-booked
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="work-view">
      {toolbar}
      {filters}
      {payment && rows.length > 0 && owed > 0 && (
        <p className="owed-line">
          <strong>{money(owed)}</strong> still to collect across {awaiting.length} record{awaiting.length === 1 ? "" : "s"}
          {space && ` in ${spaceName(Number(space))}`}
        </p>
      )}
      {error && <p role="alert" className="extractor-error">{error}</p>}
      {body}
      {records.data && rows.length > 0 && (
        <p className="muted small work-count">
          {rows.length} record{rows.length === 1 ? "" : "s"}
          {records.loading ? " · updating…" : ""}
        </p>
      )}
      {editing && (
        <TaskEditor
          key={editing.id ?? "new"}
          task={editing}
          spaces={spaces}
          onClose={() => setEditing(null)}
          onChanged={changed}
          onLockIn={onLockIn}
        />
      )}
    </div>
  );
}
