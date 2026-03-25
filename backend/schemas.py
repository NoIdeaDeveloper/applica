from typing import Literal, Optional

from pydantic import BaseModel


class ApplicationCreate(BaseModel):
    company: str
    title: str
    url: Optional[str] = None
    status: str = "applied"
    location: Optional[str] = None
    source: Optional[str] = None
    employment_type: Optional[str] = None
    seniority: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    bonus: Optional[int] = None
    equity: Optional[str] = None
    benefits: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    date_applied: Optional[str] = None


class ApplicationUpdate(BaseModel):
    company: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    source: Optional[str] = None
    employment_type: Optional[str] = None
    seniority: Optional[str] = None
    rejection_reason: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    bonus: Optional[int] = None
    equity: Optional[str] = None
    benefits: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    notes: Optional[str] = None
    date_applied: Optional[str] = None


class BulkAction(BaseModel):
    ids: list[int]
    action: Literal["update_status", "delete"]
    status: Optional[str] = None


class FollowupCreate(BaseModel):
    application_id: int
    contact_name: Optional[str] = None
    contact_title: Optional[str] = None
    contact_email: Optional[str] = None
    date: Optional[str] = None
    method: str = "email"
    direction: str = "outbound"
    notes: Optional[str] = None


class FollowupUpdate(BaseModel):
    contact_name: Optional[str] = None
    contact_title: Optional[str] = None
    contact_email: Optional[str] = None
    date: Optional[str] = None
    method: Optional[str] = None
    direction: Optional[str] = None
    notes: Optional[str] = None


class InterviewRoundCreate(BaseModel):
    application_id: int
    stage: str = "phone_screen"
    date: Optional[str] = None
    interviewer: Optional[str] = None
    outcome: Optional[str] = "pending"
    notes: Optional[str] = None


class InterviewRoundUpdate(BaseModel):
    outcome: Optional[str] = None
    notes: Optional[str] = None
    interviewer: Optional[str] = None
    date: Optional[str] = None


class CompanyNotesUpdate(BaseModel):
    notes: str
