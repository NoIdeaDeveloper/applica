import logging
import sqlite3
import os
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DATA_DIR = os.environ.get("DATA_DIR", "./data")
DB_PATH = os.path.join(DATA_DIR, "applica.db")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")

SCHEMA = """
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'applied'
        CHECK(status IN ('applied','interviewing','offer','rejected','ghosted')),
    salary_min INTEGER,
    salary_max INTEGER,
    notes TEXT,
    resume_path TEXT,
    cover_letter_path TEXT,
    date_applied TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS followups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    contact_name TEXT,
    date TEXT NOT NULL DEFAULT (date('now')),
    method TEXT NOT NULL CHECK(method IN ('email','phone','linkedin','other')),
    direction TEXT NOT NULL DEFAULT 'outbound' CHECK(direction IN ('inbound','outbound')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_search ON applications(company, title);
CREATE INDEX IF NOT EXISTS idx_followups_app_id ON followups(application_id);
"""


SCHEMA_COMPANY_NOTES = """
CREATE TABLE IF NOT EXISTS company_notes (
    company TEXT PRIMARY KEY COLLATE NOCASE,
    notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


SCHEMA_INTERVIEW_ROUNDS = """
CREATE TABLE IF NOT EXISTS interview_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK(stage IN ('phone_screen','technical','onsite','final','other')),
    date TEXT,
    interviewer TEXT,
    outcome TEXT CHECK(outcome IN ('pending','passed','failed',NULL)),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rounds_app_id ON interview_rounds(application_id);
"""

MIGRATIONS = [
    "ALTER TABLE followups ADD COLUMN contact_title TEXT",
    "ALTER TABLE followups ADD COLUMN contact_email TEXT",
    "ALTER TABLE applications ADD COLUMN location TEXT",
    "ALTER TABLE applications ADD COLUMN source TEXT",
    "ALTER TABLE applications ADD COLUMN employment_type TEXT",
    "ALTER TABLE applications ADD COLUMN seniority TEXT",
    "ALTER TABLE applications ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE applications ADD COLUMN rejection_reason TEXT",
    "ALTER TABLE applications ADD COLUMN bonus INTEGER",
    "ALTER TABLE applications ADD COLUMN equity TEXT",
    "ALTER TABLE applications ADD COLUMN benefits TEXT",
    "ALTER TABLE applications ADD COLUMN industry TEXT",
    "ALTER TABLE applications ADD COLUMN company_size TEXT",
]


VALID_STATUSES = {"applied", "interviewing", "offer", "rejected", "ghosted"}


def verify_application_exists(db, app_id: int):
    """Raise 404 if application doesn't exist."""
    from fastapi import HTTPException
    if not db.execute("SELECT id FROM applications WHERE id = ?", (app_id,)).fetchone():
        raise HTTPException(404, "Application not found")


def touch_application(db, app_id: int):
    """Update the updated_at timestamp on an application."""
    db.execute("UPDATE applications SET updated_at = datetime('now') WHERE id = ?", (app_id,))


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    with get_db() as db:
        db.executescript(SCHEMA)
        db.executescript(SCHEMA_COMPANY_NOTES)
        db.executescript(SCHEMA_INTERVIEW_ROUNDS)
        for migration in MIGRATIONS:
            try:
                db.execute(migration)
            except sqlite3.OperationalError as e:
                logger.debug("Migration skipped (already applied): %s", e)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
