"""
Alembic environment.
- models.py の Base.metadata を target にして autogenerate を効かせる
- DATABASE_URL は database.py のものをそのまま使う(env変数オーバーライド可能)
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# プロジェクトルート(backend/)を import path に追加
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, SQLALCHEMY_DATABASE_URL  # noqa: E402
import models  # noqa: F401, E402   # 全モデルを Base.metadata に登録するため import 必須


config = context.config

# alembic.ini の sqlalchemy.url を上書き
config.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
