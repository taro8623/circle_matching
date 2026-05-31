# Project Context: Backend (FastAPI)

## エレベーターピッチ
サークル内での曲起票、メンバー募集、ライブ申請、チャットを統合したバンドマッチングアプリのバックエンド。

## 技術スタック
- **Framework**: FastAPI (Python 3.12+)
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **Migration**: Alembic
- **Auth**: JWT (deps.py)

## アーキテクチャ・規約
- **Router分割**: `routers/` に機能ごとに分割。
- **Schema**: `schemas/` (Pydantic) を使用。
- **Service**: 共通ロジックは `services/` (例: `song_builder.py`) に集約。
- **命名規則**: `snake_case`
- **言語**: コメントやドキュメントは日本語。

## 開発フロー
- DBの初期化・更新は `bash apply.sh` を使用。
- 疎通確認は `bash smoke_test.sh` で実施。

## 今後の課題 (WAKE_UP.md より)
- 通知システム (メール/プッシュ)
- 主催者向け管理画面のバックエンド
- JWT リフレッシュトークン
