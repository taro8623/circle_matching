import re
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator


class CircleCreate(BaseModel):
    name: str
    join_password: str
    description: Optional[str] = None


class CircleJoinRequest(BaseModel):
    circle_id: Optional[UUID] = None
    circle_name: Optional[str] = None
    join_password: str

    @field_validator("circle_id", mode="before")
    @classmethod
    def normalize_circle_id(cls, value: object) -> object:
        if isinstance(value, UUID):
            return value
        if not isinstance(value, str):
            return value

        normalized = value.strip()
        if not normalized:
            return normalized

        match = re.search(
            r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
            normalized,
        )
        return match.group(0) if match else normalized

    @field_validator("circle_name", mode="before")
    @classmethod
    def normalize_circle_name(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_target(self) -> "CircleJoinRequest":
        if self.circle_name or self.circle_id:
            return self
        raise ValueError("circle_name または circle_id を指定してください")


class MemberResponse(BaseModel):
    id: UUID
    name: str
    parts: List[str] = []
    role: Optional[str] = None


class SongSummary(BaseModel):
    id: UUID
    title: str
    artist: str
    reference_url: Optional[str] = None
    status: str
    recruiting_parts: List[str] = []


class CircleDetailResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    members: List[MemberResponse]
    songs: List[SongSummary]
