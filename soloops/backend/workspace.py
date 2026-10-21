"""Customers, inventory, documents, search and summary endpoints.

Records (tasks) stay in main.py; this module holds the business data
that records link to, plus the space "modules" (which tabs a space shows).
"""

import base64
import binascii
import json
import mimetypes
import re
import shutil
import uuid
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from attention import ph_today
from database import (
    DB_PATH,
    adjust_inventory_quantity,
    backup_db,
    create_contact,
    create_document,
    create_inventory_item,
    delete_contact,
    delete_document,
    delete_inventory_item,
    get_business,
    get_contact,
    get_document,
    get_inventory_item,
    get_task,
    list_contacts,
    list_documents,
    list_inventory,
    money_summary,
    search_all,
    update_contact,
    update_document,
    update_inventory_item,
)

router = APIRouter()

# ---------- space modules ----------

MODULES = ("work", "payments", "customers", "inventory", "documents")
Module = Literal["work", "payments", "customers", "inventory", "documents"]

DEFAULT_MODULES = {
    "Business": list(MODULES),
    "Content Creation": ["work", "payments", "customers", "documents"],
    "Academic": ["work", "documents"],
    "Personal": ["work", "documents"],
    "Custom": ["work", "documents"],
}


def resolve_modules(raw, category):
    try:
        chosen = json.loads(raw) if raw else None
    except (TypeError, ValueError):
        chosen = None
    if not isinstance(chosen, list):
        chosen = DEFAULT_MODULES.get(category or "Business", ["work"])
    # keep the canonical order; "work" is always on
    picked = {m for m in chosen if m in MODULES} | {"work"}
    return [m for m in MODULES if m in picked]


def encode_modules(modules, category):
    """None keeps the category defaults (stored as NULL)."""
    if modules is None:
        return None
    return json.dumps(resolve_modules(json.dumps(list(modules)), category))


def present_business(business):
    if business is None:
        return None
    return {
        **business,
        "modules": resolve_modules(
            business.get("modules"), business.get("category")
        ),
    }


def require_business(business_id):
    business = get_business(business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Space not found")
    return business


def clean(value):
    if value is None:
        return None
    value = value.strip()
    return value or None


# ---------- files on disk ----------

FILES_DIR = DB_PATH.parent / "files"
TRASH_DIR = FILES_DIR / ".trash"
MAX_FILE_BYTES = 10 * 1024 * 1024

# opened in the browser; anything else is always downloaded
INLINE_TYPES = {
    "application/pdf", "image/png", "image/jpeg", "image/gif",
    "image/webp", "text/plain",
}


def _safe_ext(name):
    ext = Path(name).suffix.lower()
    return ext if re.fullmatch(r"\.[a-z0-9]{1,8}", ext) else ""


def store_file(file_name, content_base64):
    try:
        data = base64.b64decode(content_base64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="The file could not be read.")
    if not data:
        raise HTTPException(status_code=400, detail="The file is empty.")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413, detail="Files can be up to 10 MB."
        )
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{_safe_ext(file_name)}"
    (FILES_DIR / stored).write_bytes(data)
    file_type = mimetypes.guess_type(file_name)[0] or "application/octet-stream"
    return {
        "file_name": Path(file_name).name[:200] or "file",
        "file_path": stored,
        "file_type": file_type,
        "file_size": len(data),
    }


def trash_file(stored):
    """Move a stored file aside instead of deleting it, so a database
    backup taken before the delete still has its file."""
    if not stored or "/" in stored or "\\" in stored or stored.startswith("."):
        return
    src = FILES_DIR / stored
    if src.is_file():
        TRASH_DIR.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(TRASH_DIR / stored))


# ---------- customers ----------

class ContactInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=60)
    email: Optional[str] = Field(default=None, max_length=200)
    business_id: Optional[int] = None
    notes: str = Field(default="", max_length=5000)


def _contact_fields(data):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    if data.business_id is not None:
        require_business(data.business_id)
    email = clean(data.email)
    if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=400, detail="That email doesn't look right")
    return {
        "name": name,
        "phone": clean(data.phone),
        "email": email,
        "business_id": data.business_id,
        "notes": data.notes.strip(),
    }


@router.get("/contacts")
def contacts(business_id: Optional[int] = None, q: Optional[str] = None):
    return list_contacts(business_id=business_id, q=clean(q))


@router.get("/contacts/{contact_id}")
def contact(contact_id: int):
    found = get_contact(contact_id)
    if not found:
        raise HTTPException(status_code=404, detail="Customer not found")
    return found


@router.post("/contacts", status_code=201)
def add_contact(data: ContactInput):
    return create_contact(_contact_fields(data))


@router.put("/contacts/{contact_id}")
def edit_contact(contact_id: int, data: ContactInput):
    updated = update_contact(contact_id, _contact_fields(data))
    if not updated:
        raise HTTPException(status_code=404, detail="Customer not found")
    return updated


@router.delete("/contacts/{contact_id}")
def remove_contact(contact_id: int):
    if not get_contact(contact_id):
        raise HTTPException(status_code=404, detail="Customer not found")
    backup_db(f"before-delete-customer-{contact_id}")
    delete_contact(contact_id)  # linked records keep the name as text
    return {"message": "Customer deleted"}


# ---------- inventory ----------

class InventoryInput(BaseModel):
    business_id: int
    name: str = Field(min_length=1, max_length=150)
    sku: Optional[str] = Field(default=None, max_length=60)
    quantity: int = Field(default=0, ge=0, le=1_000_000)
    unit: Optional[str] = Field(default=None, max_length=30)
    reorder_at: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    price: Optional[float] = Field(default=None, ge=0)
    notes: str = Field(default="", max_length=5000)


class AdjustInput(BaseModel):
    delta: int = Field(ge=-1_000_000, le=1_000_000)


def _inventory_fields(data):
    require_business(data.business_id)
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    return {
        "business_id": data.business_id,
        "name": name,
        "sku": clean(data.sku),
        "quantity": data.quantity,
        "unit": clean(data.unit),
        "reorder_at": data.reorder_at,
        "price": data.price,
        "notes": data.notes.strip(),
    }


@router.get("/inventory")
def inventory(
    business_id: Optional[int] = None,
    q: Optional[str] = None,
    low: bool = False,
):
    return list_inventory(
        ph_today().isoformat(), business_id=business_id, q=clean(q),
        low_only=low,
    )


@router.get("/inventory/{item_id}")
def inventory_item(item_id: int):
    found = get_inventory_item(item_id, ph_today().isoformat())
    if not found:
        raise HTTPException(status_code=404, detail="Item not found")
    return found


@router.post("/inventory", status_code=201)
def add_inventory_item(data: InventoryInput):
    return create_inventory_item(_inventory_fields(data), ph_today().isoformat())


@router.put("/inventory/{item_id}")
def edit_inventory_item(item_id: int, data: InventoryInput):
    updated = update_inventory_item(
        item_id, _inventory_fields(data), ph_today().isoformat()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated


@router.patch("/inventory/{item_id}/adjust")
def adjust_inventory(item_id: int, data: AdjustInput):
    updated = adjust_inventory_quantity(
        item_id, data.delta, ph_today().isoformat()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated


@router.delete("/inventory/{item_id}")
def remove_inventory_item(item_id: int):
    if not get_inventory_item(item_id, ph_today().isoformat()):
        raise HTTPException(status_code=404, detail="Item not found")
    backup_db(f"before-delete-item-{item_id}")
    delete_inventory_item(item_id)  # linked records keep the item text
    return {"message": "Item deleted"}


# ---------- documents ----------

class DocumentInput(BaseModel):
    business_id: int
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=50_000)
    task_id: Optional[int] = None
    contact_id: Optional[int] = None
    file_name: Optional[str] = Field(default=None, max_length=255)
    # base64 file content; omit to keep the current file
    file_content: Optional[str] = Field(default=None, max_length=14_500_000)
    remove_file: bool = False


def _document_fields(data):
    require_business(data.business_id)
    title = data.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    if data.task_id is not None:
        task = get_task(data.task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Linked record not found")
        if task["business_id"] != data.business_id:
            raise HTTPException(
                status_code=400,
                detail="The linked record belongs to a different space",
            )
    if data.contact_id is not None and not get_contact(data.contact_id):
        raise HTTPException(status_code=404, detail="Customer not found")
    return {
        "business_id": data.business_id,
        "title": title,
        "body": data.body,
        "task_id": data.task_id,
        "contact_id": data.contact_id,
    }


@router.get("/documents")
def documents(
    business_id: Optional[int] = None,
    task_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    q: Optional[str] = None,
):
    return list_documents(
        business_id=business_id, task_id=task_id, contact_id=contact_id,
        q=clean(q),
    )


@router.get("/documents/{doc_id}")
def document(doc_id: int):
    found = get_document(doc_id)
    if not found:
        raise HTTPException(status_code=404, detail="Document not found")
    return found


@router.post("/documents", status_code=201)
def add_document(data: DocumentInput):
    fields = _document_fields(data)
    if data.file_content:
        fields.update(store_file(data.file_name or "file", data.file_content))
    return create_document(fields)


@router.put("/documents/{doc_id}")
def edit_document(doc_id: int, data: DocumentInput):
    current = get_document(doc_id)
    if not current:
        raise HTTPException(status_code=404, detail="Document not found")
    fields = _document_fields(data)
    if data.file_content:
        fields.update(store_file(data.file_name or "file", data.file_content))
        trash_file(current.get("file_path"))
    elif data.remove_file:
        fields.update(
            file_name=None, file_path=None, file_type=None, file_size=None
        )
        trash_file(current.get("file_path"))
    return update_document(doc_id, fields)


@router.delete("/documents/{doc_id}")
def remove_document(doc_id: int):
    current = get_document(doc_id)
    if not current:
        raise HTTPException(status_code=404, detail="Document not found")
    backup_db(f"before-delete-document-{doc_id}")
    delete_document(doc_id)
    trash_file(current.get("file_path"))
    return {"message": "Document deleted"}


@router.get("/documents/{doc_id}/file")
def document_file(doc_id: int, download: bool = False):
    current = get_document(doc_id)
    stored = current and current.get("file_path")
    if not stored or "/" in stored or "\\" in stored:
        raise HTTPException(status_code=404, detail="No file attached")
    path = FILES_DIR / stored
    if not path.is_file():
        raise HTTPException(status_code=404, detail="The file is missing")
    file_type = current.get("file_type") or "application/octet-stream"
    inline = file_type in INLINE_TYPES and not download
    return FileResponse(
        path,
        media_type=file_type if inline else "application/octet-stream",
        filename=current.get("file_name") or stored,
        content_disposition_type="inline" if inline else "attachment",
        headers={
            # files are user content: never run them as part of this origin
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'; "
            "img-src 'self'; style-src 'unsafe-inline'",
        },
    )


# ---------- search and summary ----------

@router.get("/search")
def search(q: str = ""):
    q = q.strip()
    if len(q) < 2:
        return {"query": q, "records": [], "contacts": [], "inventory": [],
                "documents": [], "spaces": []}
    return {"query": q, **search_all(q[:100])}


@router.get("/summary")
def summary(business_id: Optional[int] = None):
    if business_id is not None:
        require_business(business_id)
    today = ph_today().isoformat()
    low = list_inventory(today, business_id=business_id, low_only=True)
    return {
        "money": money_summary(business_id),
        "low_stock": [
            {
                "id": i["id"], "name": i["name"], "quantity": i["quantity"],
                "reorder_at": i["reorder_at"], "unit": i["unit"],
                "business_id": i["business_id"],
                "business_name": i["business_name"],
            }
            for i in low
        ],
    }
