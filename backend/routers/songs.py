"""曲起票・更新・確定/取消・自分向け一覧"""

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from deps import get_db, get_current_user, require_circle_member
from models import (
    User, Circle, SongRequest, SongRecruitingPart, SongPartEntry, SongExternalMember, UserPart,
)
from schemas.song import (
    SongCreateRequest, SongUpdateRequest, SongStatusUpdateRequest,
    SongItemResponse, CircleSongsForMeResponse,
)
from services.song_builder import build_song_item, ensure_chat_room, add_chat_participant
from services.circle_permissions import get_effective_circle_permission_keys


router = APIRouter(tags=["songs"])


# ------------------- 曲起票 -------------------
@router.post("/circles/{circle_id}/songs")
def create_song(
    request: SongCreateRequest,
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    require_circle_member(db, circle_id, current_user.id)

    title = request.title.strip()
    artist = request.artist.strip()
    reference_url = request.reference_url.strip() if request.reference_url else None

    if not title:
        raise HTTPException(status_code=400, detail="曲名を入力してください")
    if not artist:
        raise HTTPException(status_code=400, detail="アーティスト名を入力してください")

    recruiting_parts: list[tuple[str, int]] = []
    preassigned_members: list[tuple[User, str]] = []
    external_members: list[tuple[str, str]] = []

    if request.part_setups:
        normalized_setups: dict[str, object] = {}
        for setup in request.part_setups:
            part = setup.part.strip()
            if not part:
                continue
            normalized_setups[part] = setup

        for part, raw_setup in normalized_setups.items():
            setup = raw_setup
            if setup.slots:
                recruiting_count = 0
                seen_member_ids = set()
                for slot in setup.slots:
                    mode = slot.mode.strip()
                    if mode == "recruiting":
                        recruiting_count += 1
                        continue
                    if mode == "self":
                        if current_user.id in seen_member_ids:
                            raise HTTPException(status_code=400, detail=f"{part} で同じメンバーは重複指定できません")
                        seen_member_ids.add(current_user.id)
                        preassigned_members.append((current_user, part))
                        continue
                    if mode == "circle_member":
                        if not slot.user_id:
                            raise HTTPException(
                                status_code=400,
                                detail=f"{part} のサークル内メンバーを選択してください",
                            )
                        if slot.user_id in seen_member_ids:
                            raise HTTPException(status_code=400, detail=f"{part} で同じメンバーは重複指定できません")
                        seen_member_ids.add(slot.user_id)
                        member = db.query(User).filter(User.id == slot.user_id).first()
                        if not member:
                            raise HTTPException(status_code=404, detail="指名したメンバーが見つかりません")
                        require_circle_member(db, circle_id, member.id)
                        preassigned_members.append((member, part))
                        continue
                    if mode == "external_member":
                        external_name = slot.external_name.strip() if slot.external_name else ""
                        if not external_name:
                            raise HTTPException(
                                status_code=400,
                                detail=f"{part} の外部メンバー名を入力してください",
                            )
                        external_members.append((part, external_name))
                        continue
                    raise HTTPException(status_code=400, detail=f"{part} の設定モードが不正です")

                if recruiting_count > 0:
                    recruiting_parts.append((part, recruiting_count))
                continue

            mode = setup.mode.strip()
            slot_count = max(1, setup.slot_count)
            if mode == "not_needed":
                continue
            if mode == "recruiting":
                required_count = max(1, setup.required_count if setup.required_count else slot_count)
                recruiting_parts.append((part, required_count))
                continue
            if mode == "self":
                if slot_count != 1:
                    raise HTTPException(status_code=400, detail=f"{part} で自分を設定できるのは1枠までです")
                preassigned_members.append((current_user, part))
                continue
            if mode == "circle_member":
                member_ids = list(setup.user_ids or ([] if not setup.user_id else [setup.user_id]))
                if len(member_ids) != slot_count:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{part} のサークル内メンバーを {slot_count} 人選択してください",
                    )
                seen_member_ids = set()
                for member_id in member_ids:
                    if member_id in seen_member_ids:
                        raise HTTPException(status_code=400, detail=f"{part} で同じメンバーは重複指定できません")
                    seen_member_ids.add(member_id)
                    member = db.query(User).filter(User.id == member_id).first()
                    if not member:
                        raise HTTPException(status_code=404, detail="指名したメンバーが見つかりません")
                    require_circle_member(db, circle_id, member.id)
                    preassigned_members.append((member, part))
                continue
            if mode == "external_member":
                external_names = list(setup.external_names or ([] if not setup.external_name else [setup.external_name]))
                normalized_names = [name.strip() for name in external_names if name.strip()]
                if len(normalized_names) != slot_count:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{part} の外部メンバー名を {slot_count} 人分入力してください",
                    )
                for external_name in normalized_names:
                    external_members.append((part, external_name))
                continue
            raise HTTPException(status_code=400, detail=f"{part} の設定モードが不正です")
    else:
        seen_recruiting = set()
        for rp in request.recruiting_parts:
            part = rp.part.strip()
            if not part or part in seen_recruiting:
                continue
            seen_recruiting.add(part)
            recruiting_parts.append((part, max(1, rp.required_count)))

        seen_preassigned = set()
        for assigned in request.preassigned_members:
            part = assigned.part.strip()
            if not part:
                continue

            member = db.query(User).filter(User.id == assigned.user_id).first()
            if not member:
                raise HTTPException(status_code=404, detail="指名したメンバーが見つかりません")
            require_circle_member(db, circle_id, member.id)

            key = (member.id, part)
            if key in seen_preassigned:
                continue
            seen_preassigned.add(key)
            preassigned_members.append((member, part))

    if not recruiting_parts and not preassigned_members and not external_members:
        raise HTTPException(
            status_code=400,
            detail="少なくとも1つのパート設定を追加してください",
        )

    song = SongRequest(
        circle_id=circle_id,
        requested_by=current_user.id,
        title=title,
        artist=artist,
        reference_url=reference_url,
        memo=request.memo,
        timing_preference_memo=request.timing_preference_memo,
        status="recruiting",
    )
    db.add(song)
    db.flush()

    for part, required_count in recruiting_parts:
        db.add(
            SongRecruitingPart(
                song_request_id=song.id,
                part=part,
                required_count=required_count,
            )
        )

    if preassigned_members:
        chat = ensure_chat_room(db, song.id, current_user.id)
        responded_at = datetime.utcnow()
        for member, part in preassigned_members:
            db.add(
                SongPartEntry(
                    song_request_id=song.id,
                    user_id=member.id,
                    part=part,
                    kind="offer",
                    status="accepted",
                    created_by=current_user.id,
                    responded_at=responded_at,
                )
            )
            add_chat_participant(db, chat.id, member.id)

    for part, member_name in external_members:
        db.add(
            SongExternalMember(
                song_request_id=song.id,
                part=part,
                member_name=member_name,
            )
        )

    db.commit()
    db.refresh(song)
    return {"message": "曲を起票しました", "song_id": str(song.id)}


# ------------------- 曲詳細 -------------------
@router.get("/songs/{song_id}", response_model=SongItemResponse)
def get_song(
    song_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(SongRequest).filter(SongRequest.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    require_circle_member(db, song.circle_id, current_user.id)

    requester = db.query(User).filter(User.id == song.requested_by).first()

    # マッチパート
    current_user_parts = set(
        r.part for r in db.query(UserPart).filter(UserPart.user_id == current_user.id).all()
    )
    recruiting = set(
        r.part for r in db.query(SongRecruitingPart)
        .filter(SongRecruitingPart.song_request_id == song.id).all()
    )
    matching = sorted(current_user_parts & recruiting)

    return build_song_item(db, song, requester, matching)


# ------------------- 曲更新 (曲名・アーティスト等の差し替え) -------------------
@router.patch("/songs/{song_id}")
def update_song(
    request: SongUpdateRequest,
    song_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(SongRequest).filter(SongRequest.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    require_circle_member(db, song.circle_id, current_user.id)

    if song.requested_by != current_user.id:
        raise HTTPException(status_code=403, detail="起案者のみ編集できます")

    if request.title is not None:
        song.title = request.title.strip()
    if request.artist is not None:
        song.artist = request.artist.strip()
    if request.reference_url is not None:
        song.reference_url = request.reference_url.strip() or None
    if request.memo is not None:
        song.memo = request.memo
    if request.timing_preference_memo is not None:
        song.timing_preference_memo = request.timing_preference_memo

    db.commit()
    return {"message": "曲情報を更新しました"}


# ------------------- メンバー確定 / 取り消し -------------------
@router.patch("/songs/{song_id}/status")
def update_song_status(
    request: SongStatusUpdateRequest,
    song_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(SongRequest).filter(SongRequest.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.requested_by != current_user.id:
        raise HTTPException(status_code=403, detail="起案者のみ変更できます")

    allowed = {"recruiting", "ready", "archived", "cancelled"}
    if request.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status は {allowed} のいずれか")

    song.status = request.status
    if request.planned_month is not None:
        song.planned_month = request.planned_month or None

    db.commit()
    return {"message": "ステータスを更新しました", "status": song.status}


# ------------------- 自分向け曲一覧 -------------------
@router.get("/circles/{circle_id}/songs/for-me", response_model=CircleSongsForMeResponse)
def get_circle_songs_for_me(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    membership = require_circle_member(db, circle_id, current_user.id)

    current_user_parts = [
        r.part for r in db.query(UserPart).filter(UserPart.user_id == current_user.id).all()
    ]
    current_user_parts_set = set(current_user_parts)

    songs_with_requester = (
        db.query(SongRequest, User)
        .join(User, SongRequest.requested_by == User.id)
        .filter(SongRequest.circle_id == circle_id)
        .all()
    )

    own_songs: List[SongItemResponse] = []
    applicable_songs: List[SongItemResponse] = []
    applied_songs: List[SongItemResponse] = []
    offered_songs: List[SongItemResponse] = []
    joined_songs: List[SongItemResponse] = []
    all_recruiting_songs: List[SongItemResponse] = []

    for song, requester in songs_with_requester:
        # 全ての募集中楽曲(アーカイブやキャンセル以外)を収集
        if song.status == "recruiting":
            all_recruiting_songs.append(build_song_item(db, song, requester))

        # 1. 自分が起票した曲
        if song.requested_by == current_user.id:
            own_songs.append(build_song_item(db, song, requester))
            continue

        # 自分のこの曲に対する entry を確認
        my_entries = (
            db.query(SongPartEntry)
            .filter(
                SongPartEntry.song_request_id == song.id,
                SongPartEntry.user_id == current_user.id,
            )
            .all()
        )
        my_accepted = any(e.status == "accepted" for e in my_entries)
        my_pending_offer = any(
            e.status == "pending" and e.kind == "offer" for e in my_entries
        )
        my_pending_application = any(
            e.status == "pending" and e.kind == "application" for e in my_entries
        )

        recruiting_parts = set(
            r.part for r in db.query(SongRecruitingPart)
            .filter(SongRecruitingPart.song_request_id == song.id).all()
        )
        matching = sorted(recruiting_parts & current_user_parts_set)

        # 優先順位: 参加決定 > お誘い > 応募中 > 応募可能
        if my_accepted:
            joined_songs.append(build_song_item(db, song, requester, matching))
        elif my_pending_offer:
            offered_songs.append(build_song_item(db, song, requester, matching))
        elif my_pending_application:
            applied_songs.append(build_song_item(db, song, requester, matching))
        elif matching and song.status == "recruiting":
            applicable_songs.append(build_song_item(db, song, requester, matching))

    return CircleSongsForMeResponse(
        circle_id=circle.id,
        circle_name=circle.name,
        current_user_id=current_user.id,
        current_user_permissions=get_effective_circle_permission_keys(db, circle_id, current_user.id),
        current_user_parts=current_user_parts,
        own_songs=own_songs,
        applicable_songs=applicable_songs,
        applied_songs=applied_songs,
        offered_songs=offered_songs,
        joined_songs=joined_songs,
        all_recruiting_songs=all_recruiting_songs,
        matching_recruiting_songs=applicable_songs,  # 後方互換
    )
