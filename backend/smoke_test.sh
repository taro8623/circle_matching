#!/usr/bin/env bash
# 主要APIの正常系を1回通すスモークテスト。
# 前提: uvicorn が 127.0.0.1:8001 で起動済み + DB が空。

set -euo pipefail

BASE="http://127.0.0.1:8001"

echo "== signup A (起案者) =="
curl -s -X POST "$BASE/signup" \
  -H 'Content-Type: application/json' \
  -d '{"name":"alice","email":"alice@example.com","password":"pass1"}'
echo

echo "== signup B (応募者) =="
curl -s -X POST "$BASE/signup" \
  -H 'Content-Type: application/json' \
  -d '{"name":"bob","email":"bob@example.com","password":"pass2"}'
echo

echo "== login A =="
TOKEN_A=$(curl -s -X POST "$BASE/login" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=alice@example.com&password=pass1' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
echo "TOKEN_A=${TOKEN_A:0:20}..."

echo "== login B =="
TOKEN_B=$(curl -s -X POST "$BASE/login" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=bob@example.com&password=pass2' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
echo "TOKEN_B=${TOKEN_B:0:20}..."

echo "== Aがサークル作成 =="
CIRCLE=$(curl -s -X POST "$BASE/circles" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"name":"テストサークル","join_password":"secret","description":"テスト用"}')
echo "$CIRCLE"
CIRCLE_ID=$(echo "$CIRCLE" | python3 -c 'import sys,json;print(json.load(sys.stdin)["circle_id"])')

echo "== Bがサークル参加 =="
curl -s -X POST "$BASE/circles/join" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d "{\"circle_id\":\"$CIRCLE_ID\",\"join_password\":\"secret\"}"
echo

echo "== B が担当パート設定 (Vo, Gt) =="
curl -s -X PUT "$BASE/me/parts" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d '{"parts":["Vo","Gt"]}'
echo

echo "== A が曲起票 (Vo 1人, Gt 2人募集) =="
SONG=$(curl -s -X POST "$BASE/circles/$CIRCLE_ID/songs" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"title":"スモークテスト曲","artist":"テスト","reference_url":"https://youtube.com/x","memo":"よろしく","timing_preference_memo":"9月以降希望","recruiting_parts":[{"part":"Vo","required_count":1},{"part":"Gt","required_count":2}]}')
echo "$SONG"
SONG_ID=$(echo "$SONG" | python3 -c 'import sys,json;print(json.load(sys.stdin)["song_id"])')

echo "== B が Vo に応募 =="
APP=$(curl -s -X POST "$BASE/songs/$SONG_ID/applications" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d '{"part":"Vo","timing_memo":"10月希望"}')
echo "$APP"
ENTRY_ID=$(echo "$APP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["entry_id"])')

echo "== A が応募を承認 =="
curl -s -X PATCH "$BASE/entries/$ENTRY_ID" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"status":"accepted"}'
echo

echo "== A がメンバー確定 (ready) =="
curl -s -X PATCH "$BASE/songs/$SONG_ID/status" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"status":"ready"}'
echo

echo "== A がライブイベント作成 =="
EVENT=$(curl -s -X POST "$BASE/circles/$CIRCLE_ID/live-events" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d '{"name":"2026年9月 ライブ","event_date":"2026-09-15"}')
echo "$EVENT"
EVENT_ID=$(echo "$EVENT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')

echo "== A がライブに申請 =="
curl -s -X POST "$BASE/songs/$SONG_ID/live-applications" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H 'Content-Type: application/json' \
  -d "{\"live_event_id\":\"$EVENT_ID\"}"
echo

echo "== チャットに B が投稿 =="
curl -s -X POST "$BASE/songs/$SONG_ID/chat" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d '{"content":"よろしくお願いします!"}'
echo

echo "== 曲詳細確認 =="
curl -s "$BASE/songs/$SONG_ID" \
  -H "Authorization: Bearer $TOKEN_B" | python3 -m json.tool

echo "=== スモークテスト完了 ==="
