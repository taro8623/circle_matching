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
