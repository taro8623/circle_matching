"""自分のプロフィール / 担当パート"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from deps import get_db, get_current_user
from models import User, UserPart, Circle, CircleMember
from schemas.user import (
    MeResponse, UserPartsUpdateRequest, CircleSummaryResponse,
)


router = APIRouter(prefix="/me", tags=["users"])


def _user_parts(db: Session, user_id) -> List[str]:
    rows = db.query(UserPart).filter(UserPart.user_id == user_id).all()
    return [r.part for r in rows]


@router.get("", response_model=MeResponse)
def read_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return MeResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        parts=_user_parts(db, current_user.id),
    )


@router.put("/parts")
def update_my_parts(
    request: UserPartsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 入力を正規化
    normalized: List[str] = []
    for p in request.parts:
        s = p.strip()
        if s and s not in normalized:
            normalized.append(s)

    # 既存を全削除して入れ直し(シンプル運用)
    db.query(UserPart).filter(UserPart.user_id == current_user.id).delete()
    for p in normalized:
        db.add(UserPart(user_id=current_user.id, part=p))
    db.commit()

    return {"message": "担当パートを更新しました", "parts": normalized}


@router.get("/circles", response_model=List[CircleSummaryResponse])
def get_my_circles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    circles = (
        db.query(Circle)
        .join(CircleMember, Circle.id == CircleMember.circle_id)
        .filter(
            CircleMember.user_id == current_user.id,
            CircleMember.left_at.is_(None),
        )
        .all()
    )
    return [
        CircleSummaryResponse(id=c.id, name=c.name, description=c.description)
        for c in circles
    ]
