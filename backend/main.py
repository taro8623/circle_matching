"""
FastAPI アプリのエントリポイント。
- CORS設定
- ルーター登録のみ。実装は routers/*.py を参照。
- DB初期化は Alembic に委譲 (alembic upgrade head)
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import (
    auth, users, circles, songs, entries, live_events, applications, chat,
    notifications,
)


app = FastAPI(title="Circle Matching API")


def get_allowed_origins() -> list[str]:
    defaults = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]
    raw = os.environ.get("CORS_ALLOW_ORIGINS", "")
    configured = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return list(dict.fromkeys([*defaults, *configured]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- ルーター登録 -----
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(circles.router)
app.include_router(songs.router)
app.include_router(entries.router)
app.include_router(live_events.router)
app.include_router(applications.router)
app.include_router(chat.router)
app.include_router(notifications.router)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
