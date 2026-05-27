"""add lifecycle_status to live_events

Revision ID: a7d7e8f4c2ab
Revises: 899e726475ee
Create Date: 2026-05-26 01:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7d7e8f4c2ab"
down_revision: Union[str, Sequence[str], None] = "899e726475ee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "live_events",
        sa.Column("lifecycle_status", sa.String(), nullable=False, server_default="scheduled"),
    )
    op.execute("UPDATE live_events SET lifecycle_status = 'scheduled' WHERE lifecycle_status IS NULL")
    op.alter_column(
        "live_events",
        "lifecycle_status",
        existing_type=sa.String(),
        server_default=None,
        existing_nullable=False,
    )


def downgrade() -> None:
    op.drop_column("live_events", "lifecycle_status")
