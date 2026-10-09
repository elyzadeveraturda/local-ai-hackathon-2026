
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "soloops.db"


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
    

def create_task(
    business_id, title, customer=None, item=None,
    due_date=None, amount=None, notes=""
):
    with get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO tasks
            (business_id, title, customer, item,
             due_date, amount, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            business_id, title, customer, item,
            due_date, amount, notes
        ))
        conn.commit()
        task_id = cursor.lastrowid

    return get_task(task_id)


def get_task(task_id):
    with get_connection() as conn:
        row = conn.execute("""
            SELECT * FROM tasks WHERE id = ?
        """, (task_id,)).fetchone()
        return dict(row) if row else None


def list_tasks():
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT tasks.*, businesses.name AS business_name
            FROM tasks
            JOIN businesses ON businesses.id = tasks.business_id
            ORDER BY
                CASE WHEN tasks.status = 'pending' THEN 0 ELSE 1 END,
                CASE WHEN tasks.due_date IS NULL THEN 1 ELSE 0 END,
                tasks.due_date ASC,
                tasks.id DESC
        """).fetchall()
        return [dict(row) for row in rows]


def complete_task(task_id):
    with get_connection() as conn:
        cursor = conn.execute("""
            UPDATE tasks
            SET status = 'completed'
            WHERE id = ?
        """, (task_id,))
        conn.commit()
        return cursor.rowcount > 0

