from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class ChatMessageCreateRequest(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    content: str
    created_at: datetime


class ChatRoomResponse(BaseModel):
    id: UUID
    song_request_id: UUID
    participant_ids: List[UUID]
    messages: List[ChatMessageResponse]


class ChatRoomListItemResponse(BaseModel):
    chat_room_id: UUID
    song_request_id: UUID
    song_title: str
    artist: str
    last_message_preview: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
