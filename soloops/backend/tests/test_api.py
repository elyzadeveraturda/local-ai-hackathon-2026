import json
import os
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

_tmp = tempfile.mkdtemp()
os.environ["SOLOOPS_DB_PATH"] = str(Path(_tmp) / "test.db")

from fastapi.testclient import TestClient  # noqa: E402

import database  # noqa: E402
import main  # noqa: E402
from attention import build_attention  # noqa: E402


@pytest.fixture
def client():
    db = Path(os.environ["SOLOOPS_DB_PATH"])
    if db.exists():
        db.unlink()
    with TestClient(main.app) as c:
        yield c


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return {"response": json.dumps(self.payload)}


def make_business(client, name="Bake Shop", btype="Food business"):
    r = client.post("/businesses", json={
        "name": name, "business_type": btype, "description": "Cakes"
    })
    assert r.status_code == 201
    return r.json()["id"]


def test_task_crud_and_complete(client):
    bid = make_business(client)
    r = client.post("/tasks", json={
        "business_id": bid, "title": "Confirm cake order",
        "customer": "Ana", "due_date": "2026-10-12",
        "due_time": "14:30", "amount": 1500, "notes": "msg"
    })
    assert r.status_code == 201, r.text
    task = r.json()
    assert task["business_id"] == bid
    assert task["business_name"] == "Bake Shop"
    assert task["due_time"] == "14:30"
    assert task["status"] == "pending"

    r = client.patch(f"/tasks/{task['id']}/complete")
    assert r.status_code == 200
    assert client.get(f"/tasks/{task['id']}").json()["status"] == "completed"
    assert client.patch("/tasks/9999/complete").status_code == 404


def test_task_validation_and_duplicates(client):
    bid = make_business(client)
    assert client.post("/tasks", json={
        "business_id": 999, "title": "x"
    }).status_code == 404
    assert client.post("/tasks", json={
        "business_id": bid, "title": "   "
    }).status_code == 400
    assert client.post("/tasks", json={
        "business_id": bid, "title": "x", "due_date": "tomorrow"
    }).status_code == 422
    assert client.post("/tasks", json={
        "business_id": bid, "title": "x", "due_time": "25:00"
    }).status_code == 422

    payload = {"business_id": bid, "title": "Call Ben", "notes": "hi"}
    assert client.post("/tasks", json=payload).status_code == 201
    assert client.post("/tasks", json=payload).status_code == 409


def test_persistence_survives_restart(client):
    bid = make_business(client)
    client.post("/tasks", json={"business_id": bid, "title": "Persist me"})
    with TestClient(main.app) as c2:
        titles = [t["title"] for t in c2.get("/tasks").json()]
    assert "Persist me" in titles


def test_migration_adds_due_time_to_legacy_db(tmp_path):
    import sqlite3
    legacy = tmp_path / "legacy.db"
    conn = sqlite3.connect(legacy)
    conn.execute("CREATE TABLE businesses (id INTEGER PRIMARY KEY, name TEXT, business_type TEXT, description TEXT, created_at TEXT)")
    conn.execute("CREATE TABLE tasks (id INTEGER PRIMARY KEY, business_id INTEGER, title TEXT, customer TEXT, item TEXT, due_date TEXT, amount REAL, notes TEXT, status TEXT DEFAULT 'pending', created_at TEXT)")
    conn.execute("INSERT INTO businesses VALUES (1,'Old','Shop','',NULL)")
    conn.execute("INSERT INTO tasks (business_id,title) VALUES (1,'Keep me')")
    conn.commit()
    conn.close()
    with patch.object(database, "DB_PATH", legacy):
        database.init_db()
        tasks = database.list_tasks()
    assert tasks[0]["title"] == "Keep me"
    assert "due_time" in tasks[0]


def test_attention_priority_buckets():
    today = date(2026, 10, 10)
    d = lambda n: (today + timedelta(days=n)).isoformat()  # noqa: E731
    tasks = [
        {"id": 1, "title": "later", "due_date": d(10), "status": "pending"},
        {"id": 2, "title": "none", "due_date": None, "status": "pending"},
        {"id": 3, "title": "overdue", "due_date": d(-1), "status": "pending"},
        {"id": 4, "title": "today", "due_date": d(0), "status": "pending"},
        {"id": 5, "title": "soon", "due_date": d(3), "status": "pending"},
        {"id": 6, "title": "done", "due_date": d(-5), "status": "completed"},
    ]
    result = build_attention(tasks, today)
    assert [t["title"] for t in result["tasks"]] == [
        "overdue", "today", "soon", "later", "none"
    ]
    assert result["counts"] == {
        "pending": 5, "overdue": 1, "due_today": 1, "upcoming": 1,
        "later": 1, "no_date": 1, "completed": 1,
    }
    assert result["completed"][0]["title"] == "done"


def test_attention_endpoint(client):
    bid = make_business(client)
    client.post("/tasks", json={
        "business_id": bid, "title": "Old", "due_date": "2000-01-01"
    })
    data = client.get("/attention").json()
    assert data["counts"]["overdue"] == 1
    assert data["tasks"][0]["business_name"] == "Bake Shop"
    assert data["timezone"] == "Asia/Manila"


def test_lock_in_plan_ai_and_fallback(client):
    bid = make_business(client)
    tid = client.post("/tasks", json={
        "business_id": bid, "title": "Confirm order", "customer": "Ana",
        "amount": 500,
    }).json()["id"]

    ai = {"goal": "Confirm Ana's order", "steps": ["Check", "Reply"]}
    with patch.object(main.requests, "post", return_value=FakeResponse(ai)):
        r = client.post("/lock-in/plan", json={"task_id": tid})
    assert r.json() == {**ai, "source": "ai"}

    with patch.object(
        main.requests, "post",
        side_effect=main.requests.ConnectionError("offline"),
    ):
        plan = client.post("/lock-in/plan", json={"task_id": tid}).json()
    assert plan["source"] == "fallback"
    assert plan["goal"] == "Confirm order"
    assert any("Ana" in s for s in plan["steps"])

    assert client.post("/lock-in/plan", json={"task_id": 999}).status_code == 404


def test_extraction_normalizes_fields(client):
    bid = make_business(client)
    ai = {
        "record_type": "order_request",
        "customer": {"name": "Ana Cruz"},
        "item": "Ube cake",
        "requested_date": "next Friday",
        "requested_time": "9:05 AM",
        "amount": "PHP 1,250",
        "action_required": "Confirm order",
    }
    with patch.object(main.requests, "post", return_value=FakeResponse(ai)):
        r = client.post("/extract/message", json={
            "business_id": bid, "message": "hello"
        })
    data = r.json()
    assert data["customer"] == "Ana Cruz"
    assert data["requested_date"] is None
    assert data["requested_time"] == "09:05"
    assert data["amount"] == 1250.0
    assert data["business_id"] == bid


def test_ollama_down_is_graceful(client):
    bid = make_business(client)
    with patch.object(
        main.requests, "post",
        side_effect=main.requests.ConnectionError("offline"),
    ):
        r = client.post("/extract/message", json={
            "business_id": bid, "message": "hello"
        })
        assert r.status_code == 503
        assert client.post("/chat", json={"message": "hi"}).status_code == 503
