from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_db, verify_application_exists, touch_application

router = APIRouter()

VALID_STAGES = {"phone_screen", "technical", "onsite", "final", "other"}
VALID_OUTCOMES = {"pending", "passed", "failed", None}


class InterviewRoundCreate(BaseModel):
    application_id: int
    stage: str = "phone_screen"
    date: Optional[str] = None
    interviewer: Optional[str] = None
    outcome: Optional[str] = "pending"
    notes: Optional[str] = None


class InterviewRoundUpdate(BaseModel):
    outcome: Optional[str] = None
    notes: Optional[str] = None
    interviewer: Optional[str] = None
    date: Optional[str] = None


@router.post("/interview-rounds", status_code=201)
def create_round(data: InterviewRoundCreate):
    if data.stage not in VALID_STAGES:
        raise HTTPException(400, f"Invalid stage. Must be one of: {', '.join(VALID_STAGES)}")
    if data.outcome not in VALID_OUTCOMES:
        raise HTTPException(400, "Invalid outcome. Must be pending, passed, or failed.")
    with get_db() as db:
        verify_application_exists(db, data.application_id)
        row = db.execute(
            """INSERT INTO interview_rounds (application_id, stage, date, interviewer, outcome, notes)
               VALUES (?, ?, ?, ?, ?, ?)
               RETURNING *""",
            (data.application_id, data.stage, data.date, data.interviewer, data.outcome, data.notes),
        ).fetchone()
        touch_application(db, data.application_id)
        return dict(row)


@router.patch("/interview-rounds/{round_id}", status_code=200)
def update_round(round_id: int, data: InterviewRoundUpdate):
    if data.outcome is not None and data.outcome not in VALID_OUTCOMES:
        raise HTTPException(400, "Invalid outcome.")
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(400, "No fields to update")
    with get_db() as db:
        existing = db.execute("SELECT * FROM interview_rounds WHERE id = ?", (round_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Interview round not found")
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        updated = db.execute(
            f"UPDATE interview_rounds SET {set_clause} WHERE id = ? RETURNING *",
            list(fields.values()) + [round_id],
        ).fetchone()
        touch_application(db, existing["application_id"])
        return dict(updated)


@router.delete("/interview-rounds/{round_id}", status_code=204)
def delete_round(round_id: int):
    with get_db() as db:
        row = db.execute("SELECT application_id FROM interview_rounds WHERE id = ?", (round_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Interview round not found")
        db.execute("DELETE FROM interview_rounds WHERE id = ?", (round_id,))
        touch_application(db, row["application_id"])
