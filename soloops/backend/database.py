
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
