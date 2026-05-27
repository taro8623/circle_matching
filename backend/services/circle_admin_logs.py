from uuid import UUID

from sqlalchemy.orm import Session

from models import CircleAdminActionLog


def add_circle_admin_action_log(
    db: Session,
    *,
    circle_id: UUID,
    actor_user_id: UUID,
    permission_key: str,
    target_type: str,
    target_id: UUID | None,
    summary: str,
    details: str | None = None,
) -> None:
    db.add(
        CircleAdminActionLog(
            circle_id=circle_id,
            actor_user_id=actor_user_id,
            permission_key=permission_key,
            target_type=target_type,
            target_id=target_id,
            summary=summary,
            details=details,
        )
    )
