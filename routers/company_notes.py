from fastapi import APIRouter
from pydantic import BaseModel

from database import get_db

router = APIRouter()


class CompanyNotesUpdate(BaseModel):
    notes: str


@router.get("/company-notes/{company}")
def get_company_notes(company: str):
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM company_notes WHERE company = ?", (company,)
        ).fetchone()
        return dict(row) if row else {"company": company, "notes": "", "updated_at": None}


@router.put("/company-notes/{company}", status_code=200)
def upsert_company_notes(company: str, data: CompanyNotesUpdate):
    with get_db() as db:
        row = db.execute(
            """INSERT INTO company_notes (company, notes, updated_at)
               VALUES (?, ?, datetime('now'))
               ON CONFLICT(company) DO UPDATE SET
                   notes = excluded.notes,
                   updated_at = excluded.updated_at
               RETURNING *""",
            (company, data.notes),
        ).fetchone()
        return dict(row)
