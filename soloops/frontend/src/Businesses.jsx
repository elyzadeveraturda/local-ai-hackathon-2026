
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { categoryBadgeStyle } from "./spaces";

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
    <section className="business-page">
      <h2>My Spaces</h2>
      <p>
        Organize every part of your life — school, business, content,
        personal.
      </p>

      <div className="chip-row">
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

      <form className="business-form" onSubmit={save}>
        <h3>{editingId ? "Edit Space" : "New Space"}</h3>

        <input
          placeholder="Space Name"
          maxLength={100}
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
          required
        />

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

        <input
          placeholder="Space Type (e.g. Scholarship, Camera Rental, TikTok)"
          maxLength={100}
          value={form.business_type}
          onChange={(e) =>
            setForm({ ...form, business_type: e.target.value })
          }
          required
        />

        <textarea
          placeholder="Describe this part of your life (goals, responsibilities)..."
          maxLength={1000}
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
          rows={3}
        />

        <div className="business-actions">
          <button type="submit" disabled={busy}>
            {editingId ? "Save Changes" : "+ Create Space"}
          </button>

          {editingId && (
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && <p role="alert" className="form-error">{error}</p>}

      <div className="business-grid">
        {businesses.map((business) => (
          <article className="business-card" key={business.id}>
            <h3>{business.name}</h3>
            <span
              className="category-badge"
              style={categoryBadgeStyle(business.category)}
            >
              {business.category || "Business"}
            </span>{" "}
            <span>{business.business_type}</span>
            <p>{business.description || "No description yet."}</p>

            <div className="business-actions">
              <button onClick={() => edit(business)} disabled={busy}>
                Edit
              </button>
              <button
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
        <p>No spaces yet. Create your first space!</p>
      )}
    </section>
  );
}
