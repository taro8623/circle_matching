# 起きたらやること

## 0. (スマホから見たい場合のみ) git push をMacから実行

サンドボックスから .git/ への書き込みが弾かれたため、push は自分で1回だけ実行が必要です。

```bash
cd ~/dev
rm -f .git/index.lock      # 残留ロックを除去
git add -A
git commit -m "Refactor: schema v2 (band matching + live application)

- 新スキーマ13テーブル(users, user_parts, circles, circle_members, live_events,
  user_live_event_status, song_requests, song_recruiting_parts, song_part_entries,
  song_live_applications, song_chat_rooms, chat_room_participants, chat_messages)
- Alembic導入 + 初期マイグレーション
- main.py を routers/ schemas/ services/ に分割
- 応募/オファー/承認/ライブ申請/チャット 一式実装
- フロント: SongDetail, SongChat, LiveEvents 画面追加
"
git push origin main
```

push 後、スマホブラウザで以下を見れば全変更が読めます:
https://github.com/taro8623/circle_matching

特に見るべきファイル:
- `backend/WAKE_UP.md` (このファイル)
- `backend/models.py` (新スキーマ)
- `backend/routers/` (新エンドポイント)
- `circle-matching-frontend/src/pages/SongDetail.tsx`

## 1. 変更内容のレビュー

```bash
cd ~/dev
git status
git diff backend/models.py backend/main.py backend/database.py
```

新規ファイル(主要なもの):
- `backend/alembic/versions/0001_initial_schema.py` — 初期マイグレーション(13テーブル)
- `backend/deps.py` — get_db, get_current_user, JWT
- `backend/routers/` — auth, users, circles, songs, entries, live_events, applications, chat
- `backend/schemas/` — Pydanticモデル
- `backend/services/song_builder.py` — レスポンス組み立て共通ロジック
- `backend/apply.sh` — DB drop & migration適用(対話確認あり)
- `backend/smoke_test.sh` — API正常系をcurlで一気通貫
- `circle-matching-frontend/src/api.ts` — fetchラッパー(URL集約)
- `circle-matching-frontend/src/pages/SongDetail.tsx` — 曲詳細(応募/オファー/承認/ライブ申請)
- `circle-matching-frontend/src/pages/SongChat.tsx` — チャット
- `circle-matching-frontend/src/pages/LiveEvents.tsx` — ライブ管理

## 2. DB を作り直し + マイグレーション適用

```bash
cd ~/dev/backend
bash apply.sh
# "yes" を入力すると DB drop → create → alembic upgrade head
```

エラーが出た場合の対処:
- `alembic コマンドがない` → `venv/bin/alembic upgrade head` を直接叩く
- `psql 接続できない` → `pg_isready -h localhost` で Postgres 起動確認

## 3. バックエンド起動

```bash
cd ~/dev/backend
venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

`http://127.0.0.1:8001/health` が `{"status":"ok"}` を返せばOK。
`http://127.0.0.1:8001/docs` で全エンドポイントが見れます。

## 4. スモークテスト(API一気通貫)

別ターミナルで:
```bash
cd ~/dev/backend
bash smoke_test.sh
```

これで以下が一気に通ります:
- signup × 2 (alice / bob)
- login × 2
- alice がサークル作成
- bob がサークル参加
- bob が担当パート設定 (Vo, Gt)
- alice が曲起票 (Vo 1人 / Gt 2人募集)
- bob が Vo に応募
- alice が承認
- alice がメンバー確定(ready)
- alice がライブ作成
- alice がライブ申請
- bob がチャットに投稿
- 最後に曲詳細をJSON表示

## 5. フロント起動

```bash
cd ~/dev/circle-matching-frontend
npm run dev
```

ブラウザで `http://localhost:5173` を開く。フロー:
1. signup でユーザー作成
2. login
3. `/me` で 担当パート設定
4. サークル作成 → 詳細画面
5. 「曲を起票」→ 募集パートと人数を選んで起票
6. 別ブラウザ/シークレットで別ユーザー作成 → サークル参加 → 応募
7. 起案者で曲詳細を開いて「承認」
8. 「メンバー確定」「ライブ申請」「チャット」を順に試す

---

## トラブルシューティング

### 「`from database import Base` できない」
→ `cd ~/dev/backend && PYTHONPATH=. venv/bin/python -c "import models"` で確認。
   venv の python と sqlalchemy のバージョンずれの可能性。

### Alembicが「No 'script_location' key」と言う
→ `alembic.ini` の確認。`script_location = alembic` がある。実行は backend/ 直下から。

### Frontend が CORS エラー
→ `main.py` の allow_origins に localhost:5173 / 5174 が入っている。
   それでもダメなら `--reload` で uvicorn 再起動。

### 「user_parts テーブルに INSERT 失敗 (uq_user_parts_user_part)」
→ 既存ユーザーが同じパートを2回POST。`PUT /me/parts` は全削除→入れ直すので通常起きない。

---

## 既知の未実装(次回以降)

- フロント側、ユーザーの受信オファー一覧(自分宛て pending offer)を一覧表示する画面
- 主催者向けの「このライブに何の曲が申請されてるか」一覧画面
- 同じメンバーで新曲起票時のメンバー引き継ぎUI
- チャット内の「参考音源プレビュー」「楽譜ピン留め」
- 通知システム(メール / プッシュ)
- JWT 期限切れ時の自動リフレッシュ
- venv の python3.12 / 3.13 ズレ整理

---

## ロールバックしたい場合

DBは作り直しただけなので、コードは git で戻せます:
```bash
cd ~/dev
git stash         # 変更を退避
# または
git checkout backend/main.py backend/models.py backend/database.py
git clean -fd backend/routers backend/schemas backend/services backend/alembic/versions
```

ただし `mydb` の中身は apply.sh 実行後は新スキーマになっているので、元のスキーマには戻りません(初期状態は空)。
