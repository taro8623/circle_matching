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
    get_db, get_current_user, require_circle_member, require_circle_permission_for_action,
)
from models import (
    User, Circle, CircleMember, LiveEvent, UserLiveEventStatus,
    SongLiveApplication, SongRequest, SongRecruitingPart, SongPartEntry, SongExternalMember,
    Notification, UserPart, LiveEventParticipantPayment,
)
from schemas.live_event import (
    LiveEventCreateRequest, LiveEventUpdateRequest, LiveEventResponse,
    UserLiveEventStatusUpdateRequest, UserLiveEventStatusResponse,
    LiveEventSongSummaryResponse,
    LiveEventParticipantAssignmentResponse, LiveEventParticipantResponse, LiveEventParticipantsResponse,
    LiveEventParticipantPaymentStatusUpdateRequest, LiveEventParticipantPaymentStatusResponse,
)
from services.circle_admin_logs import add_circle_admin_action_log
from services.circle_permissions import has_circle_permission


router = APIRouter(tags=["live_events"])

PARTICIPANT_TYPES = {"circle_member", "external_member"}
PAYMENT_STATUSES = {"unpaid", "paid"}


def _notify_circle_members(
    db: Session,
    *,
    circle_id: UUID,
    actor_user_id: UUID,
    notification_type: str,
    title: str,
    body: str,
    link_path: str,
) -> None:
    member_ids = [
        user_id
        for user_id, in (
            db.query(CircleMember.user_id)
            .filter(
                CircleMember.circle_id == circle_id,
                CircleMember.left_at.is_(None),
                CircleMember.user_id != actor_user_id,
            )
            .all()
        )
    ]
    for member_id in member_ids:
        db.add(Notification(
            user_id=member_id,
            type=notification_type,
            title=title,
            body=body,
            link_path=link_path,
        ))


def _event_month_key(event: LiveEvent) -> str | None:
    if not event.event_date:
        return None
    return event.event_date.strftime("%Y-%m")


def _build_current_user_auto_labels(
    db: Session,
    event: LiveEvent,
    current_user: User,
) -> list[str]:
    accepted_song_ids = [
        song_id
        for song_id, in (
            db.query(SongPartEntry.song_request_id)
            .join(SongRequest, SongPartEntry.song_request_id == SongRequest.id)
            .filter(
                SongPartEntry.user_id == current_user.id,
                SongPartEntry.status == "accepted",
                SongRequest.circle_id == event.circle_id,
            )
            .distinct()
            .all()
        )
    ]
    if not accepted_song_ids:
        return []

    if event.lifecycle_status != "scheduled":
        return []

    month_key = _event_month_key(event)
    if month_key:
        target_event_ids = [
            live_event.id
            for live_event in db.query(LiveEvent).filter(LiveEvent.circle_id == event.circle_id).all()
            if (
                live_event.lifecycle_status == "scheduled"
                and live_event.event_date
                and live_event.event_date.strftime("%Y-%m") == month_key
            )
        ]
    else:
        target_event_ids = [event.id]

    approved_song_ids: set[UUID] = set()
    applied_song_ids: set[UUID] = set()
    if target_event_ids:
        applications = (
            db.query(SongLiveApplication.song_request_id, SongLiveApplication.status)
            .filter(
                SongLiveApplication.song_request_id.in_(accepted_song_ids),
                SongLiveApplication.live_event_id.in_(target_event_ids),
                SongLiveApplication.status.in_(["applied", "approved"]),
            )
            .all()
        )
        for song_request_id, status in applications:
            if status == "approved":
                approved_song_ids.add(song_request_id)
                applied_song_ids.discard(song_request_id)
            elif song_request_id not in approved_song_ids:
                applied_song_ids.add(song_request_id)

    ready_song_ids: set[UUID] = set()
    if month_key:
        ready_song_ids = {
            song_id
            for song_id, in (
                db.query(SongRequest.id)
                .filter(
                    SongRequest.id.in_(accepted_song_ids),
                    SongRequest.circle_id == event.circle_id,
                    SongRequest.status == "ready",
                    SongRequest.planned_month == month_key,
                )
                .all()
            )
        }
        ready_song_ids -= approved_song_ids
        ready_song_ids -= applied_song_ids

    labels: list[str] = []
    if month_key:
        if approved_song_ids:
            labels.append(f"自動集計: この月は出演確定 {len(approved_song_ids)} 曲")
        if applied_song_ids:
            labels.append(f"自動集計: この月は申請中 {len(applied_song_ids)} 曲")
        if ready_song_ids:
            labels.append(f"自動集計: この月は参加予定 {len(ready_song_ids)} 曲")
    else:
        if approved_song_ids:
            labels.append(f"自動集計: このライブは出演確定 {len(approved_song_ids)} 曲")
        if applied_song_ids:
            labels.append(f"自動集計: このライブは申請中 {len(applied_song_ids)} 曲")
    return labels


def _build_live_event_participant_summary(
    db: Session, event: LiveEvent
) -> tuple[list[LiveEventParticipantResponse], int]:
    payment_statuses = {
        (row.participant_type, row.participant_key): row.payment_status
        for row in (
            db.query(LiveEventParticipantPayment)
            .filter(LiveEventParticipantPayment.live_event_id == event.id)
            .all()
        )
    }
    approved_applications = (
        db.query(SongLiveApplication, SongRequest)
        .join(SongRequest, SongLiveApplication.song_request_id == SongRequest.id)
        .filter(
            SongLiveApplication.live_event_id == event.id,
            SongLiveApplication.status == "approved",
        )
        .order_by(SongRequest.title.asc(), SongLiveApplication.applied_at.asc())
        .all()
    )

    active_members = (
        db.query(CircleMember, User)
        .join(User, CircleMember.user_id == User.id)
        .filter(
            CircleMember.circle_id == event.circle_id,
            CircleMember.left_at.is_(None),
        )
        .all()
    )
    circle_role_by_user_id = {
        user.id: membership.role
        for membership, user in active_members
    }
    profile_parts_by_user_id: dict[UUID, list[str]] = {}
    for user_id, part in db.query(UserPart.user_id, UserPart.part).all():
        profile_parts_by_user_id.setdefault(user_id, []).append(part)

    participants: dict[tuple[str, str], LiveEventParticipantResponse] = {}
    for application, song in approved_applications:
        accepted_entries = (
            db.query(SongPartEntry, User)
            .join(User, SongPartEntry.user_id == User.id)
            .filter(
                SongPartEntry.song_request_id == song.id,
                SongPartEntry.status == "accepted",
            )
            .order_by(User.name.asc(), SongPartEntry.part.asc())
            .all()
        )
        for entry, user in accepted_entries:
            participant_key = str(user.id)
            key = ("circle_member", participant_key)
            participant = participants.get(key)
            if participant is None:
                participant = LiveEventParticipantResponse(
                    participant_type="circle_member",
                    participant_key=participant_key,
                    user_id=user.id,
                    display_name=user.name,
                    circle_role=circle_role_by_user_id.get(user.id),
                    payment_status=payment_statuses.get(key, "unpaid"),
                    profile_parts=sorted(profile_parts_by_user_id.get(user.id, [])),
                    assignments=[],
                )
                participants[key] = participant
            participant.assignments.append(
                LiveEventParticipantAssignmentResponse(
                    song_id=song.id,
                    title=song.title,
                    artist=song.artist,
                    part=entry.part,
                )
            )

        external_members = (
            db.query(SongExternalMember)
            .filter(SongExternalMember.song_request_id == song.id)
            .order_by(SongExternalMember.member_name.asc(), SongExternalMember.part.asc())
            .all()
        )
        for external_member in external_members:
            participant_key = external_member.member_name
            key = ("external_member", participant_key)
            participant = participants.get(key)
            if participant is None:
                participant = LiveEventParticipantResponse(
                    participant_type="external_member",
                    participant_key=participant_key,
                    display_name=external_member.member_name,
                    payment_status=payment_statuses.get(key, "unpaid"),
                    assignments=[],
                )
                participants[key] = participant
            participant.assignments.append(
                LiveEventParticipantAssignmentResponse(
                    song_id=song.id,
                    title=song.title,
                    artist=song.artist,
                    part=external_member.part,
                )
            )

    participant_list = sorted(
        participants.values(),
        key=lambda item: (item.participant_type != "circle_member", item.display_name.lower()),
    )
    for participant in participant_list:
        participant.assignments.sort(key=lambda item: (item.title.lower(), item.part.lower()))

    return participant_list, len(approved_applications)


def _build_live_event_response(db: Session, event: LiveEvent, current_user: User) -> LiveEventResponse:
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

    current_user_status = (
        db.query(UserLiveEventStatus)
        .filter(
            UserLiveEventStatus.user_id == current_user.id,
            UserLiveEventStatus.live_event_id == event.id,
        )
        .first()
    )
    participant_list, _approved_song_count = _build_live_event_participant_summary(db, event)

    return LiveEventResponse(
        id=event.id,
        circle_id=event.circle_id,
        name=event.name,
        event_date=event.event_date,
        entry_status=event.entry_status,
        lifecycle_status=event.lifecycle_status,
        created_by=event.created_by,
        created_at=event.created_at,
        songs=songs,
        participant_count=len(participant_list),
        current_user_status=current_user_status.status if current_user_status else "want_invites",
        current_user_status_memo=current_user_status.memo if current_user_status else None,
        current_user_auto_labels=_build_current_user_auto_labels(db, event, current_user),
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
    require_circle_permission_for_action(
        db,
        circle_id,
        current_user.id,
        "create_live_event",
        "ライブ作成権限が必要です",
    )
    if request.entry_status not in ("open", "closed"):
        raise HTTPException(status_code=400, detail="entry_status は open/closed")
    if request.lifecycle_status not in ("scheduled", "completed", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail="lifecycle_status は scheduled/completed/cancelled",
        )

    event = LiveEvent(
        circle_id=circle_id,
        name=request.name,
        event_date=request.event_date,
        entry_status=request.entry_status or "closed",
        lifecycle_status=request.lifecycle_status or "scheduled",
        created_by=current_user.id,
    )
    db.add(event)
    db.flush()
    add_circle_admin_action_log(
        db,
        circle_id=circle_id,
        actor_user_id=current_user.id,
        permission_key="create_live_event",
        target_type="live_event",
        target_id=event.id,
        summary=f"ライブ「{event.name}」を作成",
        details=f"受付: {event.entry_status} / 状態: {event.lifecycle_status}",
    )
    db.commit()
    db.refresh(event)
    return _build_live_event_response(db, event, current_user)


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
    return [_build_live_event_response(db, e, current_user) for e in events]


@router.get("/live-events/{event_id}/participants", response_model=LiveEventParticipantsResponse)
def get_live_event_participants(
    event_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.query(LiveEvent).filter(LiveEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="LiveEvent not found")

    require_circle_permission_for_action(
        db,
        event.circle_id,
        current_user.id,
        "view_live_participants",
        "ライブ参加者リストを閲覧する権限が必要です",
    )

    participant_list, approved_song_count = _build_live_event_participant_summary(db, event)

    return LiveEventParticipantsResponse(
        live_event_id=event.id,
        circle_id=event.circle_id,
        live_event_name=event.name,
        event_date=event.event_date,
        lifecycle_status=event.lifecycle_status,
        approved_song_count=approved_song_count,
        participant_count=len(participant_list),
        can_manage_payments=has_circle_permission(
            db,
            event.circle_id,
            current_user.id,
            "manage_live_payments",
        ),
        participants=participant_list,
    )


@router.patch(
    "/live-events/{event_id}/participants/payment-status",
    response_model=LiveEventParticipantPaymentStatusResponse,
)
def update_live_event_participant_payment_status(
    request: LiveEventParticipantPaymentStatusUpdateRequest,
    event_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.query(LiveEvent).filter(LiveEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="LiveEvent not found")

    require_circle_permission_for_action(
        db,
        event.circle_id,
        current_user.id,
        "manage_live_payments",
        "ライブ参加費の決済状態を更新する権限が必要です",
    )

    if request.participant_type not in PARTICIPANT_TYPES:
        raise HTTPException(status_code=400, detail="participant_type が不正です")
    if request.payment_status not in PAYMENT_STATUSES:
        raise HTTPException(status_code=400, detail="payment_status は unpaid/paid")
    if not request.participant_key.strip():
        raise HTTPException(status_code=400, detail="participant_key は必須です")

    participant_list, _approved_song_count = _build_live_event_participant_summary(db, event)
    participant = next(
        (
            item
            for item in participant_list
            if item.participant_type == request.participant_type
            and item.participant_key == request.participant_key
        ),
        None,
    )
    if participant is None:
        raise HTTPException(status_code=404, detail="Participant not found in this live event")

    row = (
        db.query(LiveEventParticipantPayment)
        .filter(
            LiveEventParticipantPayment.live_event_id == event.id,
            LiveEventParticipantPayment.participant_type == request.participant_type,
            LiveEventParticipantPayment.participant_key == request.participant_key,
        )
        .first()
    )
    previous_status = participant.payment_status
    if row is None:
        row = LiveEventParticipantPayment(
            live_event_id=event.id,
            participant_type=request.participant_type,
            participant_key=request.participant_key,
            payment_status=request.payment_status,
            updated_by=current_user.id,
        )
        db.add(row)
    else:
        row.payment_status = request.payment_status
        row.updated_by = current_user.id
        row.updated_at = datetime.utcnow()

    if previous_status != request.payment_status:
        add_circle_admin_action_log(
            db,
            circle_id=event.circle_id,
            actor_user_id=current_user.id,
            permission_key="manage_live_payments",
            target_type="live_event_participant_payment",
            target_id=None,
            summary=f"ライブ「{event.name}」の決済状態を更新",
            details=(
                f"対象: {participant.display_name} / 種別: {request.participant_type} / "
                f"状態: {previous_status} -> {request.payment_status}"
            ),
        )

    db.commit()
    db.refresh(row)
    return LiveEventParticipantPaymentStatusResponse(
        live_event_id=event.id,
        participant_type=row.participant_type,
        participant_key=row.participant_key,
        payment_status=row.payment_status,
        updated_at=row.updated_at,
    )


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
    previous_entry_status = event.entry_status
    previous_lifecycle_status = event.lifecycle_status

    if request.name is not None:
        require_circle_permission_for_action(
            db,
            event.circle_id,
            current_user.id,
            "create_live_event",
            "ライブ編集権限が必要です",
        )
        event.name = request.name
    if request.event_date is not None:
        require_circle_permission_for_action(
            db,
            event.circle_id,
            current_user.id,
            "create_live_event",
            "ライブ編集権限が必要です",
        )
        event.event_date = request.event_date
    if request.entry_status is not None:
        if request.entry_status not in ("open", "closed"):
            raise HTTPException(status_code=400, detail="entry_status は open/closed")
        required_permission = (
            "open_live_entry" if request.entry_status == "open" else "close_live_entry"
        )
        require_circle_permission_for_action(
            db,
            event.circle_id,
            current_user.id,
            required_permission,
            "ライブ受付を変更する権限が必要です",
        )
        previous_status = event.entry_status
        event.entry_status = request.entry_status
        if previous_status != event.entry_status:
            add_circle_admin_action_log(
                db,
                circle_id=event.circle_id,
                actor_user_id=current_user.id,
                permission_key=required_permission,
                target_type="live_event",
                target_id=event.id,
                summary=f"ライブ「{event.name}」の受付を変更",
                details=f"受付: {previous_status} -> {event.entry_status}",
            )
    if request.lifecycle_status is not None:
        if request.lifecycle_status not in ("scheduled", "completed", "cancelled"):
            raise HTTPException(
                status_code=400,
                detail="lifecycle_status は scheduled/completed/cancelled",
            )
        required_permission = {
            "scheduled": "revert_live_to_scheduled",
            "completed": "mark_live_completed",
            "cancelled": "mark_live_cancelled",
        }[request.lifecycle_status]
        require_circle_permission_for_action(
            db,
            event.circle_id,
            current_user.id,
            required_permission,
            "ライブ状態を変更する権限が必要です",
        )
        previous_status = event.lifecycle_status
        event.lifecycle_status = request.lifecycle_status
        if request.lifecycle_status in ("completed", "cancelled"):
            event.entry_status = "closed"
        if previous_status != event.lifecycle_status:
            add_circle_admin_action_log(
                db,
                circle_id=event.circle_id,
                actor_user_id=current_user.id,
                permission_key=required_permission,
                target_type="live_event",
                target_id=event.id,
                summary=f"ライブ「{event.name}」の状態を変更",
                details=f"状態: {previous_status} -> {event.lifecycle_status}",
            )

    live_events_path = f"/circles/{event.circle_id}/live-events"
    if previous_entry_status != "open" and event.entry_status == "open":
        _notify_circle_members(
            db,
            circle_id=event.circle_id,
            actor_user_id=current_user.id,
            notification_type="live_entry_opened",
            title="ライブの申請受付が始まりました",
            body=f"「{event.name}」の申請受付が開始されました。",
            link_path=live_events_path,
        )
    if previous_lifecycle_status != "completed" and event.lifecycle_status == "completed":
        _notify_circle_members(
            db,
            circle_id=event.circle_id,
            actor_user_id=current_user.id,
            notification_type="live_event_completed",
            title="ライブが終了しました",
            body=f"「{event.name}」は終了済みとして更新されました。",
            link_path=live_events_path,
        )
    if previous_lifecycle_status != "cancelled" and event.lifecycle_status == "cancelled":
        _notify_circle_members(
            db,
            circle_id=event.circle_id,
            actor_user_id=current_user.id,
            notification_type="live_event_cancelled",
            title="ライブが中止になりました",
            body=f"「{event.name}」は中止として更新されました。",
            link_path=live_events_path,
        )
    db.commit()
    db.refresh(event)
    return _build_live_event_response(db, event, current_user)


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
