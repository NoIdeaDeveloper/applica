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
