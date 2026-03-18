from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import init_db
from routers import applications, followups, interview_rounds, company_notes


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Applica", version="1.0.0", lifespan=lifespan)

app.include_router(applications.router, prefix="/api")
app.include_router(followups.router, prefix="/api")
app.include_router(interview_rounds.router, prefix="/api")
app.include_router(company_notes.router, prefix="/api")

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def index():
    return FileResponse("static/index.html")
