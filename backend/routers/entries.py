"""
応募(application) と お誘い(offer) を扱うルーター。
両方とも song_part_entries 行になる。

エンドポイント:
- POST /songs/{song_id}/applications  ← ユーザーが応募
- POST /songs/{song_id}/offers        ← 起案者がオファー
- PATCH /entries/{entry_id}           ← status を accepted/declined/withdrawn 等に
- GET /songs/{song_id}/entries        ← entry一覧
"""

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from deps import get_db, get_current_user, require_circle_member
from models import (
    User, SongRequest, SongPartEntry, SongRecruitingPart, SongChatRoom,
    Notification,
)
from schemas.song import (
    ApplicationCreateRequest, OfferCreateRequest, EntryStatusUpdateRequest,
    EntryResponse,
)
from services.song_builder import ensure_chat_room, add_chat_participant


router = APIRouter(tags=["entries"])


def _validate_part(db: Session, song_id: UUID, part: str) -> None:
    """募集パートに含まれているか確認"""
    exists = db.query(SongRecruitingPart).filter(
        SongRecruitingPart.song_request_id == song_id,
        SongRecruitingPart.part == part,
    ).first()
    if not exists:
        raise HTTPException(status_code=400, detail=f"パート '{part}' は募集されていません")


# ------------------- 応募 (user→song) -------------------
@router.post("/songs/{song_id}/applications")
def create_application(
    request: ApplicationCreateRequest,
    song_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(SongRequest).filter(SongRequest.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    require_circle_member(db, song.circle_id, current_user.id)

    if song.requested_by == current_user.id:
        raise HTTPException(status_code=400, detail="自分の曲には応募できません")
    if song.status != "recruiting":
        raise HTTPException(status_code=400, detail="募集中ではない曲には応募できません")

    part = request.part.strip()
    _validate_part(db, song_id, part)

    # アクティブな応募が既にある場合は重複拒否
    active = db.query(SongPartEntry).filter(
        SongPartEntry.song_request_id == song_id,
        SongPartEntry.user_id == current_user.id,
        SongPartEntry.part == part,
        SongPartEntry.status.in_(["pending", "accepted"]),
    ).first()
    if active:
        raise HTTPException(status_code=400, detail="既にこのパートに応募中です")

    entry = SongPartEntry(
        song_request_id=song_id,
        user_id=current_user.id,
        part=part,
        part_detail=request.part_detail,
        kind="application",
        status="pending",
        timing_memo=request.timing_memo,
        created_by=current_user.id,
    )
    db.add(entry)
    db.flush()

    # チャット部屋を作って応募者を参加させる
    chat = ensure_chat_room(db, song_id, song.requested_by)
    add_chat_participant(db, chat.id, current_user.id)

    db.commit()
    db.refresh(entry)
    return {"message": "応募しました", "entry_id": str(entry.id)}


# ------------------- お誘い (requester→user) -------------------
@router.post("/songs/{song_id}/offers")
def create_offer(
    request: OfferCreateRequest,
    song_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(SongRequest).filter(SongRequest.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.requested_by != current_user.id:
        raise HTTPException(status_code=403, detail="起案者のみオファーできます")

    target_user = db.query(User).filter(User.id == request.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="自分自身にはお誘いを送れません")
    # 対象ユーザーが同じサークルに所属しているかチェック
    require_circle_member(db, song.circle_id, target_user.id)

    part = request.part.strip()
    _validate_part(db, song_id, part)

    active = db.query(SongPartEntry).filter(
        SongPartEntry.song_request_id == song_id,
        SongPartEntry.user_id == target_user.id,
        SongPartEntry.part == part,
        SongPartEntry.status.in_(["pending", "accepted"]),
    ).first()
    if active:
        raise HTTPException(status_code=400, detail="既にアクティブな応募/オファーがあります")

    entry = SongPartEntry(
        song_request_id=song_id,
        user_id=target_user.id,
        part=part,
        part_detail=request.part_detail,
        kind="offer",
        status="pending",
        created_by=current_user.id,
    )
    db.add(entry)
    db.flush()

    chat = ensure_chat_room(db, song_id, song.requested_by)
    add_chat_participant(db, chat.id, target_user.id)

    db.add(Notification(
        user_id=target_user.id,
        type="song_part_offer_received",
        title="曲・パートへのお誘いが届きました",
        body=f"「{song.title}」の {part} パートに誘われています。",
        link_path=f"/songs/{song.id}",
        related_song_part_entry_id=entry.id,
    ))

    db.commit()
    db.refresh(entry)
    return {"message": "オファーを送信しました", "entry_id": str(entry.id)}


# ------------------- entry status 変更 -------------------
@router.patch("/entries/{entry_id}")
def update_entry_status(
    request: EntryStatusUpdateRequest,
    entry_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(SongPartEntry).filter(SongPartEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    song = db.query(SongRequest).filter(SongRequest.id == entry.song_request_id).first()

    new_status = request.status
    allowed = {"pending", "accepted", "declined", "withdrawn"}
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"status は {allowed} のいずれか")

    is_requester = song.requested_by == current_user.id
    is_target_user = entry.user_id == current_user.id

    # 権限チェック
    # 応募 → 起案者が accept/decline、応募者が withdraw
    # オファー → 対象ユーザーが accept/decline、起案者が withdraw
    if entry.kind == "application":
        if new_status in ("accepted", "declined") and not is_requester:
            raise HTTPException(status_code=403, detail="起案者のみ承認/拒否できます")
        if new_status == "withdrawn" and not is_target_user:
            raise HTTPException(status_code=403, detail="本人のみ取り下げできます")
    elif entry.kind == "offer":
        if new_status in ("accepted", "declined") and not is_target_user:
            raise HTTPException(status_code=403, detail="誘われた本人のみ反応できます")
        if new_status == "withdrawn" and not is_requester:
            raise HTTPException(status_code=403, detail="起案者のみ取り下げできます")

    previous_status = entry.status
    entry.status = new_status
    entry.responded_at = datetime.utcnow()

    # 通知ロジック
    if previous_status != new_status:
        # 応募(application) に対する通知
        if entry.kind == "application":
            if new_status == "accepted":
                db.add(Notification(
                    user_id=entry.user_id,
                    type="song_application_accepted",
                    title="応募が承認されました！",
                    body=f"「{song.title}」の {entry.part} パートへの応募が承認されました。",
                    link_path=f"/songs/{song.id}",
                    related_song_part_entry_id=entry.id,
                ))
            elif new_status == "declined":
                db.add(Notification(
                    user_id=entry.user_id,
                    type="song_application_declined",
                    title="応募が見送られました",
                    body=f"「{song.title}」の {entry.part} パートへの応募は見送られました。",
                    link_path=f"/songs/{song.id}",
                    related_song_part_entry_id=entry.id,
                ))
        # お誘い(offer) に対する通知
        elif entry.kind == "offer":
            if new_status == "accepted":
                # 誘った人(created_by)へ通知
                db.add(Notification(
                    user_id=entry.created_by,
                    type="song_part_offer_accepted",
                    title="お誘いが承認されました",
                    body=f"{current_user.name} さんが「{song.title}」の {entry.part} パートのお誘いを承認しました。",
                    link_path=f"/songs/{song.id}",
                    related_song_part_entry_id=entry.id,
                ))
            elif new_status == "declined":
                # 誘った人(created_by)へ通知
                db.add(Notification(
                    user_id=entry.created_by,
                    type="song_part_offer_declined",
                    title="お誘いが辞退されました",
                    body=f"{current_user.name} さんが「{song.title}」の {entry.part} パートのお誘いを辞退しました。",
                    link_path=f"/songs/{song.id}",
                    related_song_part_entry_id=entry.id,
                ))

    db.commit()
    return {"message": "entryを更新しました", "status": entry.status}


# ------------------- entry一覧 -------------------
@router.get("/songs/{song_id}/entries", response_model=List[EntryResponse])
def list_entries(
    song_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(SongRequest).filter(SongRequest.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    require_circle_member(db, song.circle_id, current_user.id)

    rows = (
        db.query(SongPartEntry, User)
        .join(User, SongPartEntry.user_id == User.id)
        .filter(SongPartEntry.song_request_id == song_id)
        .order_by(SongPartEntry.created_at.asc())
        .all()
    )
    return [
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
        for e, u in rows
    ]
