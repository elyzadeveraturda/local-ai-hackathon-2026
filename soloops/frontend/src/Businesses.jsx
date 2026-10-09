
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { categoryBadgeStyle, spaceColor } from "./spaces";

const SPACE_CATEGORIES = [
  "Academic",
  "Business",
  "Content Creation",
  "Personal",
  "Custom",
];

const TEMPLATES = [
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
    loadBusinesses();
  }, []);

  function edit(business) {
    setEditingId(business.id);
    setForm({
      name: business.name,
      category: business.category || "Business",
      business_type: business.business_type,
      description: business.description,
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
    });
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
        body: JSON.stringify(form),
      });

      cancel();
      await loadBusinesses();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (
      !window.confirm(
        "Delete this space? All of its tasks will also be deleted."
      )
    ) {
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
          Each space is one part of your life. SoloOps uses its
          description to personalize AI help.
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
                onClick={() => remove(business.id)}
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
