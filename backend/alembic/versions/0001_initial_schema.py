"""initial schema (v2)

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-19

新スキーマ。13テーブル一括作成。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---------- users ----------
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # ---------- user_parts ----------
    op.create_table(
        "user_parts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("part", sa.String(), nullable=False),
        sa.Column("part_detail", sa.String()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "part", name="uq_user_parts_user_part"),
    )

    # ---------- circles ----------
    op.create_table(
        "circles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False, unique=True),
        sa.Column("join_password", sa.String(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # ---------- circle_members ----------
    op.create_table(
        "circle_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("circle_id", UUID(as_uuid=True),
                  sa.ForeignKey("circles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
        sa.Column("left_at", sa.DateTime()),
    )
    # 部分インデックス: アクティブな所属(left_at IS NULL)は1人につき1サークル1行
    op.create_index(
        "uq_circle_members_active",
        "circle_members",
        ["circle_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("left_at IS NULL"),
    )

    # ---------- live_events ----------
    op.create_table(
        "live_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("circle_id", UUID(as_uuid=True),
                  sa.ForeignKey("circles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("event_date", sa.Date()),
        sa.Column("entry_status", sa.String(), nullable=False, server_default="open"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # ---------- user_live_event_status ----------
    op.create_table(
        "user_live_event_status",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("live_event_id", UUID(as_uuid=True),
                  sa.ForeignKey("live_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="want_invites"),
        sa.Column("memo", sa.Text()),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "live_event_id", name="uq_user_live_event"),
    )

    # ---------- song_requests ----------
    op.create_table(
        "song_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("circle_id", UUID(as_uuid=True),
                  sa.ForeignKey("circles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by", UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("artist", sa.String(), nullable=False),
        sa.Column("reference_url", sa.String()),
        sa.Column("memo", sa.Text()),
        sa.Column("timing_preference_memo", sa.Text()),
        sa.Column("status", sa.String(), nullable=False, server_default="recruiting"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # ---------- song_recruiting_parts ----------
    op.create_table(
        "song_recruiting_parts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("song_request_id", UUID(as_uuid=True),
                  sa.ForeignKey("song_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("part", sa.String(), nullable=False),
        sa.Column("required_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("song_request_id", "part",
                            name="uq_song_recruiting_parts_song_part"),
    )

    # ---------- song_part_entries ----------
    op.create_table(
        "song_part_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("song_request_id", UUID(as_uuid=True),
                  sa.ForeignKey("song_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("part", sa.String(), nullable=False),
        sa.Column("part_detail", sa.String()),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("timing_memo", sa.Text()),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("responded_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_song_part_entries_song", "song_part_entries", ["song_request_id"])
    op.create_index("ix_song_part_entries_user", "song_part_entries", ["user_id"])
    op.create_index("ix_song_part_entries_status", "song_part_entries", ["status"])

    # ---------- song_live_applications ----------
    op.create_table(
        "song_live_applications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("song_request_id", UUID(as_uuid=True),
                  sa.ForeignKey("song_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("live_event_id", UUID(as_uuid=True),
                  sa.ForeignKey("live_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="applied"),
        sa.Column("applied_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("applied_at", sa.DateTime(), nullable=False),
        sa.Column("decided_by", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("decided_at", sa.DateTime()),
        sa.Column("memo", sa.Text()),
    )
    op.create_index("ix_song_live_applications_song", "song_live_applications", ["song_request_id"])
    op.create_index("ix_song_live_applications_event", "song_live_applications", ["live_event_id"])
    op.create_index("ix_song_live_applications_status", "song_live_applications", ["status"])

    # ---------- song_chat_rooms ----------
    op.create_table(
        "song_chat_rooms",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("song_request_id", UUID(as_uuid=True),
                  sa.ForeignKey("song_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("song_request_id", name="uq_song_chat_rooms_song"),
    )

    # ---------- chat_room_participants ----------
    op.create_table(
        "chat_room_participants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("chat_room_id", UUID(as_uuid=True),
                  sa.ForeignKey("song_chat_rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("joined_at", sa.DateTime(), nullable=False),
        sa.Column("last_read_at", sa.DateTime()),
        sa.UniqueConstraint("chat_room_id", "user_id",
                            name="uq_chat_room_participants_room_user"),
    )

    # ---------- chat_messages ----------
    op.create_table(
        "chat_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("chat_room_id", UUID(as_uuid=True),
                  sa.ForeignKey("song_chat_rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_chat_messages_room_created", "chat_messages",
                    ["chat_room_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_room_created", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_table("chat_room_participants")
    op.drop_table("song_chat_rooms")
    op.drop_index("ix_song_live_applications_status", table_name="song_live_applications")
    op.drop_index("ix_song_live_applications_event", table_name="song_live_applications")
    op.drop_index("ix_song_live_applications_song", table_name="song_live_applications")
    op.drop_table("song_live_applications")
    op.drop_index("ix_song_part_entries_status", table_name="song_part_entries")
    op.drop_index("ix_song_part_entries_user", table_name="song_part_entries")
    op.drop_index("ix_song_part_entries_song", table_name="song_part_entries")
    op.drop_table("song_part_entries")
    op.drop_table("song_recruiting_parts")
    op.drop_table("song_requests")
    op.drop_table("user_live_event_status")
    op.drop_table("live_events")
    op.drop_index("uq_circle_members_active", table_name="circle_members")
    op.drop_table("circle_members")
    op.drop_table("circles")
    op.drop_table("user_parts")
    op.drop_table("users")
