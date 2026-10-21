import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api";

// GET a path and keep it fresh. Pass null to skip. `deps` re-runs the
// request (e.g. a refresh counter from the app).
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: "", loading: !!path });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) {
      setState({ data: null, error: "", loading: false });
      return undefined;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    apiFetch(path)
      .then((data) => alive && setState({ data, error: "", loading: false }))
      .catch(
        (err) =>
          alive && setState((s) => ({ ...s, error: err.message, loading: false }))
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}
