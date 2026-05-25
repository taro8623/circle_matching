from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


# -------- 募集パート --------
class RecruitingPartInput(BaseModel):
    part: str
    required_count: int = 1


class PreassignedMemberInput(BaseModel):
    user_id: UUID
    part: str


class PartSlotInput(BaseModel):
    mode: str = "not_needed"
    user_id: Optional[UUID] = None
    external_name: Optional[str] = None


class PartSetupInput(BaseModel):
    part: str
    slot_count: int = 1
    slots: List[PartSlotInput] = []

    # legacy fields
    mode: str = "not_needed"
    required_count: int = 1
    user_id: Optional[UUID] = None
    user_ids: List[UUID] = []
    external_name: Optional[str] = None
    external_names: List[str] = []


# -------- 曲起票 --------
class SongCreateRequest(BaseModel):
    title: str
    artist: str
    reference_url: Optional[str] = None
    memo: Optional[str] = None
    timing_preference_memo: Optional[str] = None
    part_setups: List[PartSetupInput] = []
    recruiting_parts: List[RecruitingPartInput] = []
    preassigned_members: List[PreassignedMemberInput] = []


class SongUpdateRequest(BaseModel):
    title: Optional[str] = None
    artist: Optional[str] = None
    reference_url: Optional[str] = None
    memo: Optional[str] = None
    timing_preference_memo: Optional[str] = None


class SongStatusUpdateRequest(BaseModel):
    """メンバー確定/取り消し用"""
    status: str   # 'recruiting' | 'ready' | 'archived' | 'cancelled'
    planned_month: Optional[str] = None


# -------- レスポンス --------
class RecruitingPartResponse(BaseModel):
    part: str
    required_count: int
    accepted_count: int   # この曲のこのパートで accepted な entries の数


class EntryResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    part: str
    part_detail: Optional[str] = None
    kind: str       # application / offer
    status: str     # pending / accepted / declined / withdrawn
    timing_memo: Optional[str] = None


class ExternalMemberResponse(BaseModel):
    id: UUID
    part: str
    member_name: str


class SongItemResponse(BaseModel):
    """サークル詳細・自分向け一覧で使う統一形式"""
    id: UUID
    circle_id: UUID
    title: str
    artist: str
    reference_url: Optional[str] = None
    memo: Optional[str] = None
    timing_preference_memo: Optional[str] = None
    status: str
    requested_by: str      # 起案者の name
    requested_by_id: UUID  # 起案者の id
    matching_parts: List[str] = []
    recruiting_parts: List[RecruitingPartResponse] = []
    external_members: List[ExternalMemberResponse] = []
    entries: List[EntryResponse] = []
    chat_room_id: Optional[UUID] = None

    planned_month: Optional[str] = None

    # ライブ申請状況
    latest_live_event_name: Optional[str] = None
    latest_live_application_status: Optional[str] = None


class CircleSongsForMeResponse(BaseModel):
    circle_id: UUID
    circle_name: str
    current_user_id: UUID
    current_user_role: str
    current_user_parts: List[str]
    own_songs: List[SongItemResponse] = []
    applicable_songs: List[SongItemResponse] = []        # 応募できる(募集中 & 未応募)
    applied_songs: List[SongItemResponse] = []           # 応募中(承認待ち)
    offered_songs: List[SongItemResponse] = []           # お誘いが届いている(リアクション待ち)
    joined_songs: List[SongItemResponse] = []
    all_recruiting_songs: List[SongItemResponse] = []            # 参加が決まった(accepted)
    # 後方互換(旧フロント用。applicable_songs と同じ中身)
    matching_recruiting_songs: List[SongItemResponse] = []


# -------- 応募 / オファー --------
class ApplicationCreateRequest(BaseModel):
    """応募 (user→song)"""
    part: str
    part_detail: Optional[str] = None
    timing_memo: Optional[str] = None


class OfferCreateRequest(BaseModel):
    """お誘い (requester→user)"""
    user_id: UUID
    part: str
    part_detail: Optional[str] = None


class EntryStatusUpdateRequest(BaseModel):
    """承認/辞退/取り下げ"""
    status: str   # 'accepted' | 'declined' | 'withdrawn' | 'pending'
