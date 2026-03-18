from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_db

router = APIRouter()


class FollowupCreate(BaseModel):
    application_id: int
    contact_name: Optional[str] = None
    contact_title: Optional[str] = None
    contact_email: Optional[str] = None
    date: Optional[str] = None
    method: str = "email"
    direction: str = "outbound"
    notes: Optional[str] = None


@router.post("/followups", status_code=201)
def create_followup(data: FollowupCreate):
    with get_db() as db:
        app = db.execute("SELECT id FROM applications WHERE id = ?", (data.application_id,)).fetchone()
        if not app:
            raise HTTPException(404, "Application not found")
        cursor = db.execute(
            """INSERT INTO followups
               (application_id, contact_name, contact_title, contact_email, date, method, direction, notes)
               VALUES (?, ?, ?, ?, COALESCE(?, date('now')), ?, ?, ?)""",
            (data.application_id, data.contact_name, data.contact_title, data.contact_email,
             data.date, data.method, data.direction, data.notes),
        )
        db.execute("UPDATE applications SET updated_at = datetime('now') WHERE id = ?", (data.application_id,))
        row = db.execute("SELECT * FROM followups WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)


@router.delete("/followups/{followup_id}", status_code=204)
def delete_followup(followup_id: int):
    with get_db() as db:
        cursor = db.execute("DELETE FROM followups WHERE id = ?", (followup_id,))
        if cursor.rowcount == 0:
            raise HTTPException(404, "Follow-up not found")
