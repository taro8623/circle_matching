"""サークル作成/参加/詳細"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from deps import get_db, get_current_user, require_circle_member
from models import (
    User, Circle, CircleMember, SongRequest, SongRecruitingPart, UserPart,
)
from schemas.circle import (
    CircleCreate, CircleJoinRequest, CircleDetailResponse,
    MemberResponse, SongSummary,
)


router = APIRouter(prefix="/circles", tags=["circles"])


@router.post("")
def create_circle(
    circle: CircleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle_name = circle.name.strip()
    if not circle_name:
        raise HTTPException(status_code=400, detail="サークル名を入力してください")

    existing = db.query(Circle).filter(Circle.name == circle_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="すでに同じ名前のサークルがあります")

    new_circle = Circle(
        name=circle_name,
        join_password=circle.join_password,
        description=circle.description,
    )
    db.add(new_circle)
    db.flush()

    db.add(
        CircleMember(
            circle_id=new_circle.id,
            user_id=current_user.id,
            role="owner",
        )
    )
    db.commit()
    db.refresh(new_circle)
    return {"message": "サークルを作成しました", "circle_id": str(new_circle.id)}


@router.post("/join")
def join_circle(
    req: CircleJoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.circle_name:
        matched_circles = db.query(Circle).filter(Circle.name == req.circle_name).all()
        if not matched_circles:
            raise HTTPException(status_code=401, detail="サークル名またはパスワードが違います")
        if len(matched_circles) > 1:
            raise HTTPException(
                status_code=409,
                detail="同じ名前のサークルが複数あります。管理者にサークルIDを確認してください",
            )
        circle = matched_circles[0]
    elif req.circle_id:
        circle = db.query(Circle).filter(Circle.id == req.circle_id).first()
        if not circle:
            raise HTTPException(status_code=401, detail="サークル名またはパスワードが違います")
    else:
        raise HTTPException(status_code=400, detail="サークル名を入力してください")

    if circle.join_password != req.join_password:
        raise HTTPException(status_code=401, detail="サークル名またはパスワードが違います")

    # 既に在籍中?
    active = (
        db.query(CircleMember)
        .filter(
            CircleMember.circle_id == circle.id,
            CircleMember.user_id == current_user.id,
            CircleMember.left_at.is_(None),
        )
        .first()
    )
    if active:
        return {"message": "すでに参加しています", "circle_id": str(circle.id)}

    # 脱退済み?(再加入)
    left = (
        db.query(CircleMember)
        .filter(
            CircleMember.circle_id == circle.id,
            CircleMember.user_id == current_user.id,
            CircleMember.left_at.isnot(None),
        )
        .first()
    )
    if left:
        left.left_at = None
        db.commit()
        return {"message": "サークルに再加入しました", "circle_id": str(circle.id)}

    db.add(
        CircleMember(
            circle_id=circle.id,
            user_id=current_user.id,
            role="member",
        )
    )
    db.commit()
    return {"message": "サークルに参加しました", "circle_id": str(circle.id)}


@router.get("/{circle_id}", response_model=CircleDetailResponse)
def get_circle_detail(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circle = db.query(Circle).filter(Circle.id == circle_id).first()
    if not circle:
        raise HTTPException(status_code=404, detail="Circle not found")
    require_circle_member(db, circle_id, current_user.id)

    # アクティブメンバー
    members = (
        db.query(CircleMember, User)
        .join(User, CircleMember.user_id == User.id)
        .filter(
            CircleMember.circle_id == circle_id,
            CircleMember.left_at.is_(None),
        )
        .all()
    )
    member_list = []
    for cm, u in members:
        parts = [
            r.part for r in db.query(UserPart).filter(UserPart.user_id == u.id).all()
        ]
        member_list.append(
            MemberResponse(id=u.id, name=u.name, parts=parts, role=cm.role)
        )

    # 曲一覧(サマリのみ)
    songs = db.query(SongRequest).filter(SongRequest.circle_id == circle_id).all()
    song_list = []
    for s in songs:
        recruiting_parts = [
            r.part
            for r in db.query(SongRecruitingPart)
            .filter(SongRecruitingPart.song_request_id == s.id)
            .all()
        ]
        song_list.append(
            SongSummary(
                id=s.id,
                title=s.title,
                artist=s.artist,
                reference_url=s.reference_url,
                status=s.status,
                recruiting_parts=recruiting_parts,
            )
        )

    return CircleDetailResponse(
        id=circle.id,
        name=circle.name,
        description=circle.description,
        members=member_list,
        songs=song_list,
    )


@router.post("/{circle_id}/leave")
def leave_circle(
    circle_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """サークルから脱退(論理削除)"""
    from datetime import datetime as _dt

    membership = require_circle_member(db, circle_id, current_user.id)
    membership.left_at = _dt.utcnow()
    db.commit()
    return {"message": "サークルから脱退しました"}
