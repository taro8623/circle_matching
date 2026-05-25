"""enforce unique circle names

Revision ID: 0002_unique_circle_name
Revises: 0001_initial
Create Date: 2026-05-19
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_unique_circle_name"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    duplicates = conn.execute(
        sa.text(
            """
            SELECT name
            FROM circles
            GROUP BY name
            HAVING COUNT(*) > 1
            LIMIT 1
            """
        )
    ).fetchone()
    if duplicates:
        raise RuntimeError(
            f"Duplicate circle name exists: {duplicates[0]!r}. Resolve duplicates before migration."
        )

    op.create_unique_constraint("uq_circles_name", "circles", ["name"])


def downgrade() -> None:
    op.drop_constraint("uq_circles_name", "circles", type_="unique")
