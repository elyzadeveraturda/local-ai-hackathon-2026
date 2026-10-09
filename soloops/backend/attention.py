from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

PH_TZ = ZoneInfo("Asia/Manila")

BUCKETS = [
    ("overdue", 1, "Overdue"),
    ("today", 2, "Due today"),
    ("soon", 3, "Due within 3 days"),
    ("later", 4, "Later"),
    ("no_date", 5, "No due date"),
]
BUCKET_RANK = {key: rank for key, rank, _ in BUCKETS}
BUCKET_LABEL = {key: label for key, _, label in BUCKETS}


def ph_today():
    return datetime.now(PH_TZ).date()


def parse_due_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def classify(task, today):
    due = parse_due_date(task.get("due_date"))
    if due is None:
        return "no_date", None
    days = (due - today).days
    if days < 0:
        return "overdue", days
    if days == 0:
        return "today", days
    if days <= 3:
        return "soon", days
    return "later", days


def _minutes(value):
    if not value:
        return None
    try:
        h, m = str(value).split(":")[:2]
        return int(h) * 60 + int(m)
    except (ValueError, TypeError):
        return None


def _task_summary(task):
    return {
        "id": task["id"],
        "title": task["title"],
        "business_id": task.get("business_id"),
        "business_name": task.get("business_name"),
        "space_category": task.get("space_category"),
        "due_time": task.get("due_time"),
        "end_time": task.get("end_time"),
    }


def _fmt12(minutes):
    h, m = minutes // 60, minutes % 60
    suffix = "AM" if h < 12 else "PM"
    hour = h % 12 or 12
    return f"{hour}:{m:02d} {suffix}"


def suggest_slot(a, b, tasks):
    """Deterministic alternative slot for the movable task.
    a and b are timed entries ({task, date, start, end})."""
    # prefer the task that involves another person (a booking);
    # else the later start; tie -> shorter duration; tie -> higher id
    def key(t):
        dur = t["end"] - t["start"]
        return (
            0 if t["task"].get("customer") else 1,
            -t["start"],
            dur,
            -t["task"]["id"],
        )
    move = sorted([a, b], key=key)[0]
    other = b if move["task"]["id"] == a["task"]["id"] else a
    duration = move["end"] - move["start"] or 30

    start = max(a["end"], b["end"]) + 30
    start = ((start + 29) // 30) * 30
    day = a["date"]

    blockers = []
    for t in tasks:
        if t.get("status") == "completed" or t["id"] == move["task"]["id"]:
            continue
        if t.get("end_date"):
            continue
        if t.get("due_date") != day or not t.get("due_time"):
            continue
        s = _minutes(t.get("due_time"))
        e = _minutes(t.get("end_time"))
        if s is None:
            continue
        blockers.append((s, e if e and e > s else s))

    while start + duration <= 22 * 60:
        end = start + duration
        if not any(s == start or (start < e and s < end)
                   for s, e in blockers):
            return {
                "move_task_id": move["task"]["id"],
                "move_task_title": move["task"]["title"],
                "person": move["task"].get("customer"),
                "time": f"{start // 60:02d}:{start % 60:02d}",
                "end_time": f"{end // 60:02d}:{end % 60:02d}",
                "reason": (
                    f"30-minute buffer after {other['task']['title']} "
                    f"ends at {_fmt12(other['end'])}"
                ),
            }
        start += 30
    return None


def find_conflicts(tasks, from_date=None):
    timed = []
    for task in tasks:
        if task.get("status") == "completed":
            continue
        due = task.get("due_date")
        start = _minutes(task.get("due_time"))
        if task.get("end_date") or not due or start is None:
            continue
        if from_date and due < from_date.isoformat():
            continue
        end = _minutes(task.get("end_time"))
        if end is None or end <= start:
            end = start
        timed.append({"task": task, "date": due, "start": start,
                      "end": end})

    conflicts = []
    for i in range(len(timed)):
        for j in range(i + 1, len(timed)):
            a, b = timed[i], timed[j]
            if a["date"] != b["date"]:
                continue
            if a["start"] == b["start"] or (
                a["start"] < b["end"] and b["start"] < a["end"]
            ):
                later = max(a["start"], b["start"])
                conflicts.append({
                    "date": a["date"],
                    "time": f"{later // 60:02d}:{later % 60:02d}",
                    "tasks": [
                        _task_summary(a["task"]),
                        _task_summary(b["task"]),
                    ],
                    "suggestion": suggest_slot(a, b, tasks),
                })

    conflicts.sort(key=lambda c: (c["date"], c["time"]))
    return conflicts


def free_slots(tasks, day, start="08:00", end="22:00",
               now=None, min_minutes=30):
    """Unbooked gaps on `day` (YYYY-MM-DD) between start and end.
    `now` is a datetime; when it falls on `day`, the window starts
    at `now` rounded up to the next :00/:30."""
    window_start = _minutes(start) or 0
    window_end = _minutes(end) or 24 * 60
    if now is not None and now.date().isoformat() == day:
        minute = now.hour * 60 + now.minute
        if now.second or now.microsecond:
            minute += 1
        window_start = max(window_start, ((minute + 29) // 30) * 30)

    busy = []
    for task in tasks:
        if task.get("status") == "completed":
            continue
        if task.get("end_date") or task.get("due_date") != day:
            continue
        s = _minutes(task.get("due_time"))
        if s is None:
            continue
        e = _minutes(task.get("end_time"))
        if e is None or e <= s:
            e = s + 30
        busy.append((max(s, window_start), min(e, window_end)))

    busy = sorted(iv for iv in busy if iv[1] > iv[0])
    slots = []
    cursor = window_start
    for s, e in busy:
        if s - cursor >= min_minutes:
            slots.append({
                "start": f"{cursor // 60:02d}:{cursor % 60:02d}",
                "end": f"{s // 60:02d}:{s % 60:02d}",
            })
        cursor = max(cursor, e)
    if window_end - cursor >= min_minutes:
        slots.append({
            "start": f"{cursor // 60:02d}:{cursor % 60:02d}",
            "end": f"{window_end // 60:02d}:{window_end % 60:02d}",
        })
    return slots


def build_attention(tasks, today=None):
    today = today or ph_today()
    pending = []
    completed = []

    for task in tasks:
        if task.get("status") == "completed":
            completed.append(task)
            continue
        bucket, days = classify(task, today)
        pending.append({
            **task,
            "priority": BUCKET_RANK[bucket],
            "priority_bucket": bucket,
            "priority_label": BUCKET_LABEL[bucket],
            "days_until_due": days,
        })

    pending.sort(key=lambda t: (
        t["priority"],
        t.get("due_date") or "9999-12-31",
        t.get("due_time") or "99:99",
        t["id"],
    ))

    groups = {key: [] for key, _, _ in BUCKETS}
    for task in pending:
        groups[task["priority_bucket"]].append(task)

    soon_cutoff = today + timedelta(days=3)

    return {
        "today": today.isoformat(),
        "timezone": "Asia/Manila",
        "counts": {
            "pending": len(pending),
            "overdue": len(groups["overdue"]),
            "due_today": len(groups["today"]),
            "upcoming": len(groups["soon"]),
            "later": len(groups["later"]),
            "no_date": len(groups["no_date"]),
            "completed": len(completed),
        },
        "upcoming_until": soon_cutoff.isoformat(),
        "conflicts": find_conflicts(pending, today),
        "tasks": pending,
        "groups": [
            {"key": key, "label": label, "tasks": groups[key]}
            for key, _, label in BUCKETS
        ],
        "completed": completed,
    }
