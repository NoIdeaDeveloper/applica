import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import init_db
from routers import applications, followups, interview_rounds, company_notes

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Applica — initialising database")
    init_db()
    logger.info("Database ready")
    yield
    logger.info("Applica shutting down")


app = FastAPI(title="Applica", version="1.0.0", lifespan=lifespan)

app.include_router(applications.router, prefix="/api")
app.include_router(followups.router, prefix="/api")
app.include_router(interview_rounds.router, prefix="/api")
app.include_router(company_notes.router, prefix="/api")

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def index():
    return FileResponse("static/index.html")
