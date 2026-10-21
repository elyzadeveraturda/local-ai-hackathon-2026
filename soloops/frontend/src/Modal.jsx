import { useEffect, useId } from "react";

// open dialogs, newest last: Escape only closes the top one
const stack = [];

// Shared dialog: Escape and backdrop click close it unless busy.
export default function Modal({
  title,
  onClose,
  busy = false,
  wide = false,
  onSubmit,
  footer,
  children,
}) {
  const id = useId();

  useEffect(() => {
    stack.push(id);
    return () => {
      const i = stack.lastIndexOf(id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [id]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy && stack[stack.length - 1] === id) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, id]);

  const Tag = onSubmit ? "form" : "div";
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <Tag
        className={`card modal-card${wide ? " modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={onSubmit}
      >
        <div className="card-head">
          <h3>{title}</h3>
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </Tag>
    </div>
  );
}
