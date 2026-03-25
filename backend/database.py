import logging
import os
import sqlite3
from contextlib import contextmanager

from backend.models import SCHEMA, SCHEMA_COMPANY_NOTES, SCHEMA_INTERVIEW_ROUNDS, MIGRATIONS

logger = logging.getLogger(__name__)

DATA_DIR = os.environ.get("DATA_DIR", "./data")
DB_PATH = os.path.join(DATA_DIR, "applica.db")
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    with get_db() as db:
        db.execute("PRAGMA journal_mode = WAL")
        db.execute("PRAGMA busy_timeout = 5000")
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
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
