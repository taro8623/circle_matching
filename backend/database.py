"""
DB接続とSessionLocal、Base のみを定義する。
スキーマ管理は Alembic に任せる(init_db は廃止)。
"""

import os
from functools import lru_cache

from sqlalchemy import create_engine, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


SQLALCHEMY_DATABASE_URL = normalize_database_url(os.environ.get(
    "DATABASE_URL",
    "postgresql://fukutomitaro@localhost:5432/mydb",
))

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


@lru_cache(maxsize=None)
def has_table(table_name: str) -> bool:
    return inspect(engine).has_table(table_name)
