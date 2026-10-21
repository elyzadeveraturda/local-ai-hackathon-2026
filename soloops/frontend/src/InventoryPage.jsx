import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import Modal from "./Modal";
import TaskEditor from "./TaskEditor";
import { StockBadge, StatusBadge, PaymentBadge } from "./Badges";
import { useApi, qs } from "./useApi";
import { dueText, shortDate } from "./spaces";
import { money } from "./records";

function ItemDialog({ item, spaces, onClose, onChanged, onLockIn }) {
  const isNew = !item.id;
  const [form, setForm] = useState({
    business_id: String(item.business_id || spaces[0]?.id || ""),
    name: item.name || "",
    sku: item.sku || "",
    quantity: item.quantity ?? 1,
    unit: item.unit || "",
    reorder_at: item.reorder_at ?? "",
    price: item.price ?? "",
    notes: item.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [record, setRecord] = useState(null);
  const records = useApi(isNew ? null : `/tasks${qs({ inventory_id: item.id, status: "open" })}`);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    if (busy || !form.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(isNew ? "/inventory" : `/inventory/${item.id}`, {
        method: isNew ? "POST" : "PUT",
        body: JSON.stringify({
          business_id: Number(form.business_id),
          name: form.name.trim(),
          sku: form.sku,
          quantity: Number(form.quantity) || 0,
          unit: form.unit,
          reorder_at: form.reorder_at === "" ? null : Number(form.reorder_at),
          price: form.price === "" ? null : Number(form.price),
          notes: form.notes,
        }),
      });
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${item.name}"? Bookings keep the item name as text. A backup is saved first.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/inventory/${item.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        title={isNew ? "New item" : item.name}
        onClose={onClose}
        busy={busy}
        onSubmit={save}
        footer={
          <>
            <div className="modal-footer-left">
              {!isNew && (
                <button type="button" className="btn btn-secondary btn-small btn-danger-text" onClick={remove} disabled={busy}>
                  Delete
                </button>
              )}
            </div>
            <button type="submit" className="btn" disabled={busy || !form.name.trim()}>
              {busy ? "Saving…" : isNew ? "Add item" : "Save changes"}
            </button>
          </>
        }
      >
        <div className="task-form">
          <label className="span-2">
            Name *
            <input autoFocus={isNew} value={form.name} maxLength={150} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Canon R6, Flour (25 kg)" required />
          </label>
          <label>
            Space
            <select value={form.business_id} onChange={(e) => update("business_id", e.target.value)}>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Code / SKU
            <input value={form.sku} maxLength={60} onChange={(e) => update("sku", e.target.value)} />
          </label>
          <div className="form-pair">
            <label>
              In stock
              <input type="number" min="0" step="1" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} />
            </label>
            <label>
              Unit
              <input value={form.unit} maxLength={30} placeholder="pcs, kg…" onChange={(e) => update("unit", e.target.value)} />
            </label>
          </div>
          <div className="form-pair">
            <label>
              Warn me at
              <input type="number" min="0" step="1" value={form.reorder_at} placeholder="Optional" onChange={(e) => update("reorder_at", e.target.value)} />
            </label>
            <label>
              Price (₱)
              <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} />
            </label>
          </div>
          <label className="span-2">
            Notes
            <textarea rows={2} value={form.notes} maxLength={5000} onChange={(e) => update("notes", e.target.value)} />
          </label>
        </div>
        {!isNew && (
          <div className="linked-docs">
            <div className="linked-head">
              <strong>Upcoming bookings and work</strong>
              <button
                type="button"
                className="link-button"
                onClick={() =>
                  setRecord({
                    business_id: item.business_id,
                    kind: "booking",
                    inventory_id: item.id,
                    amount: item.price ?? undefined,
                    title: `Rent ${item.name}`,
                  })
                }
              >
                + Book this item
              </button>
            </div>
            {records.data?.length === 0 && <p className="muted small">Nothing scheduled with this item.</p>}
            {records.data?.map((r) => (
              <button type="button" key={r.id} className="linked-row" onClick={() => setRecord(r)}>
                <span className="linked-title">{r.title}</span>
                <span className="linked-meta">
                  <StatusBadge status={r.status} />
                  <PaymentBadge record={r} />
                  {r.availability_warning && <span className="pill pay-unpaid">Double-booked</span>}
                  {r.due_date && <small className="muted">{dueText(r)}</small>}
                </span>
              </button>
            ))}
          </div>
        )}
        {error && <p role="alert" className="extractor-error">{error}</p>}
      </Modal>
      {record && (
        <TaskEditor
          key={record.id ?? "new"}
          task={record}
          spaces={spaces}
          onClose={() => setRecord(null)}
          onChanged={() => {
            records.reload();
            onChanged();
          }}
          onLockIn={onLockIn}
        />
      )}
    </>
  );
}

export default function InventoryPage({ spaces, spaceId = null, refreshKey, onChanged, onLockIn, openId }) {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [space, setSpace] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (openId) apiFetch(`/inventory/${openId}`).then(setOpen).catch(() => {});
  }, [openId]);

  const list = useApi(`/inventory${qs({ business_id: spaceId ?? space, q, low: lowOnly || "" })}`, [refreshKey]);
  const rows = list.data || [];

  function changed() {
    list.reload();
    onChanged?.();
  }

  async function adjust(item, delta) {
    setBusyId(item.id);
    setError("");
    try {
      await apiFetch(`/inventory/${item.id}/adjust`, {
        method: "PATCH",
        body: JSON.stringify({ delta }),
      });
      changed();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const stockValue = rows.reduce((s, i) => s + (i.price != null ? i.price * i.quantity : 0), 0);

  return (
    <div className="work-view">
      <div className="work-toolbar">
        <div className="work-search">
          <input type="search" value={query} placeholder="Search items or codes…" aria-label="Search inventory" onChange={(e) => setQuery(e.target.value)} />
        </div>
        {spaceId == null && (
          <select className="toolbar-select" value={space} onChange={(e) => setSpace(e.target.value)} aria-label="Space">
            <option value="">All spaces</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <button type="button" className={`chip${lowOnly ? " chip-active" : ""}`} onClick={() => setLowOnly(!lowOnly)} aria-pressed={lowOnly}>
          Low stock only
        </button>
        <button type="button" className="btn btn-small" onClick={() => setOpen({ business_id: spaceId ?? (space ? Number(space) : undefined) })}>
          + Item
        </button>
      </div>

      {error && <p role="alert" className="extractor-error">{error}</p>}

      {list.error && !list.data ? (
        <div className="empty-state">
          <p>{list.error}</p>
          <button type="button" className="btn btn-secondary btn-small" onClick={list.reload}>Try again</button>
        </div>
      ) : !list.data ? (
        <div className="skeleton-list" aria-busy="true"><div /><div /><div /></div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p>
            {q || space || lowOnly
              ? "No items match."
              : "No items yet. Track stock you sell or things you rent out — SoloOps warns you when stock runs low or an item is double-booked."}
          </p>
          {!q && !space && !lowOnly && (
            <button type="button" className="btn btn-small" onClick={() => setOpen({ business_id: spaceId ?? undefined })}>+ Add item</button>
          )}
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  {spaceId == null && <th>Space</th>}
                  <th>Stock</th>
                  <th className="num">Quantity</th>
                  <th className="num">Price</th>
                  <th>Next booking</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} onClick={() => setOpen(i)}>
                    <td>
                      <button type="button" className="cell-title" onClick={(e) => { e.stopPropagation(); setOpen(i); }}>
                        {i.name}
                      </button>
                      {i.sku && <div className="cell-sub muted small">{i.sku}</div>}
                    </td>
                    {spaceId == null && <td>{i.business_name}</td>}
                    <td><StockBadge item={i} /></td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      <span className="qty">
                        <button type="button" className="qty-btn" aria-label={`One less ${i.name}`} disabled={busyId === i.id || i.quantity <= 0} onClick={() => adjust(i, -1)}>−</button>
                        <span className="qty-num">
                          {i.quantity}
                          {i.unit ? ` ${i.unit}` : ""}
                        </span>
                        <button type="button" className="qty-btn" aria-label={`One more ${i.name}`} disabled={busyId === i.id} onClick={() => adjust(i, 1)}>+</button>
                      </span>
                    </td>
                    <td className="num">{i.price != null ? money(i.price) : "—"}</td>
                    <td>{i.next_booking ? shortDate(i.next_booking) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small work-count">
            {rows.length} item{rows.length === 1 ? "" : "s"}
            {stockValue > 0 && ` · stock value ${money(stockValue)}`}
          </p>
        </>
      )}

      {open && (
        <ItemDialog
          key={open.id ?? "new"}
          item={open}
          spaces={spaces}
          onClose={() => setOpen(null)}
          onChanged={changed}
          onLockIn={onLockIn}
        />
      )}
    </div>
  );
}
