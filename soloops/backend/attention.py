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
        "tasks": pending,
        "groups": [
            {"key": key, "label": label, "tasks": groups[key]}
            for key, _, label in BUCKETS
        ],
        "completed": completed,
    }
