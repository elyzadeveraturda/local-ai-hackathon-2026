
import os
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(
    os.environ.get("SOLOOPS_DB_PATH")
    or Path(__file__).resolve().parent / "soloops.db"
)


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn



def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS businesses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                business_type TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Business',
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                customer TEXT,
                item TEXT,
                due_date TEXT,
                amount REAL,
                notes TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (business_id)
                    REFERENCES businesses(id)
                    ON DELETE CASCADE
            )
        """)

        business_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(businesses)")
        }
        if "category" not in business_columns:
            conn.execute(
                "ALTER TABLE businesses "
                "ADD COLUMN category TEXT NOT NULL DEFAULT 'Business'"
            )
        if "modules" not in business_columns:
            # JSON list of enabled tabs; NULL = defaults for the category
            conn.execute("ALTER TABLE businesses ADD COLUMN modules TEXT")

        existing_tables = {
            row["name"]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }

        conn.execute("""
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                business_id INTEGER,
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (business_id)
                    REFERENCES businesses(id)
                    ON DELETE SET NULL
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                sku TEXT,
                quantity INTEGER NOT NULL DEFAULT 0,
                unit TEXT,
                reorder_at INTEGER,
                price REAL,
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (business_id)
                    REFERENCES businesses(id)
                    ON DELETE CASCADE
            )
        """)

        task_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(tasks)")
        }
        if "due_time" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN due_time TEXT")
        if "end_time" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN end_time TEXT")
        if "end_date" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN end_date TEXT")
        if "importance" not in task_columns:
            conn.execute(
                "ALTER TABLE tasks "
                "ADD COLUMN importance TEXT NOT NULL DEFAULT 'normal'"
            )
        if "kind" not in task_columns:
            conn.execute(
                "ALTER TABLE tasks "
                "ADD COLUMN kind TEXT NOT NULL DEFAULT 'task'"
            )
        if "payment_status" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN payment_status TEXT")
        if "amount_paid" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN amount_paid REAL")
        if "contact_id" not in task_columns:
            conn.execute(
                "ALTER TABLE tasks ADD COLUMN contact_id INTEGER "
                "REFERENCES contacts(id) ON DELETE SET NULL"
            )
        if "inventory_id" not in task_columns:
            conn.execute(
                "ALTER TABLE tasks ADD COLUMN inventory_id INTEGER "
                "REFERENCES inventory(id) ON DELETE SET NULL"
            )
        if "updated_at" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN updated_at TEXT")

        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL DEFAULT '',
                file_name TEXT,
                file_path TEXT,
                file_type TEXT,
                file_size INTEGER,
                task_id INTEGER,
                contact_id INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (business_id)
                    REFERENCES businesses(id)
                    ON DELETE CASCADE,
                FOREIGN KEY (task_id)
                    REFERENCES tasks(id)
                    ON DELETE SET NULL,
                FOREIGN KEY (contact_id)
                    REFERENCES contacts(id)
                    ON DELETE SET NULL
            )
        """)

        # First run with customers: turn the free-text customer names
        # already on tasks into linked customer records (text is kept).
        if "contacts" not in existing_tables:
            names = {}
            for row in conn.execute(
                "SELECT id, business_id, trim(customer) AS name FROM tasks "
                "WHERE customer IS NOT NULL AND trim(customer) != '' "
                "ORDER BY id"
            ):
                key = row["name"].lower()
                if key not in names:
                    cur = conn.execute(
                        "INSERT INTO contacts (name, business_id) "
                        "VALUES (?, ?)",
                        (row["name"], row["business_id"])
                    )
                    names[key] = cur.lastrowid
                conn.execute(
                    "UPDATE tasks SET contact_id = ? WHERE id = ?",
                    (names[key], row["id"])
                )

        conn.execute("""
            CREATE TABLE IF NOT EXISTS focus_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER,
                task_title TEXT,
                kind TEXT NOT NULL DEFAULT 'focus',
                minutes INTEGER NOT NULL,
                completed_at TEXT NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id)
                    REFERENCES tasks(id)
                    ON DELETE SET NULL
            )
        """)

        # additive, idempotent indexes for the common lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tasks_business "
            "ON tasks(business_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tasks_status_due "
            "ON tasks(status, due_date)"
        )
        for name, table, cols in (
            ("idx_tasks_contact", "tasks", "contact_id"),
            ("idx_tasks_inventory", "tasks", "inventory_id"),
            ("idx_inventory_business", "inventory", "business_id"),
            ("idx_documents_business", "documents", "business_id"),
            ("idx_documents_task", "documents", "task_id"),
        ):
            conn.execute(
                f"CREATE INDEX IF NOT EXISTS {name} ON {table}({cols})"
            )

        conn.commit()


AUTO_BACKUP_KEEP = 20


def backup_db(label):
    """Snapshot the database into backups/ before a destructive change.

    Keeps the newest AUTO_BACKUP_KEEP automatic snapshots; manual
    backups (any file not starting with "auto-") are never touched.
    """
    backup_dir = DB_PATH.parent / "backups"
    backup_dir.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    target = backup_dir / f"auto-{stamp}-{label}.db"

    with get_connection() as src:
        dst = sqlite3.connect(target)
        try:
            src.backup(dst)
        finally:
            dst.close()

    autos = sorted(backup_dir.glob("auto-*.db"))
    for old in autos[:-AUTO_BACKUP_KEEP]:
        old.unlink()

    return target


def list_businesses():
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT businesses.*,
                   COUNT(tasks.id) AS task_count,
                   COALESCE(SUM(tasks.status != 'completed'), 0)
                       AS pending_count,
                   (SELECT COUNT(*) FROM inventory
                     WHERE inventory.business_id = businesses.id)
                       AS inventory_count,
                   (SELECT COUNT(*) FROM documents
                     WHERE documents.business_id = businesses.id)
                       AS document_count
            FROM businesses
            LEFT JOIN tasks ON tasks.business_id = businesses.id
            GROUP BY businesses.id
            ORDER BY businesses.id DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]


def get_business(business_id):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM businesses WHERE id = ?",
            (business_id,)
        ).fetchone()
        return dict(row) if row else None


def create_business(
    name, business_type, description, category="Business", modules=None
):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO businesses
                (name, business_type, description, category, modules)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, business_type, description, category, modules)
        )
        business_id = cursor.lastrowid
        conn.commit()

    return get_business(business_id)


def update_business(
    business_id, name, business_type, description, category="Business",
    modules=None
):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE businesses
            SET name = ?, business_type = ?, description = ?,
                category = ?, modules = ?
            WHERE id = ?
            """,
            (name, business_type, description, category, modules,
             business_id)
        )
        conn.commit()
        updated = cursor.rowcount > 0

    return get_business(business_id) if updated else None


def delete_business(business_id):
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM businesses WHERE id = ?",
            (business_id,)
        )
        conn.commit()
        return cursor.rowcount > 0
    

TASK_SELECT = """
    SELECT tasks.*,
           businesses.name AS business_name,
           businesses.business_type AS business_type,
           businesses.category AS space_category,
           businesses.description AS business_description,
           contacts.name AS contact_name,
           inventory.name AS inventory_name,
           (SELECT COUNT(*) FROM documents
             WHERE documents.task_id = tasks.id) AS document_count
    FROM tasks
    JOIN businesses ON businesses.id = tasks.business_id
    LEFT JOIN contacts ON contacts.id = tasks.contact_id
    LEFT JOIN inventory ON inventory.id = tasks.inventory_id
"""


def create_task(
    business_id, title, customer=None, item=None,
    due_date=None, amount=None, notes="", due_time=None,
    end_time=None, end_date=None, importance="normal",
    kind="task", status="pending", payment_status=None,
    amount_paid=None, contact_id=None, inventory_id=None
):
    with get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO tasks
            (business_id, title, customer, item, due_date, due_time,
             end_time, end_date, amount, notes, importance, kind,
             status, payment_status, amount_paid, contact_id,
             inventory_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    CURRENT_TIMESTAMP)
        """, (
            business_id, title, customer, item, due_date, due_time,
            end_time, end_date, amount, notes, importance, kind,
            status, payment_status, amount_paid, contact_id,
            inventory_id
        ))
        conn.commit()
        task_id = cursor.lastrowid

    return get_task(task_id)


def find_duplicate_task(
    business_id, title, customer, due_date, notes
):
    with get_connection() as conn:
        row = conn.execute("""
            SELECT id FROM tasks
            WHERE business_id = ?
              AND status != 'completed'
              AND lower(title) = lower(?)
              AND IFNULL(lower(customer), '') = IFNULL(lower(?), '')
              AND IFNULL(due_date, '') = IFNULL(?, '')
              AND IFNULL(notes, '') = IFNULL(?, '')
        """, (business_id, title, customer, due_date, notes)).fetchone()
        return row["id"] if row else None


def get_task(task_id):
    with get_connection() as conn:
        row = conn.execute(
            TASK_SELECT + " WHERE tasks.id = ?",
            (task_id,)
        ).fetchone()
        return dict(row) if row else None


def like_pattern(text):
    """LIKE pattern for a literal substring (escapes % and _)."""
    escaped = (
        text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    )
    return f"%{escaped}%"


TASK_SORTS = {
    "due": """
        CASE WHEN tasks.status != 'completed' THEN 0 ELSE 1 END,
        CASE WHEN tasks.due_date IS NULL THEN 1 ELSE 0 END,
        tasks.due_date {dir}, tasks.due_time {dir}, tasks.id DESC""",
    "created": "tasks.id {dir}",
    "updated": "COALESCE(tasks.updated_at, tasks.created_at) {dir}, tasks.id {dir}",
    "title": "lower(tasks.title) {dir}, tasks.id",
    "amount": """
        CASE WHEN tasks.amount IS NULL THEN 1 ELSE 0 END,
        tasks.amount {dir}, tasks.id""",
    "balance": """
        CASE WHEN tasks.amount IS NULL THEN 1 ELSE 0 END,
        (tasks.amount - COALESCE(tasks.amount_paid, 0)) {dir}, tasks.id""",
}


def list_tasks(
    status=None, business_id=None, kind=None, payment=None,
    contact_id=None, inventory_id=None, q=None, sort="due",
    direction="asc"
):
    """status: pending | in_progress | completed | open (not completed).
    payment: open (unpaid or partly paid) | unpaid | partial | paid |
    tracked (has a payment status)."""
    filters = []
    params = []
    if status == "open":
        filters.append("tasks.status != 'completed'")
    elif status:
        filters.append("tasks.status = ?")
        params.append(status)
    if business_id is not None:
        filters.append("tasks.business_id = ?")
        params.append(business_id)
    if kind:
        filters.append("tasks.kind = ?")
        params.append(kind)
    if payment == "open":
        filters.append("tasks.payment_status IN ('unpaid', 'partial')")
    elif payment == "tracked":
        filters.append("tasks.payment_status IS NOT NULL")
    elif payment:
        filters.append("tasks.payment_status = ?")
        params.append(payment)
    if contact_id is not None:
        filters.append("tasks.contact_id = ?")
        params.append(contact_id)
    if inventory_id is not None:
        filters.append("tasks.inventory_id = ?")
        params.append(inventory_id)
    if q:
        pattern = like_pattern(q)
        filters.append(
            "(tasks.title LIKE ? ESCAPE '\\' OR tasks.notes LIKE ? ESCAPE '\\'"
            " OR tasks.customer LIKE ? ESCAPE '\\'"
            " OR tasks.item LIKE ? ESCAPE '\\'"
            " OR contacts.name LIKE ? ESCAPE '\\'"
            " OR inventory.name LIKE ? ESCAPE '\\')"
        )
        params.extend([pattern] * 6)
    where = (" WHERE " + " AND ".join(filters)) if filters else ""
    order = TASK_SORTS.get(sort, TASK_SORTS["due"]).format(
        dir="DESC" if direction == "desc" else "ASC"
    )

    with get_connection() as conn:
        rows = conn.execute(
            TASK_SELECT + where + " ORDER BY " + order, params
        ).fetchall()
        return [dict(row) for row in rows]


def update_task_schedule(
    task_id, due_date, due_time, end_time, end_date
):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE tasks
            SET due_date = ?, due_time = ?,
                end_time = ?, end_date = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (due_date, due_time, end_time, end_date, task_id)
        )
        conn.commit()
        return cursor.rowcount > 0


def set_task_status(task_id, status):
    with get_connection() as conn:
        cursor = conn.execute(
            "UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP "
            "WHERE id = ?",
            (status, task_id)
        )
        conn.commit()
        return cursor.rowcount > 0


def complete_task(task_id):
    return set_task_status(task_id, "completed")


TASK_EDITABLE = (
    "business_id", "title", "customer", "item", "due_date",
    "due_time", "end_time", "end_date", "amount", "notes",
    "importance", "kind", "status", "payment_status", "amount_paid",
    "contact_id", "inventory_id",
)


def update_task(task_id, fields):
    """Replace the editable columns given in fields (others untouched)."""
    cols = [c for c in TASK_EDITABLE if c in fields]
    if not cols:
        return get_task(task_id)
    with get_connection() as conn:
        cursor = conn.execute(
            "UPDATE tasks SET "
            + ", ".join(f"{c} = ?" for c in cols)
            + ", updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [fields[c] for c in cols] + [task_id]
        )
        conn.commit()
        updated = cursor.rowcount > 0
    return get_task(task_id) if updated else None


def delete_task(task_id):
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM tasks WHERE id = ?", (task_id,)
        )
        conn.commit()
        return cursor.rowcount > 0


def create_focus_session(task_id, task_title, kind, minutes):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO focus_sessions
                (task_id, task_title, kind, minutes)
            VALUES (?, ?, ?, ?)
            """,
            (task_id, task_title, kind, minutes)
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM focus_sessions WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()
        return dict(row)


def list_focus_sessions(since_utc, limit=50):
    """since_utc: 'YYYY-MM-DD HH:MM:SS' in UTC (CURRENT_TIMESTAMP form)."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM focus_sessions
            WHERE completed_at >= ?
            ORDER BY completed_at DESC, id DESC
            LIMIT ?
            """,
            (since_utc, limit)
        ).fetchall()
        return [dict(row) for row in rows]


# ---------- generic helpers for the workspace tables ----------

def _insert(table, fields):
    cols = list(fields)
    with get_connection() as conn:
        cur = conn.execute(
            f"INSERT INTO {table} ({', '.join(cols)}) "
            f"VALUES ({', '.join('?' for _ in cols)})",
            [fields[c] for c in cols]
        )
        conn.commit()
        return cur.lastrowid


def _update(table, row_id, fields, touch=True):
    cols = list(fields)
    if not cols:
        return True
    sets = ", ".join(f"{c} = ?" for c in cols)
    if touch:
        sets += ", updated_at = CURRENT_TIMESTAMP"
    with get_connection() as conn:
        cur = conn.execute(
            f"UPDATE {table} SET {sets} WHERE id = ?",
            [fields[c] for c in cols] + [row_id]
        )
        conn.commit()
        return cur.rowcount > 0


def _delete(table, row_id):
    with get_connection() as conn:
        cur = conn.execute(f"DELETE FROM {table} WHERE id = ?", (row_id,))
        conn.commit()
        return cur.rowcount > 0


# ---------- contacts (customers) ----------

CONTACT_SELECT = """
    SELECT contacts.*,
           businesses.name AS business_name,
           (SELECT COUNT(*) FROM tasks
             WHERE tasks.contact_id = contacts.id) AS record_count,
           (SELECT COUNT(*) FROM tasks
             WHERE tasks.contact_id = contacts.id
               AND tasks.status != 'completed') AS open_count,
           (SELECT COALESCE(SUM(tasks.amount - COALESCE(tasks.amount_paid, 0)), 0)
              FROM tasks
             WHERE tasks.contact_id = contacts.id
               AND tasks.payment_status IN ('unpaid', 'partial')
               AND tasks.amount IS NOT NULL) AS balance_due,
           (SELECT MAX(COALESCE(tasks.due_date, substr(tasks.created_at, 1, 10)))
              FROM tasks WHERE tasks.contact_id = contacts.id) AS last_activity
    FROM contacts
    LEFT JOIN businesses ON businesses.id = contacts.business_id
"""


def get_contact(contact_id):
    with get_connection() as conn:
        row = conn.execute(
            CONTACT_SELECT + " WHERE contacts.id = ?", (contact_id,)
        ).fetchone()
        return dict(row) if row else None


def list_contacts(business_id=None, q=None):
    filters, params = [], []
    if business_id is not None:
        # a customer belongs to a business if it's their home business or
        # they have any record there
        filters.append(
            "(contacts.business_id = ? OR EXISTS (SELECT 1 FROM tasks "
            "WHERE tasks.contact_id = contacts.id AND tasks.business_id = ?))"
        )
        params.extend([business_id, business_id])
    if q:
        pattern = like_pattern(q)
        filters.append(
            "(contacts.name LIKE ? ESCAPE '\\' OR contacts.phone LIKE ? ESCAPE '\\'"
            " OR contacts.email LIKE ? ESCAPE '\\' OR contacts.notes LIKE ? ESCAPE '\\')"
        )
        params.extend([pattern] * 4)
    where = (" WHERE " + " AND ".join(filters)) if filters else ""
    with get_connection() as conn:
        rows = conn.execute(
            CONTACT_SELECT + where + " ORDER BY lower(contacts.name)", params
        ).fetchall()
        return [dict(r) for r in rows]


def find_contact_by_name(name):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM contacts WHERE lower(trim(name)) = lower(trim(?)) "
            "ORDER BY id LIMIT 1",
            (name,)
        ).fetchone()
        return row["id"] if row else None


def create_contact(fields):
    return get_contact(_insert("contacts", fields))


def update_contact(contact_id, fields):
    if not _update("contacts", contact_id, fields, touch=False):
        return None
    # keep the denormalised customer text on linked records in sync
    if "name" in fields:
        with get_connection() as conn:
            conn.execute(
                "UPDATE tasks SET customer = ? WHERE contact_id = ?",
                (fields["name"], contact_id)
            )
            conn.commit()
    return get_contact(contact_id)


def delete_contact(contact_id):
    return _delete("contacts", contact_id)


# ---------- inventory ----------

INVENTORY_SELECT = """
    SELECT inventory.*,
           businesses.name AS business_name,
           (SELECT COUNT(*) FROM tasks
             WHERE tasks.inventory_id = inventory.id
               AND tasks.status != 'completed') AS open_records,
           (SELECT MIN(tasks.due_date) FROM tasks
             WHERE tasks.inventory_id = inventory.id
               AND tasks.kind = 'booking'
               AND tasks.status != 'completed'
               AND tasks.due_date >= ?) AS next_booking
    FROM inventory
    JOIN businesses ON businesses.id = inventory.business_id
"""


def get_inventory_item(item_id, today):
    with get_connection() as conn:
        row = conn.execute(
            INVENTORY_SELECT + " WHERE inventory.id = ?", (today, item_id)
        ).fetchone()
        return dict(row) if row else None


def list_inventory(today, business_id=None, q=None, low_only=False):
    filters, params = [], [today]
    if business_id is not None:
        filters.append("inventory.business_id = ?")
        params.append(business_id)
    if q:
        pattern = like_pattern(q)
        filters.append(
            "(inventory.name LIKE ? ESCAPE '\\' OR inventory.sku LIKE ? ESCAPE '\\'"
            " OR inventory.notes LIKE ? ESCAPE '\\')"
        )
        params.extend([pattern] * 3)
    if low_only:
        filters.append(
            "inventory.reorder_at IS NOT NULL "
            "AND inventory.quantity <= inventory.reorder_at"
        )
    where = (" WHERE " + " AND ".join(filters)) if filters else ""
    with get_connection() as conn:
        rows = conn.execute(
            INVENTORY_SELECT + where + " ORDER BY lower(inventory.name)",
            params
        ).fetchall()
        return [dict(r) for r in rows]


def create_inventory_item(fields, today):
    return get_inventory_item(_insert("inventory", fields), today)


def update_inventory_item(item_id, fields, today):
    if not _update("inventory", item_id, fields):
        return None
    return get_inventory_item(item_id, today)


def adjust_inventory_quantity(item_id, delta, today):
    with get_connection() as conn:
        cur = conn.execute(
            "UPDATE inventory SET quantity = MAX(0, quantity + ?), "
            "updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (delta, item_id)
        )
        conn.commit()
        if cur.rowcount == 0:
            return None
    return get_inventory_item(item_id, today)


def delete_inventory_item(item_id):
    return _delete("inventory", item_id)


# ---------- documents ----------

DOCUMENT_SELECT = """
    SELECT documents.*,
           businesses.name AS business_name,
           tasks.title AS task_title,
           contacts.name AS contact_name
    FROM documents
    JOIN businesses ON businesses.id = documents.business_id
    LEFT JOIN tasks ON tasks.id = documents.task_id
    LEFT JOIN contacts ON contacts.id = documents.contact_id
"""


def get_document(doc_id):
    with get_connection() as conn:
        row = conn.execute(
            DOCUMENT_SELECT + " WHERE documents.id = ?", (doc_id,)
        ).fetchone()
        return dict(row) if row else None


def list_documents(business_id=None, task_id=None, contact_id=None, q=None):
    filters, params = [], []
    for col, val in (
        ("documents.business_id", business_id),
        ("documents.task_id", task_id),
        ("documents.contact_id", contact_id),
    ):
        if val is not None:
            filters.append(f"{col} = ?")
            params.append(val)
    if q:
        pattern = like_pattern(q)
        filters.append(
            "(documents.title LIKE ? ESCAPE '\\' OR documents.body LIKE ? ESCAPE '\\'"
            " OR documents.file_name LIKE ? ESCAPE '\\')"
        )
        params.extend([pattern] * 3)
    where = (" WHERE " + " AND ".join(filters)) if filters else ""
    with get_connection() as conn:
        rows = conn.execute(
            DOCUMENT_SELECT + where
            + " ORDER BY documents.updated_at DESC, documents.id DESC",
            params
        ).fetchall()
        return [dict(r) for r in rows]


def create_document(fields):
    return get_document(_insert("documents", fields))


def update_document(doc_id, fields):
    if not _update("documents", doc_id, fields):
        return None
    return get_document(doc_id)


def delete_document(doc_id):
    return _delete("documents", doc_id)


def document_files_for_business(business_id):
    with get_connection() as conn:
        return [
            r["file_path"] for r in conn.execute(
                "SELECT file_path FROM documents "
                "WHERE business_id = ? AND file_path IS NOT NULL",
                (business_id,)
            )
        ]


# ---------- summary and search ----------

def money_summary(business_id=None):
    params = []
    where = (
        "WHERE tasks.payment_status IN ('unpaid', 'partial') "
        "AND tasks.amount IS NOT NULL"
    )
    if business_id is not None:
        where += " AND tasks.business_id = ?"
        params.append(business_id)
    with get_connection() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS count, "
            "COALESCE(SUM(tasks.amount - COALESCE(tasks.amount_paid, 0)), 0) "
            "AS outstanding FROM tasks " + where,
            params
        ).fetchone()
        return {"count": row["count"], "outstanding": round(row["outstanding"], 2)}


def search_all(q, limit=6):
    pattern = like_pattern(q)
    esc = "ESCAPE '\\'"
    with get_connection() as conn:
        def rows(sql, n):
            return [dict(r) for r in conn.execute(sql, [pattern] * n + [limit])]

        return {
            "records": rows(
                f"""SELECT tasks.id, tasks.title, tasks.kind, tasks.status,
                       tasks.due_date, tasks.business_id,
                       businesses.name AS business_name
                FROM tasks JOIN businesses ON businesses.id = tasks.business_id
                WHERE tasks.title LIKE ? {esc} OR tasks.notes LIKE ? {esc}
                   OR tasks.customer LIKE ? {esc} OR tasks.item LIKE ? {esc}
                ORDER BY CASE WHEN tasks.status != 'completed' THEN 0 ELSE 1 END,
                         tasks.id DESC
                LIMIT ?""", 4),
            "contacts": rows(
                f"""SELECT id, name, phone, email FROM contacts
                WHERE name LIKE ? {esc} OR phone LIKE ? {esc} OR email LIKE ? {esc}
                ORDER BY lower(name) LIMIT ?""", 3),
            "inventory": rows(
                f"""SELECT inventory.id, inventory.name, inventory.quantity,
                       inventory.business_id, businesses.name AS business_name
                FROM inventory JOIN businesses ON businesses.id = inventory.business_id
                WHERE inventory.name LIKE ? {esc} OR inventory.sku LIKE ? {esc}
                ORDER BY lower(inventory.name) LIMIT ?""", 2),
            "documents": rows(
                f"""SELECT documents.id, documents.title, documents.file_name,
                       documents.business_id, businesses.name AS business_name
                FROM documents JOIN businesses ON businesses.id = documents.business_id
                WHERE documents.title LIKE ? {esc} OR documents.body LIKE ? {esc}
                   OR documents.file_name LIKE ? {esc}
                ORDER BY documents.updated_at DESC LIMIT ?""", 3),
            "spaces": rows(
                f"""SELECT id, name, category FROM businesses
                WHERE name LIKE ? {esc} OR business_type LIKE ? {esc}
                ORDER BY lower(name) LIMIT ?""", 2),
        }
