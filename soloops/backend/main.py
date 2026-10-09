
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from database import (
    init_db,
    list_businesses,
    get_business,
    create_business,
    update_business,
    delete_business,
)
import requests

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="SoloOps API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://127.0.0.1:11434"
MODEL = "qwen2.5:3b"


class ChatRequest(BaseModel):
    message: str


@app.get("/")
def home():
    return {
        "app": "SoloOps",
        "status": "running",
        "mode": "local"
    }


@app.get("/health")
def health():
    try:
        response = requests.get(
            f"{OLLAMA_URL}/api/tags",
            timeout=5
        )
        response.raise_for_status()
        return {"ollama": "connected"}
    except requests.RequestException:
        return {"ollama": "disconnected"}


@app.post("/chat")
def chat(request: ChatRequest):
    prompt = f"""
You are SoloOps, a private offline AI assistant
for entrepreneurs managing multiple businesses.

Businesses can be of any type.
Never assume the user runs a rental business.

Help organize tasks, deadlines, documents,
schedules, and business priorities.

Do not invent business records or claim to have
checked calendars, payments, or inventory.

User message:
{request.message}
"""

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL,
                "prompt": prompt,
                "stream": False
            },
            timeout=120
        )
        response.raise_for_status()
        return {
            "reply": response.json()["response"]
        }
    except (requests.RequestException, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Local AI unavailable: {exc}"
        )


from pydantic import BaseModel, Field


class BusinessInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    business_type: str = Field(
        min_length=1, max_length=100
    )
    description: str = Field(default="", max_length=1000)


@app.get("/businesses")
def get_all_businesses():
    return list_businesses()


@app.get("/businesses/{business_id}")
def get_one_business(business_id: int):
    business = get_business(business_id)

    if not business:
        raise HTTPException(
            status_code=404,
            detail="Business not found"
        )

    return business


@app.post("/businesses", status_code=201)
def add_business(data: BusinessInput):
    return create_business(
        data.name.strip(),
        data.business_type.strip(),
        data.description.strip()
    )


@app.put("/businesses/{business_id}")
def edit_business(
    business_id: int,
    data: BusinessInput
):
    business = update_business(
        business_id,
        data.name.strip(),
        data.business_type.strip(),
        data.description.strip()
    )

    if not business:
        raise HTTPException(
            status_code=404,
            detail="Business not found"
        )

    return business


@app.delete("/businesses/{business_id}")
def remove_business(business_id: int):
    deleted = delete_business(business_id)

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Business not found"
        )

    return {"message": "Business deleted"}
