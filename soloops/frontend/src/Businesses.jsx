
import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

const emptyForm = {
  name: "",
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
      const response = await fetch(`${API}/businesses`);
      if (!response.ok) throw new Error("Cannot load businesses");

      const data = await response.json();
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
      business_type: business.business_type,
      description: business.description,
    });
  }

  function cancel() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;

    if (!form.name.trim() || !form.business_type.trim()) {
      setError("Business name and type are required.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const url = editingId
        ? `${API}/businesses/${editingId}`
        : `${API}/businesses`;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) throw new Error("Could not save business");

      cancel();
      await loadBusinesses();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this business workspace?")) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(`${API}/businesses/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Could not delete business");

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
      <h2>My Businesses</h2>
      <p>Create and manage any type of business.</p>

      <form className="business-form" onSubmit={save}>
        <h3>{editingId ? "Edit Business" : "New Business"}</h3>

        <input
          placeholder="Business name"
          maxLength={100}
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
          required
        />

        <input
          placeholder="Business type (e.g. Online Shop)"
          maxLength={100}
          value={form.business_type}
          onChange={(e) =>
            setForm({ ...form, business_type: e.target.value })
          }
          required
        />

        <textarea
          placeholder="Describe what your business does..."
          maxLength={1000}
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
          rows={3}
        />

        <div className="business-actions">
          <button type="submit" disabled={busy}>
            {editingId ? "Save Changes" : "+ Create Business"}
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
        <p>No businesses yet. Create your first workspace!</p>
      )}
    </section>
  );
}
