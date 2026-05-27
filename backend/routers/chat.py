"""曲チャット"""

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from deps import get_db, get_current_user, require_circle_member
from models import (
    User, SongRequest, SongChatRoom, ChatRoomParticipant, ChatMessage,
    Notification,
)
from schemas.chat import (
    ChatMessageCreateRequest, ChatMessageResponse, ChatRoomResponse, ChatRoomListItemResponse,
)
from services.song_builder import ensure_chat_room


router = APIRouter(tags=["chat"])


def _ensure_participant(db: Session, chat_room_id: UUID, user_id: UUID) -> None:
    """この部屋の参加者か?(参加者以外は読めない)"""
    p = db.query(ChatRoomParticipant).filter(
        ChatRoomParticipant.chat_room_id == chat_room_id,
        ChatRoomParticipant.user_id == user_id,
    ).first()
    if not p:
        raise HTTPException(status_code=403, detail="このチャットへのアクセス権がありません")


@router.get("/songs/{song_id}/chat", response_model=ChatRoomResponse)
def get_chat(
    song_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(SongRequest).filter(SongRequest.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    require_circle_member(db, song.circle_id, current_user.id)

    chat = db.query(SongChatRoom).filter(SongChatRoom.song_request_id == song_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="チャット部屋はまだ作成されていません")

    _ensure_participant(db, chat.id, current_user.id)
    participant = db.query(ChatRoomParticipant).filter(
        ChatRoomParticipant.chat_room_id == chat.id,
        ChatRoomParticipant.user_id == current_user.id,
    ).first()
    if participant:
        participant.last_read_at = datetime.utcnow()

    participants = (
        db.query(ChatRoomParticipant).filter(ChatRoomParticipant.chat_room_id == chat.id).all()
    )
    messages = (
        db.query(ChatMessage, User)
        .join(User, ChatMessage.user_id == User.id)
        .filter(ChatMessage.chat_room_id == chat.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    db.commit()

    return ChatRoomResponse(
        id=chat.id,
        song_request_id=chat.song_request_id,
        participant_ids=[p.user_id for p in participants],
        messages=[
            ChatMessageResponse(
                id=m.id,
                user_id=m.user_id,
                user_name=u.name,
                content=m.content,
                created_at=m.created_at,
            )
            for m, u in messages
        ],
    )


@router.post("/songs/{song_id}/chat", response_model=ChatMessageResponse)
def post_chat_message(
    request: ChatMessageCreateRequest,
    song_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    song = db.query(SongRequest).filter(SongRequest.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    require_circle_member(db, song.circle_id, current_user.id)

    chat = db.query(SongChatRoom).filter(SongChatRoom.song_request_id == song_id).first()
    if not chat:
        # 起案者が最初にメッセージを書く場合、自動で部屋を作る
        chat = ensure_chat_room(db, song_id, song.requested_by)

    _ensure_participant(db, chat.id, current_user.id)

    content = request.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="メッセージを入力してください")

    msg = ChatMessage(
        chat_room_id=chat.id,
        user_id=current_user.id,
        content=content,
    )
    db.add(msg)
    db.flush()
    participant = db.query(ChatRoomParticipant).filter(
        ChatRoomParticipant.chat_room_id == chat.id,
        ChatRoomParticipant.user_id == current_user.id,
    ).first()
    if participant:
        participant.last_read_at = msg.created_at

    participants = (
        db.query(ChatRoomParticipant)
        .filter(
            ChatRoomParticipant.chat_room_id == chat.id,
            ChatRoomParticipant.user_id != current_user.id,
        )
        .all()
    )
    preview = content if len(content) <= 80 else f"{content[:80]}..."
    for participant in participants:
        db.add(Notification(
            user_id=participant.user_id,
            type="chat_message_received",
            title="新しいチャットメッセージがあります",
            body=f"{current_user.name} さんが「{song.title}」にメッセージを送信しました: {preview}",
            link_path=f"/songs/{song.id}/chat",
        ))

    db.commit()
    db.refresh(msg)

    return ChatMessageResponse(
        id=msg.id,
        user_id=msg.user_id,
        user_name=current_user.name,
        content=msg.content,
        created_at=msg.created_at,
    )


@router.get("/circles/{circle_id}/chat-rooms", response_model=List[ChatRoomListItemResponse])
def list_circle_chat_rooms(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_circle_member(db, circle_id, current_user.id)

    participant_rows = (
        db.query(ChatRoomParticipant, SongChatRoom, SongRequest)
        .join(SongChatRoom, ChatRoomParticipant.chat_room_id == SongChatRoom.id)
        .join(SongRequest, SongChatRoom.song_request_id == SongRequest.id)
        .filter(
            ChatRoomParticipant.user_id == current_user.id,
            SongRequest.circle_id == circle_id,
        )
        .all()
    )

    items: list[ChatRoomListItemResponse] = []
    for participant, chat_room, song in participant_rows:
        last_message = (
            db.query(ChatMessage)
            .filter(ChatMessage.chat_room_id == chat_room.id)
            .order_by(ChatMessage.created_at.desc())
            .first()
        )
        unread_count_query = db.query(ChatMessage).filter(
            ChatMessage.chat_room_id == chat_room.id,
        )
        if participant.last_read_at is not None:
            unread_count_query = unread_count_query.filter(
                ChatMessage.created_at > participant.last_read_at
            )
        unread_count = unread_count_query.count()
        preview = None
        last_message_at = None
        if last_message:
            preview = last_message.content if len(last_message.content) <= 80 else f"{last_message.content[:80]}..."
            last_message_at = last_message.created_at

        items.append(
            ChatRoomListItemResponse(
                chat_room_id=chat_room.id,
                song_request_id=song.id,
                song_title=song.title,
                artist=song.artist,
                last_message_preview=preview,
                last_message_at=last_message_at,
                unread_count=unread_count,
            )
        )

    items.sort(
        key=lambda item: item.last_message_at or datetime.min,
        reverse=True,
    )
    return items
