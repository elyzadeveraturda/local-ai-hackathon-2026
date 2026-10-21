import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./api";
import { KIND_LABEL, STATUS_LABEL } from "./records";
import { shortDate } from "./spaces";

const GROUPS = [
  ["records", "Records"],
  ["contacts", "Customers"],
  ["inventory", "Inventory"],
  ["documents", "Documents"],
  ["spaces", "Spaces"],
];

function describe(type, item) {
  switch (type) {
    case "records":
      return {
        title: item.title,
        sub: [
          KIND_LABEL[item.kind],
          item.business_name,
          item.status === "completed" ? STATUS_LABEL.completed : null,
          item.due_date ? shortDate(item.due_date) : null,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "contacts":
      return { title: item.name, sub: [item.phone, item.email].filter(Boolean).join(" · ") || "Customer" };
    case "inventory":
      return { title: item.name, sub: `${item.quantity} in stock · ${item.business_name}` };
    case "documents":
      return { title: item.title, sub: [item.file_name, item.business_name].filter(Boolean).join(" · ") };
    default:
      return { title: item.name, sub: item.category || "Space" };
  }
}

// Search everything at once: Ctrl/Cmd + K anywhere.
export default function SearchPalette({ onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [fetched, setResult] = useState(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return undefined;
    let alive = true;
    const id = setTimeout(() => {
      apiFetch(`/search?q=${encodeURIComponent(q)}`)
        .then((r) => {
          if (!alive) return;
          setResult(r);
          setError("");
          setActive(0);
        })
        .catch((err) => alive && setError(err.message));
    }, 180);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query]);

  // stale results are hidden once the query is too short
  const result = query.trim().length >= 2 ? fetched : null;

  const flat = useMemo(() => {
    if (!result) return [];
    return GROUPS.flatMap(([key]) => (result[key] || []).map((item) => ({ type: key, item })));
  }, [result]);

  function choose(entry) {
    if (!entry) return;
    onSelect(entry.type, entry.item);
    onClose();
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(flat[active]);
    }
  }

  let index = -1;
  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search bookings, customers, items, documents…"
          aria-label="Search everything"
          aria-controls="palette-results"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="palette-results" id="palette-results" role="listbox">
          {query.trim().length < 2 && (
            <p className="muted small palette-hint">
              Type at least two letters. ↑ ↓ to move, Enter to open, Esc to close.
            </p>
          )}
          {error && <p className="extractor-error">{error}</p>}
          {result && flat.length === 0 && (
            <p className="muted small palette-hint">Nothing found for “{result.query}”.</p>
          )}
          {result &&
            GROUPS.map(([key, label]) =>
              result[key]?.length ? (
                <div key={key} className="palette-group">
                  <div className="palette-label">{label}</div>
                  {result[key].map((item) => {
                    index += 1;
                    const i = index;
                    const d = describe(key, item);
                    return (
                      <button
                        key={`${key}-${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={i === active}
                        className={`palette-item${i === active ? " active" : ""}`}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => choose({ type: key, item })}
                      >
                        <span>{d.title}</span>
                        <small>{d.sub}</small>
                      </button>
                    );
                  })}
                </div>
              ) : null
            )}
        </div>
      </div>
    </div>
  );
}
