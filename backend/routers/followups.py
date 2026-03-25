from fastapi import APIRouter, HTTPException

from backend.database import get_db
from backend.utils import verify_application_exists, touch_application
from backend.schemas import FollowupCreate, FollowupUpdate

router = APIRouter()


@router.post("/followups", status_code=201)
def create_followup(data: FollowupCreate):
    with get_db() as db:
        verify_application_exists(db, data.application_id)
        row = db.execute(
            """INSERT INTO followups
               (application_id, contact_name, contact_title, contact_email, date, method, direction, notes)
               VALUES (?, ?, ?, ?, COALESCE(?, date('now')), ?, ?, ?)
               RETURNING *""",
            (data.application_id, data.contact_name, data.contact_title, data.contact_email,
             data.date, data.method, data.direction, data.notes),
        ).fetchone()
        touch_application(db, data.application_id)
        return dict(row)


@router.patch("/followups/{followup_id}", status_code=200)
def update_followup(followup_id: int, data: FollowupUpdate):
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(400, "No fields to update")
    with get_db() as db:
        existing = db.execute("SELECT application_id FROM followups WHERE id = ?", (followup_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Follow-up not found")
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        updated = db.execute(
            f"UPDATE followups SET {set_clause} WHERE id = ? RETURNING *",
            list(fields.values()) + [followup_id],
        ).fetchone()
        touch_application(db, existing["application_id"])
        return dict(updated)


@router.delete("/followups/{followup_id}", status_code=204)
def delete_followup(followup_id: int):
    with get_db() as db:
        row = db.execute("SELECT application_id FROM followups WHERE id = ?", (followup_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Follow-up not found")
        db.execute("DELETE FROM followups WHERE id = ?", (followup_id,))
        touch_application(db, row["application_id"])
