"""
ライブ申請(SongLiveApplication) ルーター。
曲を特定のライブに申請 → 主催者が承認/却下。
"""

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from deps import (
    get_db, get_current_user, require_circle_member, require_circle_permission_for_action,
)
from models import (
    User, SongRequest, LiveEvent, SongLiveApplication, Notification,
)
from schemas.live_event import (
    SongLiveApplicationCreateRequest, SongLiveApplicationDecisionRequest,
    SongLiveApplicationResponse,
)
from services.circle_admin_logs import add_circle_admin_action_log


router = APIRouter(tags=["live_applications"])


def _to_response(a: SongLiveApplication) -> SongLiveApplicationResponse:
    return SongLiveApplicationResponse(
        id=a.id,
        song_request_id=a.song_request_id,
        live_event_id=a.live_event_id,
        status=a.status,
        applied_by=a.applied_by,
        applied_at=a.applied_at,
        decided_by=a.decided_by,
        decided_at=a.decided_at,
        memo=a.memo,
    )


# ------------------- ライブ申請 (起案者→主催者) -------------------
@router.post(
    "/songs/{song_id}/live-applications",
    response_model=SongLiveApplicationResponse,
)
def apply_to_live(
    request: SongLiveApplicationCreateRequest,
    song_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(SongRequest).filter(SongRequest.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    if song.requested_by != current_user.id:
        raise HTTPException(status_code=403, detail="起案者のみ申請できます")

    event = db.query(LiveEvent).filter(LiveEvent.id == request.live_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="LiveEvent not found")
    if event.circle_id != song.circle_id:
        raise HTTPException(status_code=400, detail="他のサークルのライブには申請できません")
    if event.lifecycle_status != "scheduled":
        raise HTTPException(status_code=400, detail="開催前のライブにのみ申請できます")
    if event.entry_status != "open":
        raise HTTPException(status_code=400, detail="このライブはエントリー受付中ではありません")

    # 既にアクティブな申請がある?
    active = (
        db.query(SongLiveApplication)
        .filter(
            SongLiveApplication.song_request_id == song_id,
            SongLiveApplication.live_event_id == request.live_event_id,
            SongLiveApplication.status.in_(["applied", "approved"]),
        )
        .first()
    )
    if active:
        raise HTTPException(status_code=400, detail="既にこのライブに申請済みです")

    app_row = SongLiveApplication(
        song_request_id=song_id,
        live_event_id=request.live_event_id,
        status="applied",
        applied_by=current_user.id,
        applied_at=datetime.utcnow(),
        memo=request.memo,
    )
    db.add(app_row)
    db.commit()
    db.refresh(app_row)
    return _to_response(app_row)


# ------------------- 主催者の承認/却下 -------------------
@router.patch(
    "/live-applications/{app_id}",
    response_model=SongLiveApplicationResponse,
)
def decide_live_application(
    request: SongLiveApplicationDecisionRequest,
    app_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app_row = db.query(SongLiveApplication).filter(SongLiveApplication.id == app_id).first()
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")

    event = db.query(LiveEvent).filter(LiveEvent.id == app_row.live_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="LiveEvent not found")
    if event.lifecycle_status != "scheduled":
        raise HTTPException(status_code=400, detail="開催前のライブのみ承認/却下できます")

    if request.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status は approved/rejected")

    required_permission = (
        "approve_live_applications"
        if request.status == "approved"
        else "reject_live_applications"
    )
    require_circle_permission_for_action(
        db,
        event.circle_id,
        current_user.id,
        required_permission,
        "ライブ申請を処理する権限が必要です",
    )

    app_row.status = request.status
    app_row.decided_by = current_user.id
    app_row.decided_at = datetime.utcnow()
    if request.memo is not None:
        app_row.memo = request.memo

    song = db.query(SongRequest).filter(SongRequest.id == app_row.song_request_id).first()
    result_label = "承認" if request.status == "approved" else "却下"
    add_circle_admin_action_log(
        db,
        circle_id=event.circle_id,
        actor_user_id=current_user.id,
        permission_key=required_permission,
        target_type="live_application",
        target_id=app_row.id,
        summary=f"「{song.title}」のライブ申請を{result_label}",
        details=f"ライブ: {event.name}",
    )
    title = f"ライブ出演申請が{result_label}されました"
    body = f"{event.name} への「{song.title}」の出演申請が{result_label}されました。"
    notification_type = (
        "live_application_approved"
        if request.status == "approved"
        else "live_application_rejected"
    )
    db.add(Notification(
        user_id=app_row.applied_by,
        type=notification_type,
        title=title,
        body=body,
        link_path=f"/songs/{song.id}",
        related_song_live_application_id=app_row.id,
    ))
    db.commit()
    db.refresh(app_row)
    return _to_response(app_row)


# ------------------- 申請取り下げ (起案者) -------------------
@router.post(
    "/live-applications/{app_id}/withdraw",
    response_model=SongLiveApplicationResponse,
)
def withdraw_application(
    app_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app_row = db.query(SongLiveApplication).filter(SongLiveApplication.id == app_id).first()
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    if app_row.applied_by != current_user.id:
        raise HTTPException(status_code=403, detail="申請者のみ取り下げできます")

    event = db.query(LiveEvent).filter(LiveEvent.id == app_row.live_event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="LiveEvent not found")
    if event.lifecycle_status != "scheduled":
        raise HTTPException(status_code=400, detail="開催前のライブのみ取り下げできます")

    app_row.status = "withdrawn"
    db.commit()
    db.refresh(app_row)
    return _to_response(app_row)


# ------------------- 一覧 -------------------
@router.get(
    "/songs/{song_id}/live-applications",
    response_model=List[SongLiveApplicationResponse],
)
def list_song_applications(
    song_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(SongRequest).filter(SongRequest.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    require_circle_member(db, song.circle_id, current_user.id)

    rows = (
        db.query(SongLiveApplication)
        .filter(SongLiveApplication.song_request_id == song_id)
        .order_by(SongLiveApplication.applied_at.desc())
        .all()
    )
    return [_to_response(r) for r in rows]


@router.get(
    "/live-events/{event_id}/applications",
    response_model=List[SongLiveApplicationResponse],
)
def list_event_applications(
    event_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """主催者が「このライブに何の曲が申請されてるか」見る用"""
    event = db.query(LiveEvent).filter(LiveEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="LiveEvent not found")
    require_circle_member(db, event.circle_id, current_user.id)

    rows = (
        db.query(SongLiveApplication)
        .filter(SongLiveApplication.live_event_id == event_id)
        .order_by(SongLiveApplication.applied_at.asc())
        .all()
    )
    return [_to_response(r) for r in rows]
