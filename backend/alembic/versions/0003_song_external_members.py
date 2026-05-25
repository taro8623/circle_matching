"""add song external members

Revision ID: 0003_song_external_members
Revises: 0002_unique_circle_name
Create Date: 2026-05-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "0003_song_external_members"
down_revision: Union[str, None] = "0002_unique_circle_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "song_external_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("song_request_id", UUID(as_uuid=True),
                  sa.ForeignKey("song_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("part", sa.String(), nullable=False),
        sa.Column("member_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "song_request_id", "part",
            name="uq_song_external_members_song_part",
        ),
    )


def downgrade() -> None:
    op.drop_table("song_external_members")
