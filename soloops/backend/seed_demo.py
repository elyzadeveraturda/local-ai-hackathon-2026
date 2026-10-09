"""Seed a demo SoloOps database with spaces and tasks.

Usage:
    python seed_demo.py --db demo.db
    SOLOOPS_DB_PATH=demo.db uvicorn main:app --port 8000

Creates a multi-space personal workspace with a real schedule
conflict today (Economics class vs Sony A7 IV pickup, both 16:00).
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

    T = [
        (college["id"], "Economics class", d(0), "16:00", "17:30",
         None, None, None, "Room 204"),
        (college["id"], "Economics study block", d(0), "09:00", "10:30",
         None, None, None, ""),
        (college["id"], "Submit Economics problem set", d(1), "23:59",
         None, None, None, None, ""),
        (college["id"], "Upload scholarship progress report", d(2),
         "17:00", None, None, None, None,
         "600 words + transcript"),
        (camera["id"], "Sony A7 IV pickup with Jamie", d(0), "16:00",
         "16:30", "Jamie Lee", "Sony A7 IV", 90, ""),
        (camera["id"], "Check Canon R6 on return", d(1), "11:00", None,
         "Sam Rivera", "Canon EOS R6", None, ""),
        (prop["id"], "Follow up on Unit C's overdue rent", d(-4), None,
         None, "Jordan Ellis", None, 1100, ""),
        (prop["id"], "Confirm Unit B's October payment", d(0), "11:30",
         "12:00", "Casey Park", None, 950, ""),
        (tiktok["id"], "Film 'student founder' clip", d(0), "14:00",
         "15:00", None, None, None, ""),
        (tiktok["id"], "Edit 'what's in my camera bag'", d(1), "15:00",
         None, None, None, None, ""),
        (personal["id"], "Dental appointment", d(3), "10:00", "11:00",
         None, None, None, ""),
        (personal["id"], "Organize important documents", None, None,
         None, None, None, None, ""),
    ]

    for (bid, title, date_, start, end, cust, item, amount, notes) in T:
        database.create_task(
            business_id=bid, title=title, customer=cust, item=item,
            due_date=date_, due_time=start, end_time=end,
            amount=amount, notes=notes,
        )

    print(
        f"Seeded {db_path}: 5 spaces, {len(T)} tasks "
        f"(today = {today})."
    )


if __name__ == "__main__":
    main()
