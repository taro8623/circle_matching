"""
SongRequest を SongItemResponse に組み立てる共通ロジック。
複数ルーターから使うので分離。
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from database import has_table
from models import (
    SongRequest, SongRecruitingPart, SongPartEntry,
    SongChatRoom, SongExternalMember, User, SongLiveApplication, LiveEvent,
)
from schemas.song import (
    SongItemResponse, RecruitingPartResponse, EntryResponse, ExternalMemberResponse,
)


def build_song_item(
    db: Session,
    song: SongRequest,
    requester: User,
    matching_parts: Optional[List[str]] = None,
) -> SongItemResponse:
    """SongRequest を 1件、レスポンス形に組み立てる。"""

    # 募集パート + 採用数
    recruiting_rows = (
        db.query(SongRecruitingPart)
        .filter(SongRecruitingPart.song_request_id == song.id)
        .all()
    )
    accepted_counts: dict[str, int] = {}
    for e in db.query(SongPartEntry).filter(
        SongPartEntry.song_request_id == song.id,
        SongPartEntry.status == "accepted",
    ).all():
        accepted_counts[e.part] = accepted_counts.get(e.part, 0) + 1
    external_member_rows = []
    if has_table("song_external_members"):
        external_member_rows = (
            db.query(SongExternalMember)
            .filter(SongExternalMember.song_request_id == song.id)
            .order_by(SongExternalMember.created_at.asc())
            .all()
        )
        for external_member in external_member_rows:
            accepted_counts[external_member.part] = accepted_counts.get(external_member.part, 0) + 1

    recruiting_parts = [
        RecruitingPartResponse(
            part=r.part,
            required_count=r.required_count,
            accepted_count=accepted_counts.get(r.part, 0),
        )
        for r in recruiting_rows
    ]

    # 応募/オファー一覧
    entry_rows = (
        db.query(SongPartEntry, User)
        .join(User, SongPartEntry.user_id == User.id)
        .filter(SongPartEntry.song_request_id == song.id)
        .all()
    )
    entries = [
        EntryResponse(
            id=e.id,
            user_id=e.user_id,
            user_name=u.name,
            part=e.part,
            part_detail=e.part_detail,
            kind=e.kind,
            status=e.status,
            timing_memo=e.timing_memo,
        )
        for e, u in entry_rows
    ]

    external_members = [
        ExternalMemberResponse(id=row.id, part=row.part, member_name=row.member_name)
        for row in external_member_rows
    ]

    # チャット部屋
    chat = db.query(SongChatRoom).filter(SongChatRoom.song_request_id == song.id).first()

    # ライブ申請状況 (最新のものを1件取得)
    latest_app = (
        db.query(SongLiveApplication, LiveEvent)
        .join(LiveEvent, SongLiveApplication.live_event_id == LiveEvent.id)
        .filter(SongLiveApplication.song_request_id == song.id)
        .order_by(SongLiveApplication.applied_at.desc())
        .first()
    )
    latest_live_event_name = None
    latest_live_event_date = None
    latest_live_application_status = None
    if latest_app:
        app, event = latest_app
        latest_live_event_name = event.name
        latest_live_event_date = event.event_date
        latest_live_application_status = app.status

    return SongItemResponse(
        id=song.id,
        circle_id=song.circle_id,
        title=song.title,
        artist=song.artist,
        reference_url=song.reference_url,
        memo=song.memo,
        timing_preference_memo=song.timing_preference_memo,
        status=song.status,
        requested_by=requester.name,
        requested_by_id=requester.id,
        matching_parts=matching_parts or [],
        recruiting_parts=recruiting_parts,
        external_members=external_members,
        entries=entries,
        chat_room_id=chat.id if chat else None,
        planned_month=song.planned_month,
        latest_live_event_name=latest_live_event_name,
        latest_live_event_date=latest_live_event_date,
        latest_live_application_status=latest_live_application_status,
    )


def ensure_chat_room(db: Session, song_request_id: UUID, requester_id: UUID) -> SongChatRoom:
    """
    SongChatRoom がなければ作成。起案者をデフォルトで参加させる。
    呼び出し側で db.commit() が必要。
    """
    from models import ChatRoomParticipant

    chat = db.query(SongChatRoom).filter(
        SongChatRoom.song_request_id == song_request_id
    ).first()
    if chat:
        return chat

    chat = SongChatRoom(song_request_id=song_request_id)
    db.add(chat)
    db.flush()

    db.add(ChatRoomParticipant(chat_room_id=chat.id, user_id=requester_id))
    db.flush()
    return chat


def add_chat_participant(db: Session, chat_room_id: UUID, user_id: UUID) -> None:
    """既存メンバーチェックして、いなければ追加。呼び出し側で commit。"""
    from models import ChatRoomParticipant

    exists = db.query(ChatRoomParticipant).filter(
        ChatRoomParticipant.chat_room_id == chat_room_id,
        ChatRoomParticipant.user_id == user_id,
    ).first()
    if exists:
        return
    db.add(ChatRoomParticipant(chat_room_id=chat_room_id, user_id=user_id))
    db.flush()
