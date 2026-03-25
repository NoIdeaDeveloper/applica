from fastapi import HTTPException


def verify_application_exists(db, app_id: int):
    if not db.execute("SELECT id FROM applications WHERE id = ?", (app_id,)).fetchone():
        raise HTTPException(404, "Application not found")


def touch_application(db, app_id: int):
    db.execute("UPDATE applications SET updated_at = datetime('now') WHERE id = ?", (app_id,))
