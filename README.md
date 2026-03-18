# 🍓 Applica

A self-hosted job application tracker with a FastAPI backend and a vanilla JS single-page frontend. No accounts, no cloud — your data stays local.

---

## Features

- **Track applications** — company, title, URL, status, location, source, employment type, seniority, salary range, bonus, equity, benefits, industry, company size, and notes
- **Status workflow** — Applied → Interviewing → Offer / Rejected / Ghosted, with inline status change from the list view
- **Interview rounds** — log phone screens, technicals, onsites, and finals with outcomes
- **Follow-ups** — record outbound and inbound contacts per application
- **Company notes** — shared notes across all applications at a company
- **Timeline** — chronological view of every event on an application
- **Archive** — hide closed applications without deleting them
- **Duplicate detection** — warns you before you submit a duplicate application
- **Saved searches** — pin filter/sort combinations as chips in the list view
- **Export** — download your data as CSV or JSON
- **Import** — bulk-import applications from a CSV file
- **File uploads** — attach a resume and cover letter (up to 10 MB each) per application
- **Keyboard shortcuts** — navigate and act without touching the mouse (`?` to see all)
- **Dark / light theme** — persisted in `localStorage`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Database | SQLite (WAL mode, foreign keys) |
| Frontend | Vanilla JS SPA, hash-based routing |
| Styles | Plain CSS with custom properties |

---

## Getting Started

### Prerequisites

- Python 3.11 or newer
- `pip`

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-username/applica.git
cd applica

# Install dependencies
pip install -r requirements.txt

# Start the server (default port 8000)
python main.py
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

### Configuration

| Environment variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `./data` | Directory for the SQLite database and uploaded files |
| `PORT` | `8000` | Port the server listens on |

```bash
DATA_DIR=/var/applica python main.py
```

---

## Data

All data is stored in `DATA_DIR`:

```
data/
  applica.db        # SQLite database
  uploads/          # Uploaded resumes and cover letters
```

Back up this directory to preserve your data.

---

## CSV Import Format

The import endpoint accepts CSV files with the following columns (`company` and `title` are required; all others are optional):

| Column | Notes |
|---|---|
| `company` | Required |
| `title` | Required |
| `url` | Job posting URL |
| `status` | `applied` / `interviewing` / `offer` / `rejected` / `ghosted` (defaults to `applied`) |
| `location` | |
| `source` | |
| `employment_type` | |
| `seniority` | |
| `salary_min` | Integer |
| `salary_max` | Integer |
| `bonus` | Integer |
| `equity` | |
| `benefits` | |
| `notes` | |
| `date_applied` | `YYYY-MM-DD` (defaults to today) |

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `n` | New application |
| `e` | Edit application (on detail page) |
| `/` | Focus search |
| `g` `a` | Go to Applications |
| `g` `d` | Go to Dashboard |
| `Esc` | Go back / blur input |
| `?` | Show shortcuts help |

---

## API

The REST API is available at `/api`. Interactive docs are served by FastAPI at [http://localhost:8000/docs](http://localhost:8000/docs).

Key endpoints:

```
GET    /api/applications
POST   /api/applications
GET    /api/applications/{id}
PUT    /api/applications/{id}
DELETE /api/applications/{id}

POST   /api/applications/bulk
POST   /api/applications/import
GET    /api/applications/export?format=csv|json

POST   /api/applications/{id}/archive
POST   /api/applications/{id}/restore
POST   /api/applications/{id}/resume
POST   /api/applications/{id}/cover-letter

GET    /api/stats
GET    /api/company-notes/{company}
PUT    /api/company-notes/{company}
```

---

## License

MIT
