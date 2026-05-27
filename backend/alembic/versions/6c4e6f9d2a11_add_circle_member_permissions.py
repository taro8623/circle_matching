"""add circle member permissions

Revision ID: 6c4e6f9d2a11
Revises: a7d7e8f4c2ab
Create Date: 2026-05-27 17:30:00.000000
"""

from datetime import datetime
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "6c4e6f9d2a11"
down_revision: Union[str, Sequence[str], None] = "a7d7e8f4c2ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


LIVE_PERMISSION_KEYS = [
    "create_live_event",
    "open_live_entry",
    "close_live_entry",
    "mark_live_completed",
    "mark_live_cancelled",
    "revert_live_to_scheduled",
    "approve_live_applications",
    "reject_live_applications",
]


def upgrade() -> None:
    op.create_table(
        "circle_member_permissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("circle_id", UUID(as_uuid=True), sa.ForeignKey("circles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permission_key", sa.String(), nullable=False),
        sa.Column("granted_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "circle_id",
            "user_id",
            "permission_key",
            name="uq_circle_member_permissions_circle_user_permission",
        ),
    )
    op.create_index("ix_circle_member_permissions_circle", "circle_member_permissions", ["circle_id"])
    op.create_index("ix_circle_member_permissions_user", "circle_member_permissions", ["user_id"])

    bind = op.get_bind()
    metadata = sa.MetaData()
    circle_members = sa.Table(
        "circle_members",
        metadata,
        sa.Column("circle_id", UUID(as_uuid=True)),
        sa.Column("user_id", UUID(as_uuid=True)),
        sa.Column("role", sa.String()),
        sa.Column("left_at", sa.DateTime()),
    )
    permissions = sa.Table(
        "circle_member_permissions",
        metadata,
        sa.Column("id", UUID(as_uuid=True)),
        sa.Column("circle_id", UUID(as_uuid=True)),
        sa.Column("user_id", UUID(as_uuid=True)),
        sa.Column("permission_key", sa.String()),
        sa.Column("granted_by", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime()),
    )

    active_admins = bind.execute(
        sa.select(circle_members.c.circle_id, circle_members.c.user_id)
        .where(circle_members.c.role == "admin")
        .where(circle_members.c.left_at.is_(None))
    ).fetchall()

    rows = []
    now = datetime.utcnow()
    for circle_id, user_id in active_admins:
        for permission_key in LIVE_PERMISSION_KEYS:
            rows.append(
                {
                    "id": uuid.uuid4(),
                    "circle_id": circle_id,
                    "user_id": user_id,
                    "permission_key": permission_key,
                    "granted_by": user_id,
                    "created_at": now,
                }
            )
    if rows:
        op.bulk_insert(permissions, rows)
        bind.execute(
            circle_members.update()
            .where(circle_members.c.role == "admin")
            .where(circle_members.c.left_at.is_(None))
            .values(role="member")
        )


def downgrade() -> None:
    op.drop_index("ix_circle_member_permissions_user", table_name="circle_member_permissions")
    op.drop_index("ix_circle_member_permissions_circle", table_name="circle_member_permissions")
    op.drop_table("circle_member_permissions")
