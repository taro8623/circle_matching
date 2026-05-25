#!/usr/bin/env bash
# 新スキーマを適用するスクリプト。
# 1. mydb を drop して create
# 2. alembic upgrade head で新スキーマ作成
# 3. (必要なら) サンプルユーザー作成
#
# 使い方:
#   cd ~/dev/backend
#   bash apply.sh
#
# 危険: 既存DBが消えます。実行前に必ず確認してください。

set -euo pipefail

DB_NAME="${DB_NAME:-mydb}"
DB_USER="${DB_USER:-fukutomitaro}"

cd "$(dirname "$0")"

echo "================================================"
echo "  Circle Matching - 新スキーマ適用"
echo "================================================"
echo
echo "  DB: $DB_NAME (user: $DB_USER)"
echo "  既存データはすべて消えます。"
echo

read -p "  続行しますか? (yes/N) " ans
if [[ "$ans" != "yes" ]]; then
  echo "中止しました。"
  exit 0
fi

echo
echo "[1/3] DB drop & create..."

# 既存接続を強制切断 (uvicorn等が掴んでても落とせるように)
echo "  既存接続を切断..."
psql -U "$DB_USER" -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
" >/dev/null 2>&1 || true

psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"

echo
echo "[2/3] Alembic upgrade..."
if [[ -f venv/bin/alembic ]]; then
  venv/bin/alembic upgrade head
else
  alembic upgrade head
fi

echo
echo "[3/3] テーブル一覧確認..."
psql -U "$DB_USER" -d "$DB_NAME" -c "\dt"

echo
echo "================================================"
echo "  完了。uvicorn を起動してください:"
echo "    venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001 --reload"
echo "================================================"
