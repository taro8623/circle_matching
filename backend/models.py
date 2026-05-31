"""
バンドサークル曲マッチング・ライブ申請アプリのデータモデル。

設計方針:
  - 「募集」「応募/オファー」「メンバー確定」「ライブ申請」を別レイヤーで管理
  - 応募(application) と お誘い(offer) は song_part_entries に統合（kind で区別）
  - チャットは曲(SongRequest) に紐づく（ライブが変わっても消えない）
  - target_live_event_id は SongRequest に置かない（紐付けは song_live_applications が唯一の真実）
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Text, DateTime, Date, ForeignKey, Integer, JSON,
    UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base


# =====================================================================
# 1. ユーザー
# =====================================================================
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    bio = Column(Text)  # 自己紹介
    favorite_artists = Column(JSON, default=list)  # ["Artist A", "Artist B"] の形式
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    parts = relationship("UserPart", back_populates="user", cascade="all, delete-orphan")
    circle_memberships = relationship("CircleMember", back_populates="user")
    live_event_statuses = relationship("UserLiveEventStatus", back_populates="user")
    requested_songs = relationship("SongRequest", back_populates="requester",
                                   foreign_keys="SongRequest.requested_by")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class UserPart(Base):
    """User の担当パート（複数）。全サークル共通プロフィール。"""
    __tablename__ = "user_parts"
    __table_args__ = (
        UniqueConstraint("user_id", "part", name="uq_user_parts_user_part"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    part = Column(String, nullable=False)         # 'Vo' 'Gt' 'Ba' 'Dr' 'Key' 'Cho' 'Other' 等
    part_detail = Column(String)                  # Other時の自由記述
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="parts")


# =====================================================================
# 2. サークル
# =====================================================================
class Circle(Base):
    __tablename__ = "circles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    join_password = Column(String, nullable=False)   # サークル参加用パスワード
    description = Column(Text)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship("CircleMember", back_populates="circle", cascade="all, delete-orphan")
    live_events = relationship("LiveEvent", back_populates="circle", cascade="all, delete-orphan")
    songs = relationship("SongRequest", back_populates="circle", cascade="all, delete-orphan")


class CircleMember(Base):
    """
    サークル所属。脱退は left_at を立てる論理削除。
    UNIQUEは付けない(脱退→再加入で同じ行をUPDATEで復活させる運用)。
    アクティブ判定: left_at IS NULL。
    """
    __tablename__ = "circle_members"
    __table_args__ = (
        # 「同じ user_id × circle_id でアクティブなのは最大1行」を保証する部分インデックス
        Index(
            "uq_circle_members_active",
            "circle_id", "user_id",
            unique=True,
            postgresql_where="left_at IS NULL",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    circle_id = Column(UUID(as_uuid=True), ForeignKey("circles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False, default="member")   # 'owner' / 'admin' / 'member'
    joined_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    left_at = Column(DateTime)   # NULL = 在籍中。値があれば脱退済み

    circle = relationship("Circle", back_populates="members")
    user = relationship("User", back_populates="circle_memberships")


class CircleMemberPermission(Base):
    __tablename__ = "circle_member_permissions"
    __table_args__ = (
        UniqueConstraint(
            "circle_id",
            "user_id",
            "permission_key",
            name="uq_circle_member_permissions_circle_user_permission",
        ),
        Index("ix_circle_member_permissions_circle", "circle_id"),
        Index("ix_circle_member_permissions_user", "user_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    circle_id = Column(UUID(as_uuid=True), ForeignKey("circles.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    permission_key = Column(String, nullable=False)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class CircleAdminActionLog(Base):
    __tablename__ = "circle_admin_action_logs"
    __table_args__ = (
        Index("ix_circle_admin_action_logs_circle_created", "circle_id", "created_at"),
        Index("ix_circle_admin_action_logs_actor", "actor_user_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    circle_id = Column(UUID(as_uuid=True), ForeignKey("circles.id", ondelete="CASCADE"), nullable=False)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    permission_key = Column(String, nullable=False)
    target_type = Column(String, nullable=False)
    target_id = Column(UUID(as_uuid=True))
    summary = Column(String, nullable=False)
    details = Column(Text)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# =====================================================================
# 3. 定期ライブ
# =====================================================================
class LiveEvent(Base):
    __tablename__ = "live_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    circle_id = Column(UUID(as_uuid=True), ForeignKey("circles.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)             # "2026年8月 定例夏ライブ"
    event_date = Column(Date)                         # 実施日（未確定OK）
    entry_status = Column(String, nullable=False, default="closed")  # 'open' / 'closed'
    lifecycle_status = Column(String, nullable=False, default="scheduled")
    # 'scheduled'(開催前/開催中) / 'completed'(終了) / 'cancelled'(中止)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    circle = relationship("Circle", back_populates="live_events")
    user_statuses = relationship("UserLiveEventStatus", back_populates="live_event",
                                 cascade="all, delete-orphan")
    song_applications = relationship("SongLiveApplication", back_populates="live_event",
                                     cascade="all, delete-orphan")
    participant_payments = relationship(
        "LiveEventParticipantPayment",
        back_populates="live_event",
        cascade="all, delete-orphan",
    )


class LiveEventParticipantPayment(Base):
    __tablename__ = "live_event_participant_payments"
    __table_args__ = (
        UniqueConstraint(
            "live_event_id",
            "participant_type",
            "participant_key",
            name="uq_live_event_participant_payments_event_participant",
        ),
        Index("ix_live_event_participant_payments_event", "live_event_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    live_event_id = Column(UUID(as_uuid=True), ForeignKey("live_events.id", ondelete="CASCADE"), nullable=False)
    participant_type = Column(String, nullable=False)  # 'circle_member' / 'external_member'
    participant_key = Column(String, nullable=False)   # user_id string or external member name
    payment_status = Column(String, nullable=False, default="unpaid")
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    live_event = relationship("LiveEvent", back_populates="participant_payments")
    updater = relationship("User")


class UserLiveEventStatus(Base):
    """ユーザーの「この月どうする?」表明。レコード無し = want_invites と同義。"""
    __tablename__ = "user_live_event_status"
    __table_args__ = (
        UniqueConstraint("user_id", "live_event_id", name="uq_user_live_event"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    live_event_id = Column(UUID(as_uuid=True), ForeignKey("live_events.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False, default="want_invites")
    # 'want_invites'(誘ってほしい / default) / 'available'(出演予定あり) / 'unavailable'(今月なし)
    memo = Column(Text)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="live_event_statuses")
    live_event = relationship("LiveEvent", back_populates="user_statuses")


# =====================================================================
# 4. 曲起票
# =====================================================================
class SongRequest(Base):
    """
    曲の本体。「メンバーが集まっているか」のみを表現する。
    出演ライブとは結合しない（song_live_applications 経由でのみ繋がる）。
    """
    __tablename__ = "song_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    circle_id = Column(UUID(as_uuid=True), ForeignKey("circles.id", ondelete="CASCADE"), nullable=False)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    artist = Column(String, nullable=False)
    reference_url = Column(String)
    memo = Column(Text)
    timing_preference_memo = Column(Text)   # 「9月以降希望」「7月は不可」など

    status = Column(String, nullable=False, default="recruiting")
    # 'recruiting'(募集中) / 'ready'(メンバー確定) / 'archived'(終了) / 'cancelled'(中止)

    planned_month = Column(String)  # 「2026-08」形式の実施予定月。未定は NULL。

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    circle = relationship("Circle", back_populates="songs")
    requester = relationship("User", back_populates="requested_songs", foreign_keys=[requested_by])
    recruiting_parts = relationship("SongRecruitingPart", back_populates="song",
                                     cascade="all, delete-orphan")
    external_members = relationship("SongExternalMember", back_populates="song",
                                    cascade="all, delete-orphan")
    entries = relationship("SongPartEntry", back_populates="song", cascade="all, delete-orphan")
    live_applications = relationship("SongLiveApplication", back_populates="song",
                                     cascade="all, delete-orphan")
    chat_room = relationship("SongChatRoom", back_populates="song", uselist=False,
                             cascade="all, delete-orphan")


class SongRecruitingPart(Base):
    """
    曲ごとに『何のパートを何人募集しているか』。
    required_count = 例えばツインボーカルなら 2 / リード+リズムGtなら 2。
    """
    __tablename__ = "song_recruiting_parts"
    __table_args__ = (
        UniqueConstraint("song_request_id", "part", name="uq_song_recruiting_parts_song_part"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    song_request_id = Column(UUID(as_uuid=True), ForeignKey("song_requests.id", ondelete="CASCADE"),
                             nullable=False)
    part = Column(String, nullable=False)
    required_count = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    song = relationship("SongRequest", back_populates="recruiting_parts")


class SongExternalMember(Base):
    """アプリ内ユーザーと紐付けない、確定済みの外部メンバー。"""
    __tablename__ = "song_external_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    song_request_id = Column(UUID(as_uuid=True), ForeignKey("song_requests.id", ondelete="CASCADE"),
                             nullable=False)
    part = Column(String, nullable=False)
    member_name = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    song = relationship("SongRequest", back_populates="external_members")


# =====================================================================
# 5. 応募 / お誘い（統合テーブル）
# =====================================================================
class SongPartEntry(Base):
    """
    『この曲のこのパートに対する候補』を1行で表す。
    応募(application) もお誘い(offer) もここに入る。kind で区別。

    status 意味:
      - pending  : 相手の決定待ち
      - accepted : 確定（応募→起案者が承認 / オファー→誘われた人が了承）
      - declined : 相手が断った
      - withdrawn: 自分から取り下げた

    UNIQUE制約は意図的に付けない。
    同じユーザーが同じパートに過去に応募→辞退→再応募した履歴を残す。
    アプリ側で「アクティブな entry は (song,user,part) に1件」を保証する。
    """
    __tablename__ = "song_part_entries"
    __table_args__ = (
        Index("ix_song_part_entries_song", "song_request_id"),
        Index("ix_song_part_entries_user", "user_id"),
        Index("ix_song_part_entries_status", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    song_request_id = Column(UUID(as_uuid=True), ForeignKey("song_requests.id", ondelete="CASCADE"),
                             nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    part = Column(String, nullable=False)
    part_detail = Column(String)

    kind = Column(String, nullable=False)        # 'application' / 'offer'
    status = Column(String, nullable=False, default="pending")
    # 'pending' / 'accepted' / 'declined' / 'withdrawn'

    timing_memo = Column(Text)                   # 応募時の時期希望メモ
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    responded_at = Column(DateTime)              # 相手の決定（accept/decline）日時
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    song = relationship("SongRequest", back_populates="entries")
    user = relationship("User", foreign_keys=[user_id])
    created_by_user = relationship("User", foreign_keys=[created_by])


# =====================================================================
# 6. ライブ申請（曲 × ライブ）
# =====================================================================
class SongLiveApplication(Base):
    """
    『この曲を、このライブで演る』申請。
    起案者(またはリーダー) → サークル主催者 への申請。
    同じ曲が複数のライブに申請履歴を持てる。アクティブは1件想定。

    status 意味:
      - applied  : 申請中（主催者の決裁待ち）
      - approved : 主催者承認 → ライブ出演確定
      - rejected : 主催者が却下
      - withdrawn: 申請取り下げ
    """
    __tablename__ = "song_live_applications"
    __table_args__ = (
        Index("ix_song_live_applications_song", "song_request_id"),
        Index("ix_song_live_applications_event", "live_event_id"),
        Index("ix_song_live_applications_status", "status"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    song_request_id = Column(UUID(as_uuid=True), ForeignKey("song_requests.id", ondelete="CASCADE"),
                             nullable=False)
    live_event_id = Column(UUID(as_uuid=True), ForeignKey("live_events.id", ondelete="CASCADE"),
                           nullable=False)

    status = Column(String, nullable=False, default="applied")

    applied_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    applied_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    decided_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))   # 主催者
    decided_at = Column(DateTime)
    memo = Column(Text)

    song = relationship("SongRequest", back_populates="live_applications")
    live_event = relationship("LiveEvent", back_populates="song_applications")
    applicant = relationship("User", foreign_keys=[applied_by])
    decider = relationship("User", foreign_keys=[decided_by])


# =====================================================================
# 7. 通知
# =====================================================================
class Notification(Base):
    """ユーザーごとのアプリ内通知。read_at が NULL なら未読。"""
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "read_at"),
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text)
    link_path = Column(String)
    related_song_live_application_id = Column(
        UUID(as_uuid=True),
        ForeignKey("song_live_applications.id", ondelete="SET NULL"),
    )
    related_song_part_entry_id = Column(
        UUID(as_uuid=True),
        ForeignKey("song_part_entries.id", ondelete="SET NULL"),
    )
    read_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
    related_song_live_application = relationship("SongLiveApplication")
    related_song_part_entry = relationship("SongPartEntry")


# =====================================================================
# 8. チャット（曲に1対1）
# =====================================================================
class SongChatRoom(Base):
    __tablename__ = "song_chat_rooms"
    __table_args__ = (
        UniqueConstraint("song_request_id", name="uq_song_chat_rooms_song"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    song_request_id = Column(UUID(as_uuid=True), ForeignKey("song_requests.id", ondelete="CASCADE"),
                             nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    song = relationship("SongRequest", back_populates="chat_room")
    participants = relationship("ChatRoomParticipant", back_populates="chat_room",
                                cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="chat_room",
                            cascade="all, delete-orphan")


class ChatRoomParticipant(Base):
    __tablename__ = "chat_room_participants"
    __table_args__ = (
        UniqueConstraint("chat_room_id", "user_id", name="uq_chat_room_participants_room_user"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_room_id = Column(UUID(as_uuid=True), ForeignKey("song_chat_rooms.id", ondelete="CASCADE"),
                          nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_read_at = Column(DateTime)        # 未読バッジ用

    chat_room = relationship("SongChatRoom", back_populates="participants")
    user = relationship("User")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("ix_chat_messages_room_created", "chat_room_id", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_room_id = Column(UUID(as_uuid=True), ForeignKey("song_chat_rooms.id", ondelete="CASCADE"),
                          nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    chat_room = relationship("SongChatRoom", back_populates="messages")
    user = relationship("User")
