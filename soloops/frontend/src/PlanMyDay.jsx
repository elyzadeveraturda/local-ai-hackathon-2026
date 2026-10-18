import { useState } from "react";
import { apiFetch } from "./api";
import { spaceColor, formatRange } from "./spaces";

const cacheKey = (d) => `soloops-briefing-${d}`;

export default function PlanMyDay({ attention, spaces, onChanged, onLockIn }) {
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
  // on-demand step breakdowns via the focus planner: {taskId: {...}}
  const [breakdowns, setBreakdowns] = useState({});

  async function breakDown(taskId) {
    setBreakdowns((b) => ({ ...b, [taskId]: { loading: true } }));
    try {
      const res = await apiFetch("/lock-in/plan", {
        method: "POST",
        body: JSON.stringify({ task_id: taskId }),
      });
      setBreakdowns((b) => ({
        ...b,
        [taskId]: { steps: res.steps, source: res.source },
      }));
    } catch (err) {
      setBreakdowns((b) => ({ ...b, [taskId]: { error: err.message } }));
    }
  }

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

          {plan.urgent?.length > 0 && (
            <div className="plan-urgent">
              <span className="plan-urgent-label">Needs attention</span>
              {plan.urgent.map((u) => (
                <span
                  key={u.task_id}
                  className={`chip chip-${u.bucket}`}
                  title={`${u.space_name} · ${u.due}`}
                >
                  {u.title} · {u.bucket === "overdue" ? "overdue" : "today"}
                </span>
              ))}
            </div>
          )}

          {plan.order?.length > 0 ? (
            <>
              <div className="plan-sub">Recommended order</div>
              <ol className="plan-order">
                {plan.order.map((o) => {
                  const st = plan.steps?.find((x) => x.task_id === o.task_id);
                  const bd = breakdowns[o.task_id];
                  return (
                    <li key={o.task_id}>
                      <div className="plan-order-head">
                        <strong>{o.title}</strong>
                        <small>
                          <span
                            className="nav-dot"
                            style={{
                              background: spaceColor(o.business_id, spaces),
                            }}
                          />
                          {o.space_name} · {o.reason}
                        </small>
                      </div>
                      {st && (
                        <details className="plan-steps">
                          <summary>Break it down ({st.steps.length} steps)</summary>
                          <ul>
                            {st.steps.map((x, i) => (
                              <li key={i}>{x}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {!st && bd?.steps && (
                        <ul className="plan-steps-list">
                          {bd.steps.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                          {bd.source !== "ai" && (
                            <li className="muted">
                              Local AI unavailable — basic checklist
                            </li>
                          )}
                        </ul>
                      )}
                      {bd?.error && (
                        <p className="extractor-error">{bd.error}</p>
                      )}
                      <div className="plan-order-actions">
                        {!st && !bd?.steps && (
                          <button
                            className="link-button"
                            disabled={bd?.loading}
                            onClick={() => breakDown(o.task_id)}
                          >
                            {bd?.loading ? "Breaking down…" : "Break it down"}
                          </button>
                        )}
                        {onLockIn && (
                          <button
                            className="link-button"
                            onClick={() => onLockIn(o.task_id)}
                          >
                            Lock In
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            plan.focus?.length > 0 && (
              <>
                <div className="plan-sub">Focus</div>
                <ol className="plan-focus">
                  {plan.focus.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ol>
              </>
            )
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
                Free time today
                {plan.free_minutes > 0 &&
                  ` (${Math.floor(plan.free_minutes / 60)}h ${plan.free_minutes % 60}m)`}
                :
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
