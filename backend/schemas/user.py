from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class UserPartsUpdateRequest(BaseModel):
    parts: List[str]


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    favorite_artists: Optional[List[str]] = None


class MeResponse(BaseModel):
    id: UUID
    name: str
    email: str
    parts: List[str]
    bio: Optional[str] = None
    favorite_artists: List[str] = []


class CircleSummaryResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None


class ParticipationHistoryItemResponse(BaseModel):
    live_event_id: UUID
    live_event_name: str
    live_event_date: Optional[date] = None
    song_id: UUID
    song_title: str
    artist: str
    parts: List[str] = []


class CircleParticipationHistoryResponse(BaseModel):
    circle_id: UUID
    circle_name: str
    upcoming: List[ParticipationHistoryItemResponse] = []
    history: List[ParticipationHistoryItemResponse] = []
