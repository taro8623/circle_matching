from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    body: Optional[str] = None
    link_path: Optional[str] = None
    related_song_live_application_id: Optional[UUID] = None
    related_song_part_entry_id: Optional[UUID] = None
    read_at: Optional[datetime] = None
    created_at: datetime


class NotificationUnreadCountResponse(BaseModel):
    unread_count: int
