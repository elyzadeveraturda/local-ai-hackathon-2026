export const SPACE_PALETTE = [
  "#6c5ce7",
  "#2f80ed",
  "#14b8a6",
  "#f2994a",
  "#ec4899",
  "#22c55e",
];

export const CATEGORY_BADGE = {
  Academic: { bg: "#f0edff", color: "#6c5ce7" },
  Business: { bg: "#e8f4ff", color: "#2f80ed" },
  "Content Creation": { bg: "#fff1e8", color: "#f2994a" },
  Personal: { bg: "#e9f9f1", color: "#27ae60" },
  Custom: { bg: "#f1f2f6", color: "#6b7390" },
};

export function categoryBadgeStyle(category) {
  const s = CATEGORY_BADGE[category] || CATEGORY_BADGE.Custom;
  return { background: s.bg, color: s.color };
}

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
  if (task.end_date) {
    return `${shortDate(task.due_date)} → ${shortDate(task.end_date)}`;
  }
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

export function toTaskFields(value) {
  const s = value.start || "";
  const e = value.end || "";
  const sDate = s.slice(0, 10) || null;
  const eDate = e.slice(0, 10) || null;
  const fields = {
    due_date: sDate,
    due_time: null,
    end_date: null,
    end_time: null,
  };
  if (!sDate) return fields;
  if (value.allDay) {
    if (eDate && eDate > sDate) fields.end_date = eDate;
  } else {
    fields.due_time = s.slice(11, 16) || null;
    if (eDate === sDate) {
      fields.end_time = e.slice(11, 16) || null;
    } else if (eDate) {
      fields.end_date = eDate;
      fields.end_time = e.slice(11, 16) || null;
    }
  }
  return fields;
}

export function fromTaskFields(task) {
  const allDay = !task.due_time;
  let start = "";
  if (task.due_date) {
    start = allDay ? task.due_date : `${task.due_date}T${task.due_time}`;
  }
  let end = "";
  if (task.end_date) {
    end =
      allDay || !task.end_time
        ? task.end_date
        : `${task.end_date}T${task.end_time}`;
  } else if (task.end_time && task.due_date && !allDay) {
    end = `${task.due_date}T${task.end_time}`;
  }
  return { allDay, start, end };
}

export function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
