import os
import shutil
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import get_db, UPLOADS_DIR

router = APIRouter()


class ApplicationCreate(BaseModel):
    company: str
    title: str
    url: Optional[str] = None
    status: str = "applied"
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    notes: Optional[str] = None
    date_applied: Optional[str] = None


class ApplicationUpdate(BaseModel):
    company: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    status: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    notes: Optional[str] = None
    date_applied: Optional[str] = None


def _remove_file(filename: Optional[str]):
    if not filename:
        return
    try:
        os.remove(os.path.join(UPLOADS_DIR, filename))
    except FileNotFoundError:
        pass


def _save_upload(app_id: int, file: UploadFile, file_type: str) -> str:
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    filename = f"{app_id}_{file_type}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return filename


def _upload_file(app_id: int, file: UploadFile, file_type: str, path_field: str):
    with get_db() as db:
        row = db.execute(
            f"SELECT id, {path_field} FROM applications WHERE id = ?", (app_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Application not found")
        _remove_file(row[path_field])
        filename = _save_upload(app_id, file, file_type)
        db.execute(
            f"UPDATE applications SET {path_field} = ?, updated_at = datetime('now') WHERE id = ?",
            (filename, app_id),
        )
        return {"filename": filename}


def _download_file(app_id: int, path_field: str, label: str):
    with get_db() as db:
        row = db.execute(
            f"SELECT {path_field} FROM applications WHERE id = ?", (app_id,)
        ).fetchone()
        if not row or not row[path_field]:
            raise HTTPException(404, f"No {label} uploaded")
        filepath = os.path.join(UPLOADS_DIR, row[path_field])
        return FileResponse(filepath, filename=row[path_field])


@router.get("/applications")
def list_applications(
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query(default="date_applied DESC"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    allowed_sorts = {
        "date_applied DESC", "date_applied ASC",
        "company ASC", "company DESC",
        "updated_at DESC", "updated_at ASC",
        "created_at DESC",
    }
    if sort not in allowed_sorts:
        sort = "date_applied DESC"

    where = "WHERE 1=1"
    params = []

    if status:
        where += " AND status = ?"
        params.append(status)
    if search:
        where += " AND (company LIKE ? OR title LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    with get_db() as db:
        total = db.execute(f"SELECT COUNT(*) FROM applications {where}", params).fetchone()[0]
        rows = db.execute(
            f"SELECT * FROM applications {where} ORDER BY {sort} LIMIT ? OFFSET ?",
            params + [limit, offset]
        ).fetchall()
        return {"items": [dict(r) for r in rows], "total": total}


@router.post("/applications", status_code=201)
def create_application(app: ApplicationCreate):
    with get_db() as db:
        cursor = db.execute(
            """INSERT INTO applications (company, title, url, status, salary_min, salary_max, notes, date_applied)
               VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')))""",
            (app.company, app.title, app.url, app.status,
             app.salary_min, app.salary_max, app.notes, app.date_applied),
        )
        row = db.execute("SELECT * FROM applications WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)


@router.get("/applications/{app_id}")
def get_application(app_id: int):
    with get_db() as db:
        row = db.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Application not found")
        result = dict(row)
        followups = db.execute(
            "SELECT * FROM followups WHERE application_id = ? ORDER BY date DESC", (app_id,)
        ).fetchall()
        result["followups"] = [dict(f) for f in followups]
        return result


@router.put("/applications/{app_id}")
def update_application(app_id: int, data: ApplicationUpdate):
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(400, "No fields to update")

    with get_db() as db:
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [app_id]
        cursor = db.execute(
            f"UPDATE applications SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
            values,
        )
        if cursor.rowcount == 0:
            raise HTTPException(404, "Application not found")
        row = db.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
        return dict(row)


@router.delete("/applications/{app_id}", status_code=204)
def delete_application(app_id: int):
    with get_db() as db:
        row = db.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Application not found")
        _remove_file(row["resume_path"])
        _remove_file(row["cover_letter_path"])
        db.execute("DELETE FROM applications WHERE id = ?", (app_id,))


@router.post("/applications/{app_id}/resume")
def upload_resume(app_id: int, file: UploadFile = File(...)):
    return _upload_file(app_id, file, "resume", "resume_path")


@router.post("/applications/{app_id}/cover-letter")
def upload_cover_letter(app_id: int, file: UploadFile = File(...)):
    return _upload_file(app_id, file, "cover_letter", "cover_letter_path")


@router.get("/applications/{app_id}/resume")
def download_resume(app_id: int):
    return _download_file(app_id, "resume_path", "resume")


@router.get("/applications/{app_id}/cover-letter")
def download_cover_letter(app_id: int):
    return _download_file(app_id, "cover_letter_path", "cover letter")


@router.get("/stats")
def get_stats():
    with get_db() as db:
        rows = db.execute(
            "SELECT status, COUNT(*) as count FROM applications GROUP BY status"
        ).fetchall()
        by_status = {r["status"]: r["count"] for r in rows}
        total = sum(by_status.values())

        counts = db.execute("""
            SELECT
                COUNT(CASE WHEN date_applied >= date('now', '-7 days') THEN 1 END) as this_week,
                COUNT(CASE WHEN date_applied >= date('now', '-30 days') THEN 1 END) as this_month
            FROM applications
        """).fetchone()

        weekly = db.execute("""
            SELECT strftime('%Y-%W', date_applied) as week, COUNT(*) as count
            FROM applications
            WHERE date_applied >= date('now', '-56 days')
            GROUP BY week ORDER BY week
        """).fetchall()

        return {
            "by_status": by_status,
            "total": total,
            "this_week": counts["this_week"],
            "this_month": counts["this_month"],
            "weekly": [dict(w) for w in weekly],
        }
