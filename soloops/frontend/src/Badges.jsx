import { KIND_LABEL, STATUS_LABEL, PAYMENT_LABEL, money, balance } from "./records";

export function KindBadge({ kind }) {
  if (!kind) return null;
  return <span className={`pill kind-${kind}`}>{KIND_LABEL[kind] || kind}</span>;
}

export function StatusBadge({ status }) {
  return (
    <span className={`pill status-${status}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function PaymentBadge({ record }) {
  if (!record.payment_status) return null;
  const owed = balance(record);
  const text =
    record.payment_status === "partial" && owed != null
      ? `${PAYMENT_LABEL.partial} · ${money(owed)} left`
      : PAYMENT_LABEL[record.payment_status];
  return <span className={`pill pay-${record.payment_status}`}>{text}</span>;
}

export function StockBadge({ item }) {
  if (item.quantity <= 0) return <span className="pill stock-out">Out of stock</span>;
  if (item.reorder_at != null && item.quantity <= item.reorder_at)
    return <span className="pill stock-low">Low stock</span>;
  return <span className="pill stock-ok">In stock</span>;
}
