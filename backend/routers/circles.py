"""サークル作成/参加/詳細"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from deps import get_db, get_current_user, require_circle_member
from models import (
    User, Circle, CircleMember, CircleMemberPermission, CircleAdminActionLog,
    SongRequest, SongRecruitingPart, UserPart, SongPartEntry, SongLiveApplication, LiveEvent,
)
from schemas.circle import (
    CircleCreate, CircleJoinRequest, CircleDetailResponse,
    MemberResponse, SongSummary,
    CircleAdminActionLogResponse,
    CircleBIResponse,
    CircleBIMemberStatResponse,
    CircleBIPopularArtistResponse,
    CirclePermissionAssigneeResponse,
    CirclePermissionItemResponse,
    CirclePermissionMemberSummaryResponse,
    CirclePermissionSettingsResponse,
    CirclePermissionUpdateRequest,
)
from services.circle_permissions import (
    CIRCLE_PERMISSION_DEFINITIONS,
    ALL_CIRCLE_PERMISSION_KEYS,
    get_effective_circle_permission_keys,
    list_active_circle_members,
    list_circle_permission_assignees,
    require_circle_permission,
)
from services.circle_admin_logs import add_circle_admin_action_log


router = APIRouter(prefix="/circles", tags=["circles"])
PERMISSION_LABELS = {
    item["key"]: item["label"] for item in CIRCLE_PERMISSION_DEFINITIONS
}


@router.post("")
def create_circle(
    circle: CircleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle_name = circle.name.strip()
    if not circle_name:
        raise HTTPException(status_code=400, detail="サークル名を入力してください")

    existing = db.query(Circle).filter(Circle.name == circle_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="すでに同じ名前のサークルがあります")

    new_circle = Circle(
        name=circle_name,
        join_password=circle.join_password,
        description=circle.description,
    )
    db.add(new_circle)
    db.flush()

    db.add(
        CircleMember(
            circle_id=new_circle.id,
            user_id=current_user.id,
            role="owner",
        )
    )
    db.commit()
    db.refresh(new_circle)
    return {"message": "サークルを作成しました", "circle_id": str(new_circle.id)}


@router.post("/join")
def join_circle(
    req: CircleJoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.circle_name:
        matched_circles = db.query(Circle).filter(Circle.name == req.circle_name).all()
        if not matched_circles:
            raise HTTPException(status_code=401, detail="サークル名またはパスワードが違います")
        if len(matched_circles) > 1:
            raise HTTPException(
                status_code=409,
                detail="同じ名前のサークルが複数あります。管理者にサークルIDを確認してください",
            )
        circle = matched_circles[0]
    elif req.circle_id:
        circle = db.query(Circle).filter(Circle.id == req.circle_id).first()
        if not circle:
            raise HTTPException(status_code=401, detail="サークル名またはパスワードが違います")
    else:
        raise HTTPException(status_code=400, detail="サークル名を入力してください")

    if circle.join_password != req.join_password:
        raise HTTPException(status_code=401, detail="サークル名またはパスワードが違います")

    # 既に在籍中?
    active = (
        db.query(CircleMember)
        .filter(
            CircleMember.circle_id == circle.id,
            CircleMember.user_id == current_user.id,
            CircleMember.left_at.is_(None),
        )
        .first()
    )
    if active:
        return {"message": "すでに参加しています", "circle_id": str(circle.id)}

    # 脱退済み?(再加入)
    left = (
        db.query(CircleMember)
        .filter(
            CircleMember.circle_id == circle.id,
            CircleMember.user_id == current_user.id,
            CircleMember.left_at.isnot(None),
        )
        .first()
    )
    if left:
        left.left_at = None
        db.commit()
        return {"message": "サークルに再加入しました", "circle_id": str(circle.id)}

    db.add(
        CircleMember(
            circle_id=circle.id,
            user_id=current_user.id,
            role="member",
        )
    )
    db.commit()
    return {"message": "サークルに参加しました", "circle_id": str(circle.id)}


@router.get("/{circle_id}", response_model=CircleDetailResponse)
def get_circle_detail(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    require_circle_member(db, circle_id, current_user.id)

    # アクティブメンバー
    members = (
        db.query(CircleMember, User)
        .join(User, CircleMember.user_id == User.id)
        .filter(
            CircleMember.circle_id == circle_id,
            CircleMember.left_at.is_(None),
        )
        .all()
    )
    member_list = []
    for cm, u in members:
        parts = [
            r.part for r in db.query(UserPart).filter(UserPart.user_id == u.id).all()
        ]
        member_list.append(
            MemberResponse(
                id=u.id,
                name=u.name,
                parts=parts,
                bio=u.bio,
                favorite_artists=u.favorite_artists or [],
                role=cm.role,
            )
        )

    # 曲一覧(サマリのみ)
    songs = db.query(SongRequest).filter(SongRequest.circle_id == circle_id).all()
    song_list = []
    for s in songs:
        recruiting_parts = [
            r.part
            for r in db.query(SongRecruitingPart)
            .filter(SongRecruitingPart.song_request_id == s.id)
            .all()
        ]
        song_list.append(
            SongSummary(
                id=s.id,
                title=s.title,
                artist=s.artist,
                reference_url=s.reference_url,
                status=s.status,
                recruiting_parts=recruiting_parts,
            )
        )

    return CircleDetailResponse(
        id=circle.id,
        name=circle.name,
        description=circle.description,
        members=member_list,
        songs=song_list,
    )


@router.get("/{circle_id}/bi", response_model=CircleBIResponse)
def get_circle_bi(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    require_circle_member(db, circle_id, current_user.id)

    active_members = (
        db.query(CircleMember, User)
        .join(User, CircleMember.user_id == User.id)
        .filter(
            CircleMember.circle_id == circle_id,
            CircleMember.left_at.is_(None),
        )
        .all()
    )
    member_count = len(active_members)

    artist_counts: dict[str, int] = {}
    for _, user in active_members:
        for artist in user.favorite_artists or []:
            normalized = artist.strip()
            if not normalized:
                continue
            artist_counts[normalized] = artist_counts.get(normalized, 0) + 1
    popular_artists = [
        CircleBIPopularArtistResponse(artist_name=artist_name, member_count=count)
        for artist_name, count in sorted(
            artist_counts.items(),
            key=lambda item: (-item[1], item[0]),
        )[:15]
    ]

    completed_live_ids = [
        live_event_id
        for live_event_id, in (
            db.query(LiveEvent.id)
            .filter(
                LiveEvent.circle_id == circle_id,
                LiveEvent.lifecycle_status == "completed",
            )
            .all()
        )
    ]
    completed_live_count = len(completed_live_ids)

    member_appearance_map: dict[UUID, set[UUID]] = {
        user.id: set() for _, user in active_members
    }
    if completed_live_ids:
        appearance_rows = (
            db.query(SongPartEntry.user_id, LiveEvent.id)
            .join(SongRequest, SongPartEntry.song_request_id == SongRequest.id)
            .join(SongLiveApplication, SongLiveApplication.song_request_id == SongRequest.id)
            .join(LiveEvent, SongLiveApplication.live_event_id == LiveEvent.id)
            .filter(
                SongRequest.circle_id == circle_id,
                SongPartEntry.status == "accepted",
                SongPartEntry.user_id.in_(list(member_appearance_map.keys())),
                SongLiveApplication.status == "approved",
                LiveEvent.id.in_(completed_live_ids),
            )
            .distinct()
            .all()
        )
        for user_id, live_event_id in appearance_rows:
            member_appearance_map.setdefault(user_id, set()).add(live_event_id)

    member_stats = []
    for _, user in active_members:
        appearance_count = len(member_appearance_map.get(user.id, set()))
        participation_rate = (
            round((appearance_count / completed_live_count) * 100, 1)
            if completed_live_count > 0
            else 0.0
        )
        member_stats.append(
            CircleBIMemberStatResponse(
                user_id=user.id,
                user_name=user.name,
                appearance_count=appearance_count,
                participation_rate=participation_rate,
            )
        )
    member_stats.sort(
        key=lambda item: (-item.appearance_count, -item.participation_rate, item.user_name)
    )

    return CircleBIResponse(
        circle_id=circle.id,
        circle_name=circle.name,
        member_count=member_count,
        completed_live_count=completed_live_count,
        popular_artists=popular_artists,
        member_stats=member_stats,
    )


@router.post("/{circle_id}/leave")
def leave_circle(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """サークルから脱退(論理削除)"""
    from datetime import datetime as _dt

    membership = require_circle_member(db, circle_id, current_user.id)
    membership.left_at = _dt.utcnow()
    db.commit()
    return {"message": "サークルから脱退しました"}



@router.get("/{circle_id}/permission-settings", response_model=CirclePermissionSettingsResponse)
def get_circle_permission_settings(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_circle_member(db, circle_id, current_user.id)

    permission_items = []
    for definition in CIRCLE_PERMISSION_DEFINITIONS:
        assignees = [
            CirclePermissionAssigneeResponse(**assignee)
            for assignee in list_circle_permission_assignees(db, circle_id, definition["key"])
        ]
        permission_items.append(
            CirclePermissionItemResponse(
                key=definition["key"],
                label=definition["label"],
                description=definition["description"],
                assigned_users=assignees,
            )
        )

    members = [
        CirclePermissionMemberSummaryResponse(**member)
        for member in list_active_circle_members(db, circle_id)
    ]
    return CirclePermissionSettingsResponse(
        circle_id=circle_id,
        current_user_id=current_user.id,
        current_user_permissions=get_effective_circle_permission_keys(db, circle_id, current_user.id),
        members=members,
        permissions=permission_items,
    )


@router.patch("/{circle_id}/permissions/{permission_key}")
def update_circle_permission(
    request: CirclePermissionUpdateRequest,
    circle_id: UUID = Path(...),
    permission_key: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_circle_member(db, circle_id, current_user.id)
    if permission_key not in ALL_CIRCLE_PERMISSION_KEYS:
        raise HTTPException(status_code=404, detail="権限種別が見つかりません")

    target_membership = (
        db.query(CircleMember)
        .filter(
            CircleMember.circle_id == circle_id,
            CircleMember.user_id == request.user_id,
            CircleMember.left_at.is_(None),
        )
        .first()
    )
    if not target_membership:
        raise HTTPException(status_code=404, detail="対象メンバーが見つかりません")
    if target_membership.role == "owner":
        raise HTTPException(status_code=400, detail="代表者の権限は個別変更できません")

    required_permission = (
        "grant_circle_permissions" if request.enabled else "revoke_circle_permissions"
    )
    require_circle_permission(
        db,
        circle_id,
        current_user.id,
        required_permission,
        "権限設定を変更する権限がありません",
    )

    grant = (
        db.query(CircleMemberPermission)
        .filter(
            CircleMemberPermission.circle_id == circle_id,
            CircleMemberPermission.user_id == request.user_id,
            CircleMemberPermission.permission_key == permission_key,
        )
        .first()
    )

    if request.enabled:
        if not grant:
            db.add(
                CircleMemberPermission(
                    circle_id=circle_id,
                    user_id=request.user_id,
                    permission_key=permission_key,
                    granted_by=current_user.id,
                )
            )
            target_user = db.query(User).filter(User.id == request.user_id).first()
            add_circle_admin_action_log(
                db,
                circle_id=circle_id,
                actor_user_id=current_user.id,
                permission_key="grant_circle_permissions",
                target_type="circle_permission",
                target_id=request.user_id,
                summary=f"{target_user.name} に「{PERMISSION_LABELS[permission_key]}」を付与",
                details=f"付与された権限: {PERMISSION_LABELS[permission_key]}",
            )
            db.commit()
        return {"message": "権限を付与しました", "enabled": True}

    if grant:
        target_user = db.query(User).filter(User.id == request.user_id).first()
        add_circle_admin_action_log(
            db,
            circle_id=circle_id,
            actor_user_id=current_user.id,
            permission_key="revoke_circle_permissions",
            target_type="circle_permission",
            target_id=request.user_id,
            summary=f"{target_user.name} から「{PERMISSION_LABELS[permission_key]}」を解除",
            details=f"解除された権限: {PERMISSION_LABELS[permission_key]}",
        )
        db.delete(grant)
        db.commit()
    return {"message": "権限を外しました", "enabled": False}


@router.get("/{circle_id}/admin-action-logs", response_model=List[CircleAdminActionLogResponse])
def list_circle_admin_action_logs(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_circle_member(db, circle_id, current_user.id)
    require_circle_permission(
        db,
        circle_id,
        current_user.id,
        "view_admin_action_logs",
        "管理者操作ログを閲覧する権限がありません",
    )

    rows = (
        db.query(CircleAdminActionLog, User)
        .join(User, CircleAdminActionLog.actor_user_id == User.id)
        .filter(CircleAdminActionLog.circle_id == circle_id)
        .order_by(CircleAdminActionLog.created_at.desc())
        .limit(200)
        .all()
    )
    return [
        CircleAdminActionLogResponse(
            id=log.id,
            actor_user_id=user.id,
            actor_user_name=user.name,
            permission_key=log.permission_key,
            permission_label=PERMISSION_LABELS.get(log.permission_key, log.permission_key),
            target_type=log.target_type,
            target_id=log.target_id,
            summary=log.summary,
            details=log.details,
            created_at=log.created_at.isoformat(),
        )
        for log, user in rows
    ]
