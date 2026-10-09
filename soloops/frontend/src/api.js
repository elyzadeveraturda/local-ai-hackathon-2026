export const API =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function apiFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error(
      "Cannot reach the SoloOps backend. Is FastAPI running on port 8000?"
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;
    let message = `Request failed (${response.status})`;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail
        .map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`)
        .join("; ");
    }
    throw new Error(message);
  }

  return data;
}
