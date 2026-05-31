"""add live event participant payments

Revision ID: f12c4f8c6a9b
Revises: c91f8dc0c0d1
Create Date: 2026-05-31 18:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "f12c4f8c6a9b"
down_revision: Union[str, Sequence[str], None] = "c91f8dc0c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "live_event_participant_payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("live_event_id", UUID(as_uuid=True), sa.ForeignKey("live_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("participant_type", sa.String(), nullable=False),
        sa.Column("participant_key", sa.String(), nullable=False),
        sa.Column("payment_status", sa.String(), nullable=False, server_default="unpaid"),
        sa.Column("updated_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "live_event_id",
            "participant_type",
            "participant_key",
            name="uq_live_event_participant_payments_event_participant",
        ),
    )
    op.create_index(
        "ix_live_event_participant_payments_event",
        "live_event_participant_payments",
        ["live_event_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_live_event_participant_payments_event", table_name="live_event_participant_payments")
    op.drop_table("live_event_participant_payments")
