from typing import Iterable, List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import CircleMember, CircleMemberPermission, User


CIRCLE_PERMISSION_DEFINITIONS = [
    {
        "key": "create_live_event",
        "label": "新しいライブを作成",
        "description": "ライブ予定を新規作成できます。",
    },
    {
        "key": "open_live_entry",
        "label": "ライブ受付を開く",
        "description": "ライブの申請受付を開始できます。",
    },
    {
        "key": "close_live_entry",
        "label": "ライブ受付を閉じる",
        "description": "ライブの申請受付を終了できます。",
    },
    {
        "key": "mark_live_completed",
        "label": "ライブを終了にする",
        "description": "開催済みライブを終了扱いにできます。",
    },
    {
        "key": "mark_live_cancelled",
        "label": "ライブを中止にする",
        "description": "ライブを中止扱いにできます。",
    },
    {
        "key": "revert_live_to_scheduled",
        "label": "ライブを開催前に戻す",
        "description": "終了・中止したライブを開催前に戻せます。",
    },
    {
        "key": "approve_live_applications",
        "label": "ライブ申請を承認",
        "description": "曲のライブ申請を承認できます。",
    },
    {
        "key": "reject_live_applications",
        "label": "ライブ申請を却下",
        "description": "曲のライブ申請を却下できます。",
    },
    {
        "key": "grant_circle_permissions",
        "label": "権限を付与",
        "description": "他メンバーに個別権限を付与できます。",
    },
    {
        "key": "revoke_circle_permissions",
        "label": "権限を外す",
        "description": "他メンバーから個別権限を外せます。",
    },
    {
        "key": "view_admin_action_logs",
        "label": "管理者操作ログを閲覧",
        "description": "管理権限を持つメンバーの操作履歴を確認できます。",
    },
]

ALL_CIRCLE_PERMISSION_KEYS = {
    item["key"] for item in CIRCLE_PERMISSION_DEFINITIONS
}

LIVE_MANAGEMENT_PERMISSION_KEYS = {
    "create_live_event",
    "open_live_entry",
    "close_live_entry",
    "mark_live_completed",
    "mark_live_cancelled",
    "revert_live_to_scheduled",
    "approve_live_applications",
    "reject_live_applications",
}


def get_circle_membership(db: Session, circle_id: UUID, user_id: UUID) -> CircleMember | None:
    return (
        db.query(CircleMember)
        .filter(
            CircleMember.circle_id == circle_id,
            CircleMember.user_id == user_id,
            CircleMember.left_at.is_(None),
        )
        .first()
    )


def get_effective_circle_permission_keys(db: Session, circle_id: UUID, user_id: UUID) -> List[str]:
    membership = get_circle_membership(db, circle_id, user_id)
    if not membership:
        return []
    if membership.role == "owner":
        return [item["key"] for item in CIRCLE_PERMISSION_DEFINITIONS]

    explicit_keys = [
        permission_key
        for permission_key, in (
            db.query(CircleMemberPermission.permission_key)
            .filter(
                CircleMemberPermission.circle_id == circle_id,
                CircleMemberPermission.user_id == user_id,
            )
            .all()
        )
    ]
    return sorted(set(explicit_keys))


def has_circle_permission(db: Session, circle_id: UUID, user_id: UUID, permission_key: str) -> bool:
    if permission_key not in ALL_CIRCLE_PERMISSION_KEYS:
        raise ValueError(f"Unknown permission_key: {permission_key}")
    return permission_key in get_effective_circle_permission_keys(db, circle_id, user_id)


def require_circle_permission(
    db: Session,
    circle_id: UUID,
    user_id: UUID,
    permission_key: str,
    detail: str | None = None,
) -> None:
    if has_circle_permission(db, circle_id, user_id, permission_key):
        return
    raise HTTPException(
        status_code=403,
        detail=detail or "この操作を行う権限がありません",
    )


def list_circle_permission_assignees(
    db: Session,
    circle_id: UUID,
    permission_key: str,
) -> list[dict]:
    if permission_key not in ALL_CIRCLE_PERMISSION_KEYS:
        raise ValueError(f"Unknown permission_key: {permission_key}")

    members = (
        db.query(CircleMember, User)
        .join(User, CircleMember.user_id == User.id)
        .filter(
            CircleMember.circle_id == circle_id,
            CircleMember.left_at.is_(None),
        )
        .all()
    )
    explicit_user_ids = {
        user_id
        for user_id, in (
            db.query(CircleMemberPermission.user_id)
            .filter(
                CircleMemberPermission.circle_id == circle_id,
                CircleMemberPermission.permission_key == permission_key,
            )
            .all()
        )
    }

    assigned_users = []
    for membership, user in members:
        if membership.role == "owner" or user.id in explicit_user_ids:
            assigned_users.append(
                {
                    "user_id": user.id,
                    "user_name": user.name,
                    "is_owner": membership.role == "owner",
                    "is_explicit": user.id in explicit_user_ids,
                }
            )
    assigned_users.sort(key=lambda item: (not item["is_owner"], item["user_name"]))
    return assigned_users


def list_active_circle_members(db: Session, circle_id: UUID) -> list[dict]:
    members = (
        db.query(CircleMember, User)
        .join(User, CircleMember.user_id == User.id)
        .filter(
            CircleMember.circle_id == circle_id,
            CircleMember.left_at.is_(None),
        )
        .all()
    )
    rows = [
        {
            "user_id": user.id,
            "user_name": user.name,
            "role": membership.role,
        }
        for membership, user in members
    ]
    rows.sort(key=lambda item: (item["role"] != "owner", item["user_name"]))
    return rows


def normalize_permission_keys(permission_keys: Iterable[str]) -> list[str]:
    normalized = []
    for permission_key in permission_keys:
        if permission_key not in ALL_CIRCLE_PERMISSION_KEYS:
            continue
        normalized.append(permission_key)
    return sorted(set(normalized))
