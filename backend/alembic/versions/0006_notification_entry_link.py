"""add song part entry link to notifications

Revision ID: 0006_notification_entry_link
Revises: 0005_notifications
Create Date: 2026-05-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "0006_notification_entry_link"
down_revision: Union[str, None] = "0005_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("related_song_part_entry_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_notifications_song_part_entry",
        "notifications",
        "song_part_entries",
        ["related_song_part_entry_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_notifications_song_part_entry", "notifications", type_="foreignkey")
    op.drop_column("notifications", "related_song_part_entry_id")
