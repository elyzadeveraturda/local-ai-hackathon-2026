"""Seed a demo SoloOps database with spaces and tasks.

Usage:
    python seed_demo.py --db demo.db
    SOLOOPS_DB_PATH=demo.db uvicorn main:app --port 8000

Creates a multi-space workspace with a real schedule conflict today
(Economics class vs Sony A7 IV pickup, both 16:00), linked customers,
rental gear (one item double-booked, one low on stock), payments still
owed and a few documents.
Never deletes data; refuses to run on the real soloops.db unless
--allow-main-db is passed, and refuses non-empty databases.
"""

import argparse
import os
import sys
from datetime import timedelta
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
MAIN_DB = BACKEND / "soloops.db"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, help="SQLite DB path to seed")
    parser.add_argument(
        "--allow-main-db",
        action="store_true",
        help="allow seeding the real soloops.db",
    )
    args = parser.parse_args()

    db_path = Path(args.db).resolve()
    if db_path == MAIN_DB.resolve() and not args.allow_main_db:
        print(
            "Refusing to seed the real soloops.db. "
            "Pass --allow-main-db if you really mean it.",
            file=sys.stderr,
        )
        sys.exit(1)

    os.environ["SOLOOPS_DB_PATH"] = str(db_path)
    sys.path.insert(0, str(BACKEND))
    import database  # noqa: E402
    from attention import ph_today  # noqa: E402

    database.init_db()
    if database.list_businesses():
        print(
            f"Refusing to seed: {db_path} already has spaces.",
            file=sys.stderr,
        )
        sys.exit(1)

    today = ph_today()
    d = lambda n: (today + timedelta(days=n)).isoformat()  # noqa: E731

    college = database.create_business(
        "College & Scholarship", "Scholarship & Studies",
        "Classes, exams and merit scholarship renewal (GPA ≥ 3.50)",
        "Academic",
    )
    camera = database.create_business(
        "Camera Rental", "Camera Rental",
        "Renting cameras and lenses to students and creators",
        "Business",
    )
    prop = database.create_business(
        "Family Property", "Housing Rental",
        "Helping manage the family's 3-unit rental house",
        "Business",
    )
    tiktok = database.create_business(
        "TikTok Content", "TikTok",
        "Student-founder vlogs and camera gear videos",
        "Content Creation",
    )
    personal = database.create_business(
        "Personal Goals", "Personal",
        "Health, appointments and personal commitments",
        "Personal",
    )

    # customers and gear first, so records can link to them
    def contact(name, space, phone=None, email=None, notes=""):
        return database.create_contact({
            "name": name, "business_id": space["id"], "phone": phone,
            "email": email, "notes": notes,
        })["id"]

    jamie = contact("Jamie Lee", camera, "0917 555 0142",
                    notes="Film student, always returns on time")
    sam = contact("Sam Rivera", camera, email="sam.rivera@example.com")
    jordan = contact("Jordan Ellis", prop, "0918 555 0199",
                     notes="Unit C tenant")
    casey = contact("Casey Park", prop, notes="Unit B tenant")
    brand = contact("Lumen Studios", tiktok, email="collabs@example.com",
                    notes="Gear brand, paid collab")

    def item(space, name, qty, reorder=None, price=None, unit=None, sku=None):
        return database.create_inventory_item({
            "business_id": space["id"], "name": name, "quantity": qty,
            "reorder_at": reorder, "price": price, "unit": unit,
            "sku": sku, "notes": "",
        }, today.isoformat())["id"]

    a7 = item(camera, "Sony A7 IV", 1, price=1500, sku="CAM-A7")
    r6 = item(camera, "Canon EOS R6", 1, price=1400, sku="CAM-R6")
    item(camera, "50mm f/1.8 lens", 3, reorder=1, price=350, sku="LNS-50")
    item(camera, "NP-FZ100 battery", 1, reorder=2, unit="pcs", sku="BAT-FZ")
    item(prop, "Spare unit keys", 2, reorder=2, unit="sets")

    T = [
        dict(business_id=college["id"], title="Economics class",
             kind="event", due_date=d(0), due_time="16:00",
             end_time="17:30", notes="Room 204"),
        dict(business_id=college["id"], title="Economics study block",
             kind="event", due_date=d(0), due_time="09:00",
             end_time="10:30"),
        dict(business_id=college["id"],
             title="Submit Economics problem set", kind="deadline",
             due_date=d(1), due_time="23:59"),
        dict(business_id=college["id"],
             title="Upload scholarship progress report", kind="deadline",
             due_date=d(2), due_time="17:00", importance="high",
             notes="600 words + transcript", status="in_progress"),
        dict(business_id=camera["id"], title="Sony A7 IV pickup with Jamie",
             kind="booking", due_date=d(0), due_time="16:00",
             end_time="16:30", customer="Jamie Lee", contact_id=jamie,
             item="Sony A7 IV", inventory_id=a7, amount=1500,
             payment_status="partial", amount_paid=500),
        dict(business_id=camera["id"], title="Weekend shoot rental",
             kind="booking", due_date=d(0), customer="Sam Rivera",
             contact_id=sam, item="Sony A7 IV", inventory_id=a7,
             amount=1500, payment_status="unpaid",
             notes="Wants it for the whole day — clashes with Jamie"),
        dict(business_id=camera["id"], title="Check Canon R6 on return",
             due_date=d(1), due_time="11:00", customer="Sam Rivera",
             contact_id=sam, item="Canon EOS R6", inventory_id=r6),
        dict(business_id=camera["id"], title="Reorder camera batteries",
             due_date=d(2)),
        dict(business_id=prop["id"],
             title="Unit C rent — October", kind="payment",
             due_date=d(-4), customer="Jordan Ellis", contact_id=jordan,
             amount=1100, payment_status="unpaid", importance="high"),
        dict(business_id=prop["id"], title="Unit B rent — October",
             kind="payment", due_date=d(0), due_time="11:30",
             end_time="12:00", customer="Casey Park", contact_id=casey,
             amount=950, payment_status="paid", amount_paid=950,
             status="completed"),
        dict(business_id=tiktok["id"], title="Film 'student founder' clip",
             due_date=d(0), due_time="14:00", end_time="15:00"),
        dict(business_id=tiktok["id"],
             title="Lumen Studios sponsored video", kind="payment",
             due_date=d(10), customer="Lumen Studios", contact_id=brand,
             amount=5000, payment_status="partial", amount_paid=2000,
             status="in_progress"),
        dict(business_id=tiktok["id"],
             title="Edit 'what's in my camera bag'", due_date=d(1),
             due_time="15:00"),
        dict(business_id=personal["id"], title="Dental appointment",
             kind="event", due_date=d(3), due_time="10:00",
             end_time="11:00"),
        dict(business_id=personal["id"],
             title="Organize important documents"),
    ]

    created = [database.create_task(**t) for t in T]
    by_title = {t["title"]: t for t in created}

    def doc(space, title, body, task=None, contact_id=None):
        database.create_document({
            "business_id": space["id"], "title": title, "body": body,
            "task_id": by_title[task]["id"] if task else None,
            "contact_id": contact_id,
        })

    doc(camera, "Rental terms",
        "Deposit 50% on booking, balance on pickup. Valid ID required. "
        "Late returns ₱300/day.")
    doc(camera, "Jamie — ID and deposit receipt",
        "Student ID checked. ₱500 deposit via GCash.",
        task="Sony A7 IV pickup with Jamie", contact_id=jamie)
    doc(prop, "Unit C lease", "12-month lease, rent due on the 15th.",
        task="Unit C rent — October", contact_id=jordan)
    doc(tiktok, "Lumen Studios brief",
        "60-second review, 2 revisions, posting window next week.",
        task="Lumen Studios sponsored video", contact_id=brand)

    print(
        f"Seeded {db_path}: 5 spaces, {len(T)} records, 5 customers, "
        f"5 inventory items, 4 documents (today = {today})."
    )


if __name__ == "__main__":
    main()
