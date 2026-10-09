export const SPACE_PALETTE = [
  "#6f62a8",
  "#a8763e",
  "#3f7f86",
  "#b0566f",
  "#5c7f4a",
  "#7a7266",
];

export const CATEGORY_ICON = {
  Academic: "◇",
  Business: "▢",
  "Content Creation": "▷",
  Personal: "○",
  Custom: "◌",
};

export function spaceColor(spaceId, spaces) {
  const sorted = [...(spaces || [])].sort((a, b) => a.id - b.id);
  const index = sorted.findIndex((s) => s.id === spaceId);
  return SPACE_PALETTE[(index < 0 ? 0 : index) % SPACE_PALETTE.length];
}

export function categoryIcon(category) {
  return CATEGORY_ICON[category] || CATEGORY_ICON.Custom;
}

export function formatTime12(value) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

export function formatRange(task) {
  if (!task?.due_time) return "";
  const start = formatTime12(task.due_time);
  return task.end_time ? `${start}–${formatTime12(task.end_time)}` : start;
}

export function dueText(task) {
  if (!task.due_date) return "No due date";
  const time = task.due_time ? `, ${formatTime12(task.due_time)}` : "";
  const end = task.end_time ? `–${formatTime12(task.end_time)}` : "";
  const days = task.days_until_due;
  if (days === 0) return `today${time}${end}`;
  if (days != null && days < 0) {
    const n = -days;
    return `${n} day${n !== 1 ? "s" : ""} overdue`;
  }
  const d = new Date(`${task.due_date}T00:00:00`);
  const label = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${label}${time}${end}`;
}

export function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
