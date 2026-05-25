"""
定期ライブ管理:
- POST /circles/{circle_id}/live-events  ← 主催者がライブ作成
- GET /circles/{circle_id}/live-events   ← 一覧
- PATCH /live-events/{event_id}          ← 名前変更/受付open/closed
- PUT /me/live-events/{event_id}/status  ← 自分の月別意思表明
"""

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from database import has_table
from deps import (
    get_db, get_current_user, require_circle_member, require_circle_admin,
)
from models import (
    User, Circle, LiveEvent, UserLiveEventStatus,
    SongLiveApplication, SongRequest, SongRecruitingPart, SongPartEntry, SongExternalMember,
)
from schemas.live_event import (
    LiveEventCreateRequest, LiveEventUpdateRequest, LiveEventResponse,
    UserLiveEventStatusUpdateRequest, UserLiveEventStatusResponse,
    LiveEventSongSummaryResponse,
)


router = APIRouter(tags=["live_events"])


def _build_live_event_response(db: Session, event: LiveEvent) -> LiveEventResponse:
    applications = (
        db.query(SongLiveApplication, SongRequest)
        .join(SongRequest, SongLiveApplication.song_request_id == SongRequest.id)
        .filter(
            SongLiveApplication.live_event_id == event.id,
            SongLiveApplication.status.in_(["applied", "approved"]),
        )
        .order_by(SongLiveApplication.applied_at.asc())
        .all()
    )

    songs: list[LiveEventSongSummaryResponse] = []
    for application, song in applications:
        accepted_counts: dict[str, int] = {}
        for entry in db.query(SongPartEntry).filter(
            SongPartEntry.song_request_id == song.id,
            SongPartEntry.status == "accepted",
        ).all():
            accepted_counts[entry.part] = accepted_counts.get(entry.part, 0) + 1
        if has_table("song_external_members"):
            for external_member in db.query(SongExternalMember).filter(
                SongExternalMember.song_request_id == song.id
            ).all():
                accepted_counts[external_member.part] = accepted_counts.get(external_member.part, 0) + 1

        recruiting_labels: list[str] = []
        for recruiting_part in db.query(SongRecruitingPart).filter(
            SongRecruitingPart.song_request_id == song.id
        ).all():
            remaining = recruiting_part.required_count - accepted_counts.get(recruiting_part.part, 0)
            if remaining > 0:
                suffix = f"{remaining}人" if remaining > 1 else ""
                recruiting_labels.append(f"{recruiting_part.part}募集中{suffix}")

        songs.append(
            LiveEventSongSummaryResponse(
                song_id=song.id,
                title=song.title,
                artist=song.artist,
                song_status=song.status,
                live_application_status=application.status,
                recruiting_labels=recruiting_labels,
            )
        )

    return LiveEventResponse(
        id=event.id,
        circle_id=event.circle_id,
        name=event.name,
        event_date=event.event_date,
        entry_status=event.entry_status,
        created_by=event.created_by,
        created_at=event.created_at,
        songs=songs,
    )


@router.post("/circles/{circle_id}/live-events", response_model=LiveEventResponse)
def create_live_event(
    request: LiveEventCreateRequest,
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    require_circle_admin(db, circle_id, current_user.id)

    event = LiveEvent(
        circle_id=circle_id,
        name=request.name,
        event_date=request.event_date,
        entry_status=request.entry_status or "open",
        created_by=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _build_live_event_response(db, event)


@router.get("/circles/{circle_id}/live-events", response_model=List[LiveEventResponse])
def list_live_events(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_circle_member(db, circle_id, current_user.id)
    events = (
        db.query(LiveEvent)
        .filter(LiveEvent.circle_id == circle_id)
        .order_by(LiveEvent.event_date.asc().nullslast(), LiveEvent.created_at.asc())
        .all()
    )
    return [_build_live_event_response(db, e) for e in events]


@router.patch("/live-events/{event_id}", response_model=LiveEventResponse)
def update_live_event(
    request: LiveEventUpdateRequest,
    event_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.query(LiveEvent).filter(LiveEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="LiveEvent not found")
    require_circle_admin(db, event.circle_id, current_user.id)

    if request.name is not None:
        event.name = request.name
    if request.event_date is not None:
        event.event_date = request.event_date
    if request.entry_status is not None:
        if request.entry_status not in ("open", "closed"):
            raise HTTPException(status_code=400, detail="entry_status は open/closed")
        event.entry_status = request.entry_status
    db.commit()
    db.refresh(event)
    return _build_live_event_response(db, event)


# ------------------- ユーザーの月別意思表明 -------------------
@router.put("/me/live-events/{event_id}/status", response_model=UserLiveEventStatusResponse)
def update_my_live_event_status(
    request: UserLiveEventStatusUpdateRequest,
    event_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.query(LiveEvent).filter(LiveEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="LiveEvent not found")
    require_circle_member(db, event.circle_id, current_user.id)

    allowed = {"want_invites", "available", "unavailable"}
    if request.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status は {allowed} のいずれか")

    row = (
        db.query(UserLiveEventStatus)
        .filter(
            UserLiveEventStatus.user_id == current_user.id,
            UserLiveEventStatus.live_event_id == event_id,
        )
        .first()
    )
    if row:
        row.status = request.status
        row.memo = request.memo
        row.updated_at = datetime.utcnow()
    else:
        row = UserLiveEventStatus(
            user_id=current_user.id,
            live_event_id=event_id,
            status=request.status,
            memo=request.memo,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return UserLiveEventStatusResponse(
        live_event_id=row.live_event_id,
        status=row.status,
        memo=row.memo,
    )


@router.get(
    "/circles/{circle_id}/live-events/{event_id}/user-statuses",
    response_model=List[dict],
)
def list_user_statuses(
    circle_id: UUID = Path(...),
    event_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """この月、誰が何を表明しているか。起案者がメンバーを探すときに使う。"""
    require_circle_member(db, circle_id, current_user.id)

    rows = (
        db.query(UserLiveEventStatus, User)
        .join(User, UserLiveEventStatus.user_id == User.id)
        .filter(UserLiveEventStatus.live_event_id == event_id)
        .all()
    )
    return [
        {
            "user_id": str(u.id),
            "user_name": u.name,
            "status": s.status,
            "memo": s.memo,
        }
        for s, u in rows
    ]
