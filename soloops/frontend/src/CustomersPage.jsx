import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import Modal from "./Modal";
import TaskEditor from "./TaskEditor";
import DocumentEditor from "./DocumentEditor";
import { KindBadge, StatusBadge, PaymentBadge } from "./Badges";
import { useApi, qs } from "./useApi";
import { dueText, shortDate } from "./spaces";
import { money } from "./records";

function ContactDialog({ contact, spaces, spaceId, onClose, onChanged, onLockIn }) {
  const isNew = !contact.id;
  const [form, setForm] = useState({
    name: contact.name || "",
    phone: contact.phone || "",
    email: contact.email || "",
    business_id: String(contact.business_id ?? spaceId ?? ""),
    notes: contact.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [record, setRecord] = useState(null);
  const [doc, setDoc] = useState(null);
  const records = useApi(isNew ? null : `/tasks${qs({ contact_id: contact.id, sort: "updated", direction: "desc" })}`);
  const docs = useApi(isNew ? null : `/documents${qs({ contact_id: contact.id })}`);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e) {
    e.preventDefault();
    if (busy || !form.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(isNew ? "/contacts" : `/contacts/${contact.id}`, {
        method: isNew ? "POST" : "PUT",
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          business_id: form.business_id ? Number(form.business_id) : null,
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
    if (
      !window.confirm(
        `Delete ${contact.name}? Their bookings and payments stay, with the name kept as text. A backup is saved first.`
      )
    )
      return;
    setBusy(true);
    try {
      await apiFetch(`/contacts/${contact.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const homeSpace = Number(form.business_id) || spaces[0]?.id;

  return (
    <>
      <Modal
        title={isNew ? "New customer" : contact.name}
        onClose={onClose}
        busy={busy}
        wide={!isNew}
        onSubmit={save}
        footer={
          <>
            <div className="modal-footer-left">
              {!isNew && (
                <button
                  type="button"
                  className="btn btn-secondary btn-small btn-danger-text"
                  onClick={remove}
                  disabled={busy}
                >
                  Delete
                </button>
              )}
            </div>
            <button type="submit" className="btn" disabled={busy || !form.name.trim()}>
              {busy ? "Saving…" : isNew ? "Add customer" : "Save changes"}
            </button>
          </>
        }
      >
        {!isNew && (
          <div className="contact-stats">
            <div>
              <small>Still owes</small>
              <strong className={contact.balance_due > 0 ? "danger" : ""}>
                {money(contact.balance_due || 0)}
              </strong>
            </div>
            <div>
              <small>Open records</small>
              <strong>{contact.open_count}</strong>
            </div>
            <div>
              <small>Last activity</small>
              <strong>{contact.last_activity ? shortDate(contact.last_activity) : "—"}</strong>
            </div>
          </div>
        )}
        <div className="task-form">
          <label className="span-2">
            Name *
            <input autoFocus={isNew} value={form.name} maxLength={120} onChange={(e) => update("name", e.target.value)} required />
          </label>
          <label>
            Phone
            <input value={form.phone} maxLength={60} inputMode="tel" onChange={(e) => update("phone", e.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} maxLength={200} onChange={(e) => update("email", e.target.value)} />
          </label>
          <label className="span-2">
            Main space
            <select value={form.business_id} onChange={(e) => update("business_id", e.target.value)}>
              <option value="">None</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Notes
            <textarea rows={3} value={form.notes} maxLength={5000} onChange={(e) => update("notes", e.target.value)} placeholder="Preferences, ID on file, how they found you…" />
          </label>
        </div>

        {!isNew && (
          <>
            <div className="linked-docs">
              <div className="linked-head">
                <strong>Bookings, payments and tasks</strong>
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    setRecord({
                      business_id: homeSpace,
                      kind: "booking",
                      contact_name: contact.name,
                    })
                  }
                >
                  + New booking
                </button>
              </div>
              {records.data?.length === 0 && <p className="muted small">Nothing linked to {contact.name} yet.</p>}
              {records.data?.map((r) => (
                <button type="button" key={r.id} className="linked-row" onClick={() => setRecord(r)}>
                  <span className="linked-title">{r.title}</span>
                  <span className="linked-meta">
                    <KindBadge kind={r.kind} />
                    <StatusBadge status={r.status} />
                    <PaymentBadge record={r} />
                    {r.due_date && <small className="muted">{dueText(r)}</small>}
                  </span>
                </button>
              ))}
            </div>
            <div className="linked-docs">
              <div className="linked-head">
                <strong>Documents</strong>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setDoc({ business_id: homeSpace, contact_id: contact.id })}
                >
                  + Add note or file
                </button>
              </div>
              {docs.data?.length === 0 && <p className="muted small">No documents yet.</p>}
              {docs.data?.map((d) => (
                <button type="button" key={d.id} className="linked-row" onClick={() => setDoc(d)}>
                  <span className="linked-title">{d.title}</span>
                  <small className="muted">{d.business_name}</small>
                </button>
              ))}
            </div>
          </>
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
      {doc && (
        <DocumentEditor
          doc={doc}
          spaces={spaces}
          onClose={() => setDoc(null)}
          onChanged={docs.reload}
        />
      )}
    </>
  );
}

export default function CustomersPage({ spaces, spaceId = null, refreshKey, onChanged, onLockIn, openId }) {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [space, setSpace] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const list = useApi(`/contacts${qs({ business_id: spaceId ?? space, q })}`, [refreshKey]);

  useEffect(() => {
    if (openId) apiFetch(`/contacts/${openId}`).then(setOpen).catch(() => {});
  }, [openId]);

  function changed() {
    list.reload();
    onChanged?.();
  }

  const rows = list.data || [];
  const owedTotal = rows.reduce((s, c) => s + (c.balance_due || 0), 0);

  return (
    <div className="work-view">
      <div className="work-toolbar">
        <div className="work-search">
          <input type="search" value={query} placeholder="Search name, phone, email, notes…" aria-label="Search customers" onChange={(e) => setQuery(e.target.value)} />
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
        <button type="button" className="btn btn-small" onClick={() => setOpen({})}>
          + Customer
        </button>
      </div>

      {owedTotal > 0 && (
        <p className="owed-line">
          <strong>{money(owedTotal)}</strong> owed by customers in this list
        </p>
      )}

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
            {q || space
              ? "No customers match."
              : "No customers yet. Add one here, or type a name on any booking or payment — it's saved here automatically."}
          </p>
          {!q && !space && (
            <button type="button" className="btn btn-small" onClick={() => setOpen({})}>+ Add customer</button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Main space</th>
                <th className="num">Open</th>
                <th className="num">Owes</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => setOpen(c)}>
                  <td>
                    <button type="button" className="cell-title" onClick={(e) => { e.stopPropagation(); setOpen(c); }}>
                      {c.name}
                    </button>
                  </td>
                  <td className="muted">{[c.phone, c.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{c.business_name || "—"}</td>
                  <td className="num">{c.open_count}</td>
                  <td className={`num${c.balance_due > 0 ? " danger" : ""}`}>{c.balance_due > 0 ? money(c.balance_due) : "—"}</td>
                  <td>{c.last_activity ? shortDate(c.last_activity) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <ContactDialog
          key={open.id ?? "new"}
          contact={open}
          spaces={spaces}
          spaceId={spaceId}
          onClose={() => setOpen(null)}
          onChanged={changed}
          onLockIn={onLockIn}
        />
      )}
    </div>
  );
}
