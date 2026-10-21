import { useEffect, useState } from "react";
import { API, apiFetch } from "./api";
import DocumentEditor from "./DocumentEditor";
import { useApi, qs } from "./useApi";
import { shortDate } from "./spaces";
import { fileSize } from "./records";

function fileKind(doc) {
  if (!doc.file_name) return "Note";
  const ext = doc.file_name.split(".").pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : "File";
}

export default function DocumentsPage({ spaces, spaceId = null, refreshKey, onChanged, openId }) {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [space, setSpace] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (openId) apiFetch(`/documents/${openId}`).then(setOpen).catch(() => {});
  }, [openId]);

  const list = useApi(`/documents${qs({ business_id: spaceId ?? space, q })}`, [refreshKey]);
  const rows = list.data || [];

  function changed() {
    list.reload();
    onChanged?.();
  }

  const newDoc = () => setOpen({ business_id: spaceId ?? (space ? Number(space) : spaces[0]?.id) });

  return (
    <div className="work-view">
      <div className="work-toolbar">
        <div className="work-search">
          <input type="search" value={query} placeholder="Search titles, notes and file names…" aria-label="Search documents" onChange={(e) => setQuery(e.target.value)} />
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
        <button type="button" className="btn btn-small" onClick={newDoc}>
          + Document
        </button>
      </div>

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
              ? "No documents match."
              : "No documents yet. Keep contracts, receipts, price lists or plain notes here and link them to a booking or customer."}
          </p>
          {!q && !space && (
            <button type="button" className="btn btn-small" onClick={newDoc}>+ New document</button>
          )}
        </div>
      ) : (
        <div className="doc-grid">
          {rows.map((d) => (
            <article key={d.id} className="doc-card">
              <button type="button" className="doc-open" onClick={() => setOpen(d)}>
                <span className={`doc-type${d.file_name ? "" : " note"}`}>{fileKind(d)}</span>
                <strong>{d.title}</strong>
                {d.body && <span className="doc-snippet">{d.body.slice(0, 140)}</span>}
              </button>
              <div className="doc-meta">
                {spaceId == null && <span>{d.business_name}</span>}
                {d.task_title && <span>↳ {d.task_title}</span>}
                {d.contact_name && <span>{d.contact_name}</span>}
                <span>Updated {shortDate(d.updated_at.slice(0, 10))}</span>
              </div>
              {d.file_name && (
                <a className="link-button small" href={`${API}/documents/${d.id}/file`} target="_blank" rel="noreferrer">
                  Open {d.file_name} · {fileSize(d.file_size)}
                </a>
              )}
            </article>
          ))}
        </div>
      )}

      {open && (
        <DocumentEditor
          key={open.id ?? "new"}
          doc={open}
          spaces={spaces}
          onClose={() => setOpen(null)}
          onChanged={changed}
        />
      )}
    </div>
  );
}
