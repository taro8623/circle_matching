from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# -------- LiveEvent --------
class LiveEventCreateRequest(BaseModel):
    name: str
    event_date: Optional[date] = None
    entry_status: str = "closed"
    lifecycle_status: str = "scheduled"


class LiveEventUpdateRequest(BaseModel):
    name: Optional[str] = None
    event_date: Optional[date] = None
    entry_status: Optional[str] = None
    lifecycle_status: Optional[str] = None


class LiveEventResponse(BaseModel):
    id: UUID
    circle_id: UUID
    name: str
    event_date: Optional[date] = None
    entry_status: str
    lifecycle_status: str
    created_by: UUID
    created_at: datetime
    songs: List["LiveEventSongSummaryResponse"] = Field(default_factory=list)
    participant_count: int = 0
    current_user_status: str = "want_invites"
    current_user_status_memo: Optional[str] = None
    current_user_auto_labels: List[str] = Field(default_factory=list)


class LiveEventSongSummaryResponse(BaseModel):
    song_id: UUID
    title: str
    artist: str
    song_status: str
    live_application_status: str
    recruiting_labels: List[str] = Field(default_factory=list)


class LiveEventParticipantAssignmentResponse(BaseModel):
    song_id: UUID
    title: str
    artist: str
    part: str


class LiveEventParticipantResponse(BaseModel):
    participant_type: str
    participant_key: str
    user_id: Optional[UUID] = None
    display_name: str
    circle_role: Optional[str] = None
    payment_status: str = "unpaid"
    profile_parts: List[str] = Field(default_factory=list)
    assignments: List[LiveEventParticipantAssignmentResponse] = Field(default_factory=list)


class LiveEventParticipantsResponse(BaseModel):
    live_event_id: UUID
    circle_id: UUID
    live_event_name: str
    event_date: Optional[date] = None
    lifecycle_status: str
    approved_song_count: int
    participant_count: int
    can_manage_payments: bool = False
    participants: List[LiveEventParticipantResponse] = Field(default_factory=list)


class LiveEventParticipantPaymentStatusUpdateRequest(BaseModel):
    participant_type: str
    participant_key: str
    payment_status: str


class LiveEventParticipantPaymentStatusResponse(BaseModel):
    live_event_id: UUID
    participant_type: str
    participant_key: str
    payment_status: str
    updated_at: datetime


# -------- 月別意思表明 --------
class UserLiveEventStatusUpdateRequest(BaseModel):
    status: str   # 'want_invites' / 'available' / 'unavailable'
    memo: Optional[str] = None


class UserLiveEventStatusResponse(BaseModel):
    live_event_id: UUID
    status: str
    memo: Optional[str] = None


# -------- ライブ申請 --------
class SongLiveApplicationCreateRequest(BaseModel):
    live_event_id: UUID
    memo: Optional[str] = None


class SongLiveApplicationDecisionRequest(BaseModel):
    status: str   # 'approved' | 'rejected'
    memo: Optional[str] = None


class SongLiveApplicationResponse(BaseModel):
    id: UUID
    song_request_id: UUID
    live_event_id: UUID
    status: str   # applied / approved / rejected / withdrawn
    applied_by: UUID
    applied_at: datetime
    decided_by: Optional[UUID] = None
    decided_at: Optional[datetime] = None
    memo: Optional[str] = None
