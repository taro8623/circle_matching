"""自分のプロフィール / 担当パート"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from deps import get_db, get_current_user, require_circle_member
from models import (
    User, UserPart, Circle, CircleMember, SongPartEntry, SongRequest,
    SongLiveApplication, LiveEvent,
)
from schemas.user import (
    MeResponse, UserPartsUpdateRequest, CircleSummaryResponse, ProfileUpdateRequest,
    CircleParticipationHistoryResponse, ParticipationHistoryItemResponse,
    CircleParticipationPlansResponse, ParticipationPlanItemResponse,
)


router = APIRouter(prefix="/me", tags=["users"])


def _user_parts(db: Session, user_id) -> List[str]:
    rows = db.query(UserPart).filter(UserPart.user_id == user_id).all()
    return [r.part for r in rows]


def _me_response(db: Session, current_user: User) -> MeResponse:
    return MeResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        parts=_user_parts(db, current_user.id),
        bio=current_user.bio,
        favorite_artists=current_user.favorite_artists or [],
    )


@router.get("", response_model=MeResponse)
def read_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _me_response(db, current_user)


@router.put("/profile", response_model=MeResponse)
def update_my_profile(
    request: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bio = request.bio.strip() if request.bio is not None else ""
    if not bio:
        raise HTTPException(status_code=400, detail="自己紹介を入力してください")

    current_user.bio = bio

    if request.name is not None:
        name = request.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="名前を入力してください")
        current_user.name = name

    if request.favorite_artists is not None:
        normalized_favorite_artists: List[str] = []
        for artist in request.favorite_artists:
            normalized = artist.strip()
            if normalized and normalized not in normalized_favorite_artists:
                normalized_favorite_artists.append(normalized)
        current_user.favorite_artists = normalized_favorite_artists

    db.commit()
    db.refresh(current_user)
    return _me_response(db, current_user)


@router.put("/parts")
def update_my_parts(
    request: UserPartsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 入力を正規化
    normalized: List[str] = []
    for p in request.parts:
        s = p.strip()
        if s and s not in normalized:
            normalized.append(s)

    # 既存を全削除して入れ直し(シンプル運用)
    db.query(UserPart).filter(UserPart.user_id == current_user.id).delete()
    for p in normalized:
        db.add(UserPart(user_id=current_user.id, part=p))
    db.commit()

    return {"message": "担当パートを更新しました", "parts": normalized}


@router.get("/circles", response_model=List[CircleSummaryResponse])
def get_my_circles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circles = (
        db.query(Circle)
        .join(CircleMember, Circle.id == CircleMember.circle_id)
        .filter(
            CircleMember.user_id == current_user.id,
            CircleMember.left_at.is_(None),
        )
        .all()
    )
    return [
        CircleSummaryResponse(id=c.id, name=c.name, description=c.description)
        for c in circles
    ]


@router.get("/circles/{circle_id}/participation-history", response_model=CircleParticipationHistoryResponse)
def get_my_circle_participation_history(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    require_circle_member(db, circle_id, current_user.id)

    accepted_entries = (
        db.query(SongPartEntry, SongRequest, SongLiveApplication, LiveEvent)
        .join(SongRequest, SongPartEntry.song_request_id == SongRequest.id)
        .join(SongLiveApplication, SongLiveApplication.song_request_id == SongRequest.id)
        .join(LiveEvent, SongLiveApplication.live_event_id == LiveEvent.id)
        .filter(
            SongPartEntry.user_id == current_user.id,
            SongPartEntry.status == "accepted",
            SongRequest.circle_id == circle_id,
            SongLiveApplication.status == "approved",
            LiveEvent.circle_id == circle_id,
            LiveEvent.lifecycle_status.in_(["scheduled", "completed"]),
        )
        .all()
    )

    grouped: dict[tuple[UUID, UUID], dict] = {}
    for entry, song, application, live_event in accepted_entries:
        key = (live_event.id, song.id)
        if key not in grouped:
            grouped[key] = {
                "live_event_id": live_event.id,
                "live_event_name": live_event.name,
                "live_event_date": live_event.event_date,
                "song_id": song.id,
                "song_title": song.title,
                "artist": song.artist,
                "parts": [],
                "lifecycle_status": live_event.lifecycle_status,
            }
        if entry.part not in grouped[key]["parts"]:
            grouped[key]["parts"].append(entry.part)

    def to_item(row: dict) -> ParticipationHistoryItemResponse:
        return ParticipationHistoryItemResponse(
            live_event_id=row["live_event_id"],
            live_event_name=row["live_event_name"],
            live_event_date=row["live_event_date"],
            song_id=row["song_id"],
            song_title=row["song_title"],
            artist=row["artist"],
            parts=sorted(row["parts"]),
        )

    upcoming_rows = [
        row for row in grouped.values()
        if row["lifecycle_status"] == "scheduled"
    ]
    history_rows = [
        row for row in grouped.values()
        if row["lifecycle_status"] == "completed"
    ]

    upcoming_rows.sort(
        key=lambda row: (
            row["live_event_date"] is None,
            row["live_event_date"],
            row["live_event_name"],
            row["song_title"],
        )
    )
    history_rows.sort(
        key=lambda row: (
            row["live_event_date"] is None,
            row["live_event_date"] if row["live_event_date"] is not None else "",
            row["live_event_name"],
            row["song_title"],
        ),
        reverse=True,
    )

    return CircleParticipationHistoryResponse(
        circle_id=circle.id,
        circle_name=circle.name,
        upcoming=[to_item(row) for row in upcoming_rows],
        history=[to_item(row) for row in history_rows],
    )


@router.get("/circles/{circle_id}/participation-plans", response_model=CircleParticipationPlansResponse)
def get_my_circle_participation_plans(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    require_circle_member(db, circle_id, current_user.id)

    accepted_entries = (
        db.query(SongPartEntry, SongRequest)
        .join(SongRequest, SongPartEntry.song_request_id == SongRequest.id)
        .filter(
            SongPartEntry.user_id == current_user.id,
            SongPartEntry.status == "accepted",
            SongRequest.circle_id == circle_id,
            SongRequest.status.in_(["ready", "recruiting"]),
        )
        .all()
    )

    approved_map: dict[tuple[UUID, UUID], dict] = {}
    applied_map: dict[tuple[UUID, UUID], dict] = {}
    planned_map: dict[UUID, dict] = {}

    for entry, song in accepted_entries:
        scheduled_applications = (
            db.query(SongLiveApplication, LiveEvent)
            .join(LiveEvent, SongLiveApplication.live_event_id == LiveEvent.id)
            .filter(
                SongLiveApplication.song_request_id == song.id,
                SongLiveApplication.status.in_(["approved", "applied"]),
                LiveEvent.circle_id == circle_id,
                LiveEvent.lifecycle_status == "scheduled",
            )
            .all()
        )

        approved_apps = [
            (application, live_event)
            for application, live_event in scheduled_applications
            if application.status == "approved"
        ]
        applied_apps = [
            (application, live_event)
            for application, live_event in scheduled_applications
            if application.status == "applied"
        ]

        if approved_apps:
            for _, live_event in approved_apps:
                key = (live_event.id, song.id)
                if key not in approved_map:
                    approved_map[key] = {
                        "live_event_id": live_event.id,
                        "live_event_name": live_event.name,
                        "live_event_date": live_event.event_date,
                        "song_id": song.id,
                        "song_title": song.title,
                        "artist": song.artist,
                        "parts": [],
                        "planned_month": song.planned_month,
                    }
                if entry.part not in approved_map[key]["parts"]:
                    approved_map[key]["parts"].append(entry.part)
            continue

        if applied_apps:
            for _, live_event in applied_apps:
                key = (live_event.id, song.id)
                if key not in applied_map:
                    applied_map[key] = {
                        "live_event_id": live_event.id,
                        "live_event_name": live_event.name,
                        "live_event_date": live_event.event_date,
                        "song_id": song.id,
                        "song_title": song.title,
                        "artist": song.artist,
                        "parts": [],
                        "planned_month": song.planned_month,
                    }
                if entry.part not in applied_map[key]["parts"]:
                    applied_map[key]["parts"].append(entry.part)
            continue

        if song.status == "ready":
            if song.id not in planned_map:
                planned_map[song.id] = {
                    "song_id": song.id,
                    "song_title": song.title,
                    "artist": song.artist,
                    "parts": [],
                    "planned_month": song.planned_month,
                }
            if entry.part not in planned_map[song.id]["parts"]:
                planned_map[song.id]["parts"].append(entry.part)

    def to_plan_item(row: dict) -> ParticipationPlanItemResponse:
        return ParticipationPlanItemResponse(
            live_event_id=row.get("live_event_id"),
            live_event_name=row.get("live_event_name"),
            live_event_date=row.get("live_event_date"),
            song_id=row["song_id"],
            song_title=row["song_title"],
            artist=row["artist"],
            parts=sorted(row["parts"]),
            planned_month=row.get("planned_month"),
        )

    approved_rows = list(approved_map.values())
    approved_rows.sort(
        key=lambda row: (
            row["live_event_date"] is None,
            row["live_event_date"],
            row["live_event_name"] or "",
            row["song_title"],
        )
    )
    applied_rows = list(applied_map.values())
    applied_rows.sort(
        key=lambda row: (
            row["live_event_date"] is None,
            row["live_event_date"],
            row["live_event_name"] or "",
            row["song_title"],
        )
    )
    planned_rows = list(planned_map.values())
    planned_rows.sort(
        key=lambda row: (
            row["planned_month"] is None,
            row["planned_month"] or "",
            row["song_title"],
        )
    )

    return CircleParticipationPlansResponse(
        circle_id=circle.id,
        circle_name=circle.name,
        approved=[to_plan_item(row) for row in approved_rows],
        applied=[to_plan_item(row) for row in applied_rows],
        planned=[to_plan_item(row) for row in planned_rows],
    )
