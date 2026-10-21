import { useState } from "react";
import { API, apiFetch } from "./api";
import Modal from "./Modal";
import { useApi, qs } from "./useApi";
import { fileSize, readFileBase64, MAX_FILE_MB } from "./records";

// Create or edit a document: a note plus an optional file, linked to a
// space and optionally to one record and/or customer.
export default function DocumentEditor({ doc, spaces, onClose, onChanged }) {
  const isNew = !doc.id;
  const [form, setForm] = useState({
    business_id: String(doc.business_id || spaces[0]?.id || ""),
    title: doc.title || "",
    body: doc.body || "",
    task_id: doc.task_id ? String(doc.task_id) : "",
    contact_id: doc.contact_id ? String(doc.contact_id) : "",
  });
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const records = useApi(
    form.business_id ? `/tasks${qs({ business_id: form.business_id, sort: "updated", direction: "desc" })}` : null
  );
  const contacts = useApi("/contacts");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function pickFile(e) {
    const f = e.target.files?.[0] || null;
    setError("");
    if (f && f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Files can be up to ${MAX_FILE_MB} MB.`);
      e.target.value = "";
      return;
    }
    setFile(f);
    if (f && !form.title.trim()) update("title", f.name.replace(/\.[^.]+$/, ""));
    setRemoveFile(false);
  }

  async function save(e) {
    e.preventDefault();
    if (busy || !form.title.trim() || !form.business_id) return;
    setBusy(true);
    setError("");
    try {
      const body = {
        business_id: Number(form.business_id),
        title: form.title.trim(),
        body: form.body,
        task_id: form.task_id ? Number(form.task_id) : null,
        contact_id: form.contact_id ? Number(form.contact_id) : null,
        remove_file: removeFile,
      };
      if (file) {
        body.file_name = file.name;
        body.file_content = await readFileBase64(file);
      }
      await apiFetch(isNew ? "/documents" : `/documents/${doc.id}`, {
        method: isNew ? "POST" : "PUT",
        body: JSON.stringify(body),
      });
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${doc.title}"? A backup is saved first.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/documents/${doc.id}`, { method: "DELETE" });
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  // records only from this space; keep the current link visible
  const recordOptions = records.data || [];
  const spaceChanged = String(doc.business_id || "") !== form.business_id;

  return (
    <Modal
      title={isNew ? "New document" : "Document"}
      onClose={onClose}
      busy={busy}
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
          <button type="submit" className="btn" disabled={busy || !form.title.trim()}>
            {busy ? "Saving…" : isNew ? "Save document" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="task-form">
        <label className="span-2">
          Title *
          <input
            autoFocus
            value={form.title}
            maxLength={200}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Rental agreement — Maria"
            required
          />
        </label>
        <label>
          Space
          <select
            value={form.business_id}
            onChange={(e) => {
              update("business_id", e.target.value);
              update("task_id", "");
            }}
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Customer
          <select
            value={form.contact_id}
            onChange={(e) => update("contact_id", e.target.value)}
          >
            <option value="">None</option>
            {(contacts.data || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="span-2">
          Related record
          <select
            value={form.task_id}
            onChange={(e) => update("task_id", e.target.value)}
          >
            <option value="">None</option>
            {!spaceChanged && doc.task_id && !recordOptions.some((r) => r.id === doc.task_id) && (
              <option value={doc.task_id}>{doc.task_title}</option>
            )}
            {recordOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <label className="span-2">
          Notes
          <textarea
            rows={6}
            value={form.body}
            maxLength={50000}
            onChange={(e) => update("body", e.target.value)}
            placeholder="Terms, details, anything worth keeping…"
          />
        </label>
        <div className="span-2 file-field">
          <span className="file-label">File</span>
          {doc.file_name && !removeFile && !file && (
            <div className="file-current">
              <span>
                {doc.file_name} <small className="muted">{fileSize(doc.file_size)}</small>
              </span>
              <a
                className="link-button"
                href={`${API}/documents/${doc.id}/file`}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
              <a className="link-button" href={`${API}/documents/${doc.id}/file?download=true`}>
                Download
              </a>
              <button
                type="button"
                className="link-button"
                onClick={() => setRemoveFile(true)}
              >
                Remove
              </button>
            </div>
          )}
          {removeFile && (
            <p className="muted small">
              The file will be removed when you save.{" "}
              <button type="button" className="link-button" onClick={() => setRemoveFile(false)}>
                Undo
              </button>
            </p>
          )}
          <input type="file" onChange={pickFile} aria-label="Attach a file" />
          <small className="muted">
            Up to {MAX_FILE_MB} MB. Files stay on this computer.
          </small>
        </div>
      </div>
      {error && <p role="alert" className="extractor-error">{error}</p>}
    </Modal>
  );
}
