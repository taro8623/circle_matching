"""allow multiple external members per part

Revision ID: 0004_external_members_multi
Revises: 0003_song_external_members
Create Date: 2026-05-19
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0004_external_members_multi"
down_revision: Union[str, None] = "0003_song_external_members"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_song_external_members_song_part",
        "song_external_members",
        type_="unique",
    )


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_song_external_members_song_part",
        "song_external_members",
        ["song_request_id", "part"],
    )
