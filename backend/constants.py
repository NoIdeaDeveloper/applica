VALID_STATUSES = {"applied", "interviewing", "offer", "rejected", "ghosted"}

VALID_STAGES = {"phone_screen", "technical", "onsite", "final", "other"}
VALID_OUTCOMES = {"pending", "passed", "failed", None}

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt"}
