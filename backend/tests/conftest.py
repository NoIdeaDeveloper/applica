import sqlite3
from contextlib import contextmanager
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models import SCHEMA, SCHEMA_COMPANY_NOTES, SCHEMA_INTERVIEW_ROUNDS, MIGRATIONS


@pytest.fixture(scope="function")
def test_db(tmp_path):
    """Create a fresh SQLite database for each test in a temp directory."""
    db_path = str(tmp_path / "test_applica.db")

    @contextmanager
    def _get_test_db():
        conn = sqlite3.connect(db_path)
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

    with _get_test_db() as db:
        db.executescript(SCHEMA)
        db.executescript(SCHEMA_COMPANY_NOTES)
        db.executescript(SCHEMA_INTERVIEW_ROUNDS)
        for migration in MIGRATIONS:
            try:
                db.execute(migration)
            except sqlite3.OperationalError:
                pass

    return _get_test_db


@pytest.fixture(scope="function")
def client(test_db):
    """TestClient with get_db patched in all router namespaces."""
    patches = [
        patch("backend.routers.applications.get_db", test_db),
        patch("backend.routers.applications._UPLOADS_REAL", None),
        patch("backend.routers.followups.get_db", test_db),
        patch("backend.routers.interview_rounds.get_db", test_db),
        patch("backend.routers.company_notes.get_db", test_db),
    ]
    for p in patches:
        p.start()
    with TestClient(app) as c:
        yield c
    for p in patches:
        p.stop()
