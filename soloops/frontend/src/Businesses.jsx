
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { categoryBadgeStyle, spaceColor } from "./spaces";
import { MODULES } from "./records";

// mirrors the backend defaults; used until the user picks tabs
const DEFAULT_MODULES = {
  Business: ["work", "payments", "customers", "inventory", "documents"],
  "Content Creation": ["work", "payments", "customers", "documents"],
  Academic: ["work", "documents"],
  Personal: ["work", "documents"],
  Custom: ["work", "documents"],
};

const SPACE_CATEGORIES = [
  "Academic",
  "Business",
  "Content Creation",
  "Personal",
  "Custom",
];

const TEMPLATES = [
  {
    label: "Online Shop",
    name: "Online Shop",
    category: "Business",
    business_type: "Online selling",
    description: "Products, orders, deliveries and stock",
  },
  {
    label: "Freelance Services",
    name: "Freelance Studio",
    category: "Business",
    business_type: "Freelance services",
    description: "Client projects, quotes, invoices and files",
  },
  {
    label: "College & Scholarship",
    name: "College & Scholarship",
    category: "Academic",
    business_type: "Scholarship & Studies",
    description:
      "Classes, exams and scholarship renewal requirements",
  },
  {
    label: "Camera Rental",
    name: "Camera Rental",
    category: "Business",
    business_type: "Camera Rental",
    description: "Renting cameras and lenses to customers",
  },
  {
    label: "Family Property",
    name: "Family Property",
    category: "Business",
    business_type: "Housing Rental",
    description: "Helping manage the family's housing rental units",
  },
  {
    label: "TikTok Content",
    name: "TikTok Content",
    category: "Content Creation",
    business_type: "TikTok",
    description: "Planning, filming and editing TikTok videos",
  },
  {
    label: "Personal Goals",
    name: "Personal Goals",
    category: "Personal",
    business_type: "Personal",
    description: "Health, appointments and personal commitments",
  },
];

const emptyForm = {
  name: "",
  category: "Academic",
  business_type: "",
  description: "",
  modules: null,
};

export default function Businesses({ onCountChange }) {
  const [businesses, setBusinesses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadBusinesses() {
    try {
      const data = await apiFetch("/businesses");
      setBusinesses(data);
      onCountChange?.(data.length);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    let alive = true;
    apiFetch("/businesses")
      .then((data) => {
        if (!alive) return;
        // App already refreshes its own list on page change
        setBusinesses(data);
      })
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, []);

  function edit(business) {
    setEditingId(business.id);
    setForm({
      name: business.name,
      category: business.category || "Business",
      business_type: business.business_type,
      description: business.description,
      modules: business.modules || null,
    });
  }

  function cancel() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function applyTemplate(template) {
    setEditingId(null);
    setForm({
      name: template.name,
      category: template.category,
      business_type: template.business_type,
      description: template.description,
      modules: null,
    });
  }

  const effectiveModules =
    form.modules || DEFAULT_MODULES[form.category] || ["work"];

  function toggleModule(value) {
    if (value === "work") return;
    const next = effectiveModules.includes(value)
      ? effectiveModules.filter((m) => m !== value)
      : [...effectiveModules, value];
    setForm({ ...form, modules: MODULES.map((m) => m.value).filter((m) => next.includes(m)) });
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;

    if (!form.name.trim() || !form.business_type.trim()) {
      setError("Space name and type are required.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const url = editingId
        ? `/businesses/${editingId}`
        : "/businesses";

      await apiFetch(url, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          modules: form.modules ?? undefined,
        }),
      });

      cancel();
      await loadBusinesses();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(business) {
    const { id, name } = business;
    const count = business.task_count || 0;
    const parts = [
      count && `${count} record${count === 1 ? "" : "s"} (${business.pending_count || 0} not done)`,
      business.inventory_count && `${business.inventory_count} inventory item${business.inventory_count === 1 ? "" : "s"}`,
      business.document_count && `${business.document_count} document${business.document_count === 1 ? "" : "s"}`,
    ].filter(Boolean);
    const message = parts.length
      ? `Delete "${name}" with ${parts.join(", ")}?\n\n` +
        "A backup of your data is saved automatically before deleting. Customers are kept."
      : `Delete "${name}"? It's empty.`;
    if (!window.confirm(message)) {
      return;
    }

    setBusy(true);

    try {
      await apiFetch(`/businesses/${id}`, { method: "DELETE" });

      if (editingId === id) cancel();
      await loadBusinesses();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Manage spaces</h1>
        <p className="page-sub">
          One space per business or part of your life. Each gets its
          own work, customers, stock and documents, and the description
          helps the on-device AI understand it.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>Quick start</h3>
        </div>
        <div className="chip-row" style={{ margin: 0 }}>
          {TEMPLATES.map((template) => (
            <button
              type="button"
              className="chip"
              key={template.label}
              onClick={() => applyTemplate(template)}
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>

      <form className="card" onSubmit={save} style={{ marginBottom: 20 }}>
        <h3 className="card-title">
          {editingId ? "Edit space" : "New space"}
        </h3>

        <div className="task-form">
          <label>
            Name *
            <input
              maxLength={100}
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              required
            />
          </label>
          <label>
            Category
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
            >
              {SPACE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Type (e.g. Scholarship, Camera Rental, TikTok) *
            <input
              maxLength={100}
              value={form.business_type}
              onChange={(e) =>
                setForm({ ...form, business_type: e.target.value })
              }
              required
            />
          </label>
          <fieldset className="span-2 module-pick">
            <legend>Tabs in this space</legend>
            {MODULES.map((m) => (
              <label key={m.value} className="module-chip">
                <input
                  type="checkbox"
                  checked={effectiveModules.includes(m.value)}
                  disabled={m.value === "work"}
                  onChange={() => toggleModule(m.value)}
                />
                {m.label}
              </label>
            ))}
            <small className="muted">
              {form.modules ? "Your choice." : `Suggested for ${form.category}.`} You can change this any time.
            </small>
          </fieldset>
          <label className="span-2">
            Description
            <textarea
              placeholder="Describe this part of your life (goals, responsibilities)..."
              maxLength={1000}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
            />
          </label>
        </div>

        {error && <p role="alert" className="form-error">{error}</p>}

        <div className="form-footer">
          {editingId && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={cancel}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn" disabled={busy}>
            {editingId ? "Save changes" : "+ Create space"}
          </button>
        </div>
      </form>

      <div className="business-grid">
        {businesses.map((business) => (
          <article
            className="space-card"
            key={business.id}
            style={{ "--space-color": spaceColor(business.id, businesses), cursor: "default" }}
          >
            <div className="space-card-head">
              <span className="space-card-name" style={{ margin: 0 }}>
                {business.name}
              </span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span
                className="category-badge"
                style={categoryBadgeStyle(business.category)}
              >
                {business.category || "Business"}
              </span>{" "}
              <span className="muted" style={{ fontSize: 12.5 }}>
                {business.business_type}
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, minHeight: 34 }}>
              {business.description || "No description yet."}
            </p>

            <div className="business-actions">
              <button
                className="btn btn-secondary btn-small"
                onClick={() => edit(business)}
                disabled={busy}
              >
                Edit
              </button>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => remove(business)}
                disabled={busy}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      {businesses.length === 0 && !error && (
        <p className="muted">No spaces yet. Create your first space!</p>
      )}
    </>
  );
}
