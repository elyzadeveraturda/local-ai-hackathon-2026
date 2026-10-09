import { useState } from "react";
import { apiFetch } from "./api";
import { spaceColor, formatRange } from "./spaces";

const cacheKey = (d) => `soloops-briefing-${d}`;

export default function PlanMyDay({ attention, spaces, onChanged }) {
  // mounted with key={today} so this lazy init is per-date
  const today = attention?.today;
  const [plan, setPlan] = useState(() => {
    if (!today) return null;
    try {
      const cached = sessionStorage.getItem(cacheKey(today));
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(() => new Set());

  async function generate(regen = false) {
    if (loading) return;
    setLoading(true);
    setError("");
    if (regen && today) {
      sessionStorage.removeItem(cacheKey(today));
    }
    try {
      const data = await apiFetch("/briefing", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setPlan(data);
      if (data.date) {
        sessionStorage.setItem(cacheKey(data.date), JSON.stringify(data));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addToCalendar(block) {
    try {
      await apiFetch(`/tasks/${block.task_id}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({
          due_date: block.date,
          due_time: block.start,
          end_time: block.end,
        }),
      });
      setAdded(new Set([...added, block.task_id]));
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card plan-card">
      <div className="card-head">
        <h3>✦ Plan my day</h3>
        <span className="badge">On-device · qwen2.5:3b</span>
      </div>

      {!plan && !loading && (
        <>
          <p className="muted">
            Let your local AI turn today's tasks, deadlines and free
            time into a plan.
          </p>
          <button className="btn" onClick={() => generate()}>
            Plan my day with local AI
          </button>
        </>
      )}

      {loading && (
        <p className="muted">Planning on your device…</p>
      )}

      {plan && !loading && (
        <>
          <p className="plan-summary">{plan.summary}</p>

          {plan.focus?.length > 0 && (
            <>
              <div className="plan-sub">Focus</div>
              <ol className="plan-focus">
                {plan.focus.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ol>
            </>
          )}

          {plan.blocks?.length > 0 && (
            <>
              <div className="plan-sub">Suggested time blocks</div>
              {plan.blocks.map((b) => (
                <div className="plan-block" key={b.task_id}>
                  <span className="plan-time">
                    {formatRange({
                      due_time: b.start,
                      end_time: b.end,
                    })}
                  </span>
                  <div className="plan-block-body">
                    <strong>{b.title}</strong>
                    <small>
                      <span
                        className="nav-dot"
                        style={{
                          background: spaceColor(
                            b.business_id,
                            spaces
                          ),
                        }}
                      />
                      {b.space_name}
                      {b.why ? ` · ${b.why}` : ""}
                    </small>
                  </div>
                  {added.has(b.task_id) ? (
                    <span className="plan-added">✓ Added</span>
                  ) : (
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => addToCalendar(b)}
                    >
                      Add to calendar
                    </button>
                  )}
                </div>
              ))}
              <p className="muted" style={{ fontSize: 12 }}>
                Suggestions only — nothing is scheduled until you
                add it.
              </p>
            </>
          )}

          {plan.free_slots?.length > 0 && (
            <div className="plan-slots">
              <span className="muted" style={{ fontSize: 12.5 }}>
                Free time today:
              </span>
              {plan.free_slots.map((s, i) => (
                <span className="chip" key={i}>
                  {formatRange({
                    due_time: s.start,
                    end_time: s.end,
                  })}
                </span>
              ))}
            </div>
          )}

          <div className="plan-foot">
            <span className="muted" style={{ fontSize: 12 }}>
              {plan.source === "ai"
                ? "Generated by local AI"
                : "Local AI unavailable — basic plan"}
              {plan.conflicts_count > 0 &&
                ` · ${plan.conflicts_count} conflict${
                  plan.conflicts_count > 1 ? "s" : ""
                }`}
            </span>
            <button
              className="link-button"
              onClick={() => generate(true)}
            >
              Regenerate
            </button>
          </div>
        </>
      )}

      {error && <p className="extractor-error">{error}</p>}
    </div>
  );
}
