import csv
import io
import json
import os
import shutil
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse

from backend.database import get_db, UPLOADS_DIR
from backend.constants import VALID_STATUSES, MAX_UPLOAD_BYTES, ALLOWED_EXTENSIONS
from backend.utils import verify_application_exists
from backend.schemas import ApplicationCreate, ApplicationUpdate, BulkAction

router = APIRouter()


_UPLOADS_REAL = None


def _safe_upload_path(filename: str) -> str:
    """Resolve path and verify it's inside UPLOADS_DIR (prevents path traversal)."""
    global _UPLOADS_REAL
    if _UPLOADS_REAL is None:
        _UPLOADS_REAL = os.path.realpath(UPLOADS_DIR) + os.sep
    resolved = os.path.realpath(os.path.join(UPLOADS_DIR, filename))
    if not resolved.startswith(_UPLOADS_REAL):
        raise HTTPException(400, "Invalid filename")
    return resolved


def _remove_file(filename: Optional[str]):
    if not filename:
        return
    try:
        os.remove(_safe_upload_path(filename))
    except (FileNotFoundError, HTTPException):
        pass


def _save_upload(app_id: int, file: UploadFile, file_type: str) -> str:
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(415, f"File type '{ext or 'none'}' not allowed. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    filename = f"{app_id}_{file_type}{ext}"
    filepath = _safe_upload_path(filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return filename


def _upload_file(app_id: int, file: UploadFile, file_type: str, path_field: str):
    size = 0
    chunk_size = 1024 * 1024
    while chunk := file.file.read(chunk_size):
        size += len(chunk)
        if size > MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit")
    file.file.seek(0)

    with get_db() as db:
        verify_application_exists(db, app_id)
        row = db.execute(
            f"SELECT {path_field} FROM applications WHERE id = ?", (app_id,)
        ).fetchone()
        _remove_file(row[path_field])
        filename = _save_upload(app_id, file, file_type)
        db.execute(
            f"UPDATE applications SET {path_field} = ?, updated_at = datetime('now') WHERE id = ?",
            (filename, app_id),
        )
        return {"filename": filename}


def _download_file(app_id: int, path_field: str, label: str):
    with get_db() as db:
        verify_application_exists(db, app_id)
        row = db.execute(
            f"SELECT {path_field} FROM applications WHERE id = ?", (app_id,)
        ).fetchone()
        if not row or not row[path_field]:
            raise HTTPException(404, f"No {label} uploaded")
        filepath = _safe_upload_path(row[path_field])
        return FileResponse(filepath, filename=row[path_field])


@router.post("/applications/bulk", status_code=200)
def bulk_action(data: BulkAction):
    if not data.ids:
        raise HTTPException(400, "No IDs provided")
    placeholders = ",".join("?" * len(data.ids))
    with get_db() as db:
        if data.action == "delete":
            rows = db.execute(
                f"SELECT resume_path, cover_letter_path FROM applications WHERE id IN ({placeholders})",
                data.ids,
            ).fetchall()
            for row in rows:
                _remove_file(row["resume_path"])
                _remove_file(row["cover_letter_path"])
            db.execute(f"DELETE FROM applications WHERE id IN ({placeholders})", data.ids)
            return {"deleted": len(data.ids)}
        elif data.action == "update_status":
            if data.status not in VALID_STATUSES:
                raise HTTPException(400, "Invalid status")
            db.execute(
                f"UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id IN ({placeholders})",
                [data.status] + data.ids,
            )
            return {"updated": len(data.ids)}


@router.get("/applications")
def list_applications(
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = Query(default="date_applied DESC"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    archived: bool = Query(default=False),
):
    allowed_sorts = {
        "date_applied DESC", "date_applied ASC",
        "company ASC", "company DESC",
        "updated_at DESC", "updated_at ASC",
        "created_at DESC",
    }
    if sort not in allowed_sorts:
        sort = "date_applied DESC"

    conditions, search_params = _search_conditions(status, search)
    where = "WHERE " + " AND ".join(["archived = ?"] + conditions)
    params: list = [1 if archived else 0] + search_params

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
        row = db.execute(
            """INSERT INTO applications (company, title, url, status, location, source, employment_type, seniority, salary_min, salary_max, bonus, equity, benefits, industry, company_size, notes, rejection_reason, date_applied)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')))
               RETURNING *""",
            (app.company, app.title, app.url, app.status, app.location, app.source,
             app.employment_type, app.seniority, app.salary_min, app.salary_max,
             app.bonus, app.equity, app.benefits, app.industry, app.company_size,
             app.notes, app.rejection_reason, app.date_applied),
        ).fetchone()
        return dict(row)


@router.get("/applications/check-duplicate")
def check_duplicate(company: str, title: str, exclude_id: Optional[int] = None):
    with get_db() as db:
        query = "SELECT id, company, title, status, date_applied FROM applications WHERE LOWER(company) = LOWER(?) AND LOWER(title) = LOWER(?)"
        params: list = [company, title]
        if exclude_id is not None:
            query += " AND id != ?"
            params.append(exclude_id)
        rows = db.execute(query, params).fetchall()
        return {"duplicates": [dict(r) for r in rows]}


@router.get("/applications/export")
def export_applications(
    fmt: str = Query(default="csv", alias="format"),
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    conditions, params = _search_conditions(status, search)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    with get_db() as db:
        rows = [dict(r) for r in db.execute(
            f"SELECT id, company, title, status, location, source, employment_type, seniority, date_applied, salary_min, salary_max, bonus, equity, benefits, industry, company_size, url, notes, created_at, updated_at FROM applications {where} ORDER BY date_applied DESC",
            params,
        ).fetchall()]

    if fmt == "json":
        content = json.dumps(rows, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=applications.json"},
        )

    fields = ["id", "company", "title", "status", "location", "source", "employment_type", "seniority", "date_applied", "salary_min", "salary_max", "bonus", "equity", "benefits", "industry", "company_size", "url", "notes", "created_at", "updated_at"]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=applications.csv"},
    )


def _csv_val(row: dict, key: str, cast=str):
    v = (row.get(key) or "").strip()
    if not v:
        return None
    try:
        return cast(v)
    except (ValueError, TypeError):
        return None


def _search_conditions(status: Optional[str], search: Optional[str]) -> tuple[list, list]:
    """Return (conditions, params) for optional status/search filters."""
    conditions: list = []
    params: list = []
    if status:
        conditions.append("status = ?")
        params.append(status)
    if search:
        conditions.append("(company LIKE ? OR title LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])
    return conditions, params


@router.post("/applications/import", status_code=200)
async def import_applications(file: UploadFile = File(...)):
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handle BOM from Excel
    except UnicodeDecodeError:
        raise HTTPException(400, "File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or "company" not in reader.fieldnames or "title" not in reader.fieldnames:
        raise HTTPException(400, "CSV must have at least 'company' and 'title' columns")

    imported, skipped = 0, 0
    errors = []

    with get_db() as db:
        for i, row in enumerate(reader, start=2):
            company = (row.get("company") or "").strip()
            title = (row.get("title") or "").strip()
            if not company or not title:
                skipped += 1
                errors.append(f"Row {i}: missing company or title — skipped")
                continue

            status = (row.get("status") or "applied").strip().lower()
            if status not in VALID_STATUSES:
                status = "applied"

            try:
                db.execute(
                    """INSERT INTO applications
                       (company, title, url, status, location, source, employment_type, seniority,
                        salary_min, salary_max, bonus, equity, benefits, notes, date_applied)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, date('now')))""",
                    (company, title, _csv_val(row, "url"), status, _csv_val(row, "location"),
                     _csv_val(row, "source"), _csv_val(row, "employment_type"), _csv_val(row, "seniority"),
                     _csv_val(row, "salary_min", int), _csv_val(row, "salary_max", int), _csv_val(row, "bonus", int),
                     _csv_val(row, "equity"), _csv_val(row, "benefits"), _csv_val(row, "notes"), _csv_val(row, "date_applied")),
                )
                imported += 1
            except Exception as e:
                skipped += 1
                errors.append(f"Row {i}: {e}")

    return {"imported": imported, "skipped": skipped, "errors": errors[:20]}


def _set_archived(app_id: int, value: int):
    with get_db() as db:
        row = db.execute(
            "UPDATE applications SET archived = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
            (value, app_id),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Application not found")
        return dict(row)


@router.post("/applications/{app_id}/archive", status_code=200)
def archive_application(app_id: int):
    return _set_archived(app_id, 1)


@router.post("/applications/{app_id}/restore", status_code=200)
def restore_application(app_id: int):
    return _set_archived(app_id, 0)


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
        rounds = db.execute(
            "SELECT * FROM interview_rounds WHERE application_id = ? ORDER BY date ASC, id ASC", (app_id,)
        ).fetchall()
        result["interview_rounds"] = [dict(r) for r in rounds]
        return result


@router.put("/applications/{app_id}")
def update_application(app_id: int, data: ApplicationUpdate):
    fields = data.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(400, "No fields to update")

    with get_db() as db:
        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [app_id]
        row = db.execute(
            f"UPDATE applications SET {set_clause}, updated_at = datetime('now') WHERE id = ? RETURNING *",
            values,
        ).fetchone()
        if not row:
            raise HTTPException(404, "Application not found")
        return dict(row)


@router.delete("/applications/{app_id}", status_code=204)
def delete_application(app_id: int):
    with get_db() as db:
        row = db.execute("SELECT resume_path, cover_letter_path FROM applications WHERE id = ?", (app_id,)).fetchone()
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
