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


class ParticipationPlanItemResponse(BaseModel):
    live_event_id: Optional[UUID] = None
    live_event_name: Optional[str] = None
    live_event_date: Optional[date] = None
    song_id: UUID
    song_title: str
    artist: str
    parts: List[str] = []
    planned_month: Optional[str] = None


class CircleParticipationPlansResponse(BaseModel):
    circle_id: UUID
    circle_name: str
    approved: List[ParticipationPlanItemResponse] = []
    applied: List[ParticipationPlanItemResponse] = []
    planned: List[ParticipationPlanItemResponse] = []


class HomeCircleResponse(BaseModel):
    id: UUID
    name: str


class HomeOfferItemResponse(BaseModel):
    circle_id: UUID
    circle_name: str
    song_id: UUID
    song_title: str
    artist: str
    part: str


class HomeApplicationItemResponse(BaseModel):
    circle_id: UUID
    circle_name: str
    song_id: UUID
    song_title: str
    artist: str
    part: str


class HomeParticipationItemResponse(BaseModel):
    circle_id: UUID
    circle_name: str
    live_event_id: UUID
    live_event_name: str
    live_event_date: Optional[date] = None
    song_id: UUID
    song_title: str
    artist: str
    parts: List[str] = []


class HomeChatItemResponse(BaseModel):
    circle_id: UUID
    circle_name: str
    song_id: UUID
    song_title: str
    artist: str
    unread_count: int = 0
    last_message_preview: Optional[str] = None
    last_message_at: Optional[str] = None


class MeHomeResponse(BaseModel):
    user_name: str
    circles: List[HomeCircleResponse] = []
    pending_offers: List[HomeOfferItemResponse] = []
    pending_applications: List[HomeApplicationItemResponse] = []
    upcoming_participations: List[HomeParticipationItemResponse] = []
    unread_chats: List[HomeChatItemResponse] = []
