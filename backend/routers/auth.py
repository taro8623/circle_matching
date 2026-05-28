"""認証(signup / login)"""

import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from deps import (
    get_db, hash_password, verify_password, create_access_token,
)
from models import User
from schemas.user import SignupRequest


router = APIRouter(tags=["auth"])


def is_public_signup_enabled() -> bool:
    value = os.environ.get("PUBLIC_SIGNUP_ENABLED", "false")
    return value.lower() in {"1", "true", "yes", "on"}


@router.post("/signup")
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    if not is_public_signup_enabled():
        raise HTTPException(
            status_code=403,
            detail="現在は公開デモ中のため新規登録を停止しています",
        )

    exists = db.query(User).filter(User.email == request.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="このメールアドレスは登録済みです")

    user = User(
        name=request.name,
        email=request.email,
        password_hash=hash_password(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User created", "user_id": str(user.id)}


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    if not form_data.username or not form_data.password:
        raise HTTPException(status_code=400, detail="IDとパスワードを入力してください")
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    access_token = create_access_token({"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}
