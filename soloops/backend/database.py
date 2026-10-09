
import os
import sqlite3
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

        task_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(tasks)")
        }
        if "due_time" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN due_time TEXT")

        conn.commit()


def list_businesses():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM businesses ORDER BY id DESC"
        ).fetchall()
        return [dict(row) for row in rows]


def get_business(business_id):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM businesses WHERE id = ?",
            (business_id,)
        ).fetchone()
        return dict(row) if row else None


def create_business(name, business_type, description):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO businesses
                (name, business_type, description)
            VALUES (?, ?, ?)
            """,
            (name, business_type, description)
        )
        business_id = cursor.lastrowid
        conn.commit()

    return get_business(business_id)


def update_business(
    business_id, name, business_type, description
):
    with get_connection() as conn:
        cursor = conn.execute(
            """
            UPDATE businesses
            SET name = ?, business_type = ?, description = ?
            WHERE id = ?
            """,
            (name, business_type, description, business_id)
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
           businesses.description AS business_description
    FROM tasks
    JOIN businesses ON businesses.id = tasks.business_id
"""


def create_task(
    business_id, title, customer=None, item=None,
    due_date=None, amount=None, notes="", due_time=None
):
    with get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO tasks
            (business_id, title, customer, item,
             due_date, due_time, amount, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            business_id, title, customer, item,
            due_date, due_time, amount, notes
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
              AND status = 'pending'
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


def list_tasks(status=None, business_id=None):
    filters = []
    params = []
    if status:
        filters.append("tasks.status = ?")
        params.append(status)
    if business_id is not None:
        filters.append("tasks.business_id = ?")
        params.append(business_id)
    where = (" WHERE " + " AND ".join(filters)) if filters else ""

    with get_connection() as conn:
        rows = conn.execute(TASK_SELECT + where + """
            ORDER BY
                CASE WHEN tasks.status = 'pending' THEN 0 ELSE 1 END,
                CASE WHEN tasks.due_date IS NULL THEN 1 ELSE 0 END,
                tasks.due_date ASC,
                tasks.due_time ASC,
                tasks.id DESC
        """, params).fetchall()
        return [dict(row) for row in rows]


def set_task_status(task_id, status):
    with get_connection() as conn:
        cursor = conn.execute(
            "UPDATE tasks SET status = ? WHERE id = ?",
            (status, task_id)
        )
        conn.commit()
        return cursor.rowcount > 0


def complete_task(task_id):
    return set_task_status(task_id, "completed")
