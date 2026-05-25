"""
FastAPI 依存関数。
- get_db: SQLAlchemyセッション
- get_current_user: JWT解析 → User取得
- require_circle_member: サークル所属チェック
- get_current_circle_member: 所属(left_at IS NULL)を返す
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User, CircleMember


# -------------------------
# JWT / パスワード
# -------------------------
SECRET_KEY = "your_secret_key_here"        # TODO: env変数化
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# -------------------------
# DB セッション
# -------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------------
# 認証
# -------------------------
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# -------------------------
# サークル所属チェック
# -------------------------
def require_circle_member(db: Session, circle_id: UUID, user_id: UUID) -> CircleMember:
    membership = (
        db.query(CircleMember)
        .filter(
            CircleMember.circle_id == circle_id,
            CircleMember.user_id == user_id,
            CircleMember.left_at.is_(None),
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="このサークルに参加していません")
    return membership


def require_circle_admin(db: Session, circle_id: UUID, user_id: UUID) -> CircleMember:
    """サークル管理者(admin/owner) チェック"""
    membership = require_circle_member(db, circle_id, user_id)
    if membership.role not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="サークル管理者権限が必要です")
    return membership
