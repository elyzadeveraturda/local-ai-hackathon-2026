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
        business = database.get_business(1)
    assert tasks[0]["title"] == "Keep me"
    assert "due_time" in tasks[0]
    # category migration: existing rows default to 'Business'
    assert business["category"] == "Business"
    # tasks keep their space link and expose the category
    assert tasks[0]["business_id"] == 1
    assert tasks[0]["business_name"] == "Old"
    assert tasks[0]["space_category"] == "Business"


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
        "title": "Confirm order",
        "person": {"name": "Ana Cruz"},
        "subject": "Ube cake",
        "due_date": "2026-10-16",
        "due_time": "9:05 AM",
        "amount": "PHP 1,250",
        "notes": "pickup",
    }
    message = "Ana Cruz ordered an ube cake for 2026-10-16 at 9am, 1250 pesos"
    with patch.object(main.requests, "post", return_value=FakeResponse(ai)):
        r = client.post("/extract/message", json={
            "business_id": bid, "message": message
        })
    data = r.json()
    assert data["person"] == "Ana Cruz"
    assert data["subject"] == "Ube cake"
    assert data["title"] == "Confirm order"
    assert data["due_date"] == "2026-10-16"
    assert data["due_time"] == "09:05"
    assert data["amount"] == 1250.0
    assert data["notes"] == "pickup"
    assert data["business_id"] == bid
    assert data["space_id"] == bid
    assert data["requires_confirmation"] is True


def test_extraction_legacy_keys_fallback(client):
    bid = make_business(client)
    ai = {
        "record_type": "booking_request",
        "customer": "Maria",
        "item": "Camera",
        "requested_date": "2026-10-17",
        "requested_time": "15:00",
        "action_required": "Confirm camera booking",
    }
    message = "Maria wants to rent the camera on 2026-10-17 at 15:00"
    with patch.object(main.requests, "post", return_value=FakeResponse(ai)):
        r = client.post("/extract/message", json={
            "business_id": bid, "message": message
        })
    data = r.json()
    assert data["person"] == "Maria"
    assert data["subject"] == "Camera"
    assert data["due_date"] == "2026-10-17"
    assert data["due_time"] == "15:00"
    assert data["title"] == "Confirm camera booking"


def test_extraction_guards(client):
    bid = make_business(client)
    # no date cue in message -> due_date forced to None
    ai = {
        "record_type": "task", "title": "Do thing",
        "person": "Ghost", "subject": "x",
        "due_date": "2026-10-20", "due_time": "10:00",
        "amount": 500, "notes": None,
    }
    with patch.object(main.requests, "post", return_value=FakeResponse(ai)):
        data = client.post("/extract/message", json={
            "business_id": bid, "message": "please handle the paperwork"
        }).json()
    assert data["due_date"] is None
    assert data["due_time"] is None
    assert data["amount"] is None  # no digit in message
    assert data["person"] is None  # "Ghost" not in text

    # with cues present, values pass through
    msg = "Maria wants to rent the camera on Saturday at 3 PM for 200"
    ai2 = dict(ai, person="Maria", due_date="2026-10-10",
               due_time="15:00", amount=200)
    with patch.object(main.requests, "post", return_value=FakeResponse(ai2)):
        data = client.post("/extract/message", json={
            "business_id": bid, "message": msg
        }).json()
    assert data["due_date"] == "2026-10-10"
    assert data["due_time"] == "15:00"
    assert data["amount"] == 200
    assert data["person"] == "Maria"


def test_extraction_guard_helpers():
    assert main.has_date_cue("submit it tomorrow")
    assert main.has_date_cue("due on Fri")
    assert main.has_date_cue("by October 15")
    assert main.has_date_cue("next week")
    assert not main.has_date_cue("call the landlord sometime")
    assert main.has_time_cue("at 3 pm")
    assert main.has_time_cue("in the morning")
    assert not main.has_time_cue("whenever you can")
    assert main.person_in_message("Maria Cruz", "Maria wants a camera")
    assert not main.person_in_message("Bob", "Maria wants a camera")


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
        assert "Start Ollama" in r.json()["detail"]
        assert client.post("/chat", json={"message": "hi"}).status_code == 503


class ChatResponse(FakeResponse):
    def json(self):
        return {"response": "ok"}


def capture_chat(client, payload):
    captured = {}

    def fake_post(url, json=None, timeout=None):
        captured["prompt"] = json["prompt"]
        return ChatResponse({})

    with patch.object(main.requests, "post", side_effect=fake_post):
        response = client.post("/chat", json=payload)
    return response, captured


def test_chat_prompt_states_overdue_explicitly(client):
    bid = make_business(client)
    client.post("/tasks", json={
        "business_id": bid, "title": "Old", "due_date": "2000-01-01"
    })
    response, captured = capture_chat(client, {"message": "hi"})
    data = response.json()
    assert data["reply"] == "ok"
    assert data["scope"] == "all"
    assert data["space_name"] is None
    assert data["sources"]["spaces"] == ["Bake Shop"]
    assert data["sources"]["task_count"] == 1
    assert "2000-01-01 (OVERDUE by" in captured["prompt"]


def test_chat_space_scope(client):
    bid = make_business(client)
    other = make_business(client, name="TikTok", btype="Content")
    client.post("/tasks", json={
        "business_id": bid, "title": "Bake task"
    })
    client.post("/tasks", json={
        "business_id": other, "title": "Edit TikTok video"
    })
    response, captured = capture_chat(
        client, {"message": "what now", "space_id": other}
    )
    data = response.json()
    assert data["scope"] == "space"
    assert data["space_name"] == "TikTok"
    assert data["sources"]["spaces"] == ["TikTok"]
    assert "Edit TikTok video" in captured["prompt"]
    assert "Bake task" not in captured["prompt"]

    r, _ = capture_chat(client, {"message": "hi", "space_id": 999})
    assert r.status_code == 404
    assert r.json()["detail"] == "Space not found"


def test_space_categories(client):
    for category in main.SPACE_CATEGORIES:
        r = client.post("/businesses", json={
            "name": f"{category} space", "business_type": "Type",
            "category": category,
        })
        assert r.status_code == 201, r.text
        assert r.json()["category"] == category

    # default keeps old clients working
    r = client.post("/businesses", json={
        "name": "Legacy", "business_type": "Shop",
    })
    assert r.status_code == 201
    assert r.json()["category"] == "Business"

    # invalid category rejected
    r = client.post("/businesses", json={
        "name": "Bad", "business_type": "X", "category": "Wizardry",
    })
    assert r.status_code == 422

    # not-found wording
    assert client.get("/businesses/999").status_code == 404
    assert client.get("/businesses/999").json()["detail"] == "Space not found"


def test_fallback_plan_categories(client):
    academic = make_business(client, name="College", btype="Scholarship")
    client.put(f"/businesses/{academic}", json={
        "name": "College", "business_type": "Scholarship",
        "category": "Academic", "description": "",
    })
    tid = client.post("/tasks", json={
        "business_id": academic, "title": "Submit renewal",
    }).json()["id"]
    plan = main.fallback_plan(main.get_task(tid))
    assert plan["source"] == "fallback"
    assert any("materials or documents" in s for s in plan["steps"])
    assert plan["steps"][0].startswith("Review the details and notes")

    content = make_business(client, name="TikTok", btype="Content")
    client.put(f"/businesses/{content}", json={
        "name": "TikTok", "business_type": "Content",
        "category": "Content Creation", "description": "",
    })
    tid = client.post("/tasks", json={
        "business_id": content, "title": "Edit video",
    }).json()["id"]
    plan = main.fallback_plan(main.get_task(tid))
    assert any("publishing" in s for s in plan["steps"])

    # get_task rows carry the space category
    task = client.get(f"/tasks/{tid}").json()
    assert task["space_category"] == "Content Creation"


def test_resolve_relative_date():
    t = date(2026, 10, 9)  # Friday
    assert main.resolve_relative_date(
        "Schedule my dental appointment next Tuesday.", t
    ) == "2026-10-13"
    assert main.resolve_relative_date(
        "finish editing by Friday", t
    ) == "2026-10-16"
    assert main.resolve_relative_date(
        "rent the camera on Saturday at 3 PM", t
    ) == "2026-10-10"
    assert main.resolve_relative_date("do it tomorrow", t) == "2026-10-10"
    assert main.resolve_relative_date("do it today", t) == "2026-10-09"
    # explicit dates are left to the model
    assert main.resolve_relative_date(
        "submit on October 15", t
    ) is None
    assert main.resolve_relative_date("due 10/15", t) is None
    assert main.resolve_relative_date("due 2026-10-15", t) is None
    # no cue
    assert main.resolve_relative_date("submit report", t) is None


def test_clean_title():
    assert main.clean_title(
        "Schedule my dental appointment next Tuesday."
    ) == "Schedule my dental appointment"
    assert main.clean_title(
        "Finish editing TikTok video by Friday"
    ) == "Finish editing TikTok video"
    assert main.clean_title(
        "Rent the camera on Saturday at 3 PM"
    ) == "Rent the camera"
    assert main.clean_title("Call Maria") == "Call Maria"
    # empty result keeps original
    assert main.clean_title("Friday") == "Friday"


def test_extraction_corrects_wrong_weekday_date(client):
    bid = make_business(client)
    ai = {
        "record_type": "appointment",
        "title": "Schedule my dental appointment next Tuesday.",
        "person": None, "subject": "Dental appointment",
        "due_date": "2026-10-20", "due_time": None,
        "amount": None, "notes": None,
    }
    message = "Schedule my dental appointment next Tuesday."
    with patch.object(main, "ph_today", return_value=date(2026, 10, 9)):
        with patch.object(
            main.requests, "post", return_value=FakeResponse(ai)
        ):
            data = client.post("/extract/message", json={
                "business_id": bid, "message": message
            }).json()
    assert data["due_date"] == "2026-10-13"
    assert data["title"] == "Schedule my dental appointment"
