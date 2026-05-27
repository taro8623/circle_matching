"""add circle admin action logs

Revision ID: c91f8dc0c0d1
Revises: 6c4e6f9d2a11
Create Date: 2026-05-27 17:58:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "c91f8dc0c0d1"
down_revision: Union[str, Sequence[str], None] = "6c4e6f9d2a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "circle_admin_action_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("circle_id", UUID(as_uuid=True), sa.ForeignKey("circles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permission_key", sa.String(), nullable=False),
        sa.Column("target_type", sa.String(), nullable=False),
        sa.Column("target_id", UUID(as_uuid=True)),
        sa.Column("summary", sa.String(), nullable=False),
        sa.Column("details", sa.Text()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_circle_admin_action_logs_circle_created",
        "circle_admin_action_logs",
        ["circle_id", "created_at"],
    )
    op.create_index(
        "ix_circle_admin_action_logs_actor",
        "circle_admin_action_logs",
        ["actor_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_circle_admin_action_logs_actor", table_name="circle_admin_action_logs")
    op.drop_index("ix_circle_admin_action_logs_circle_created", table_name="circle_admin_action_logs")
    op.drop_table("circle_admin_action_logs")
