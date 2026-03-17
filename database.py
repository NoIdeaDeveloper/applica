import sqlite3
import os
from contextlib import contextmanager

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
CREATE INDEX IF NOT EXISTS idx_followups_app_id ON followups(application_id);
"""


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    with get_db() as db:
        db.executescript(SCHEMA)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
