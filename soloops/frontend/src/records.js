// Shared vocabulary for records (tasks, events, bookings, payments,
// deadlines) so every screen labels things the same way.

export const KINDS = [
  { value: "task", label: "Task" },
  { value: "event", label: "Event" },
  { value: "booking", label: "Booking" },
  { value: "payment", label: "Payment" },
  { value: "deadline", label: "Deadline" },
];

export const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

export const STATUSES = [
  { value: "pending", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Done" },
];

export const STATUS_LABEL = Object.fromEntries(
  STATUSES.map((s) => [s.value, s.label])
);

export const PAYMENT_STATUSES = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partly paid" },
  { value: "paid", label: "Paid" },
];

export const PAYMENT_LABEL = Object.fromEntries(
  PAYMENT_STATUSES.map((p) => [p.value, p.label])
);

export const MODULES = [
  { value: "work", label: "Work", hint: "Tasks, events, bookings and deadlines" },
  { value: "payments", label: "Payments", hint: "Who has paid and who still owes" },
  { value: "customers", label: "Customers", hint: "People you work with" },
  { value: "inventory", label: "Inventory", hint: "Stock and rentable items" },
  { value: "documents", label: "Documents", hint: "Notes, contracts, receipts, files" },
];

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function money(value) {
  if (value == null || Number.isNaN(Number(value))) return "";
  return peso.format(Number(value));
}

export function balance(record) {
  if (record.amount == null) return null;
  return Math.max(0, record.amount - (record.amount_paid || 0));
}

export function fileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function stockState(item) {
  if (item.quantity <= 0) return "out";
  if (item.reorder_at != null && item.quantity <= item.reorder_at) return "low";
  return "ok";
}

// read a File as base64 (without the data: prefix) for upload
export function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

export const MAX_FILE_MB = 10;
