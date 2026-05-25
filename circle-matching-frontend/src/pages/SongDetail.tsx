import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

type RecruitingPart = { part: string; required_count: number; accepted_count: number };
type Entry = {
  id: string;
  user_id: string;
  user_name: string;
  part: string;
  kind: string;       // application / offer
  status: string;     // pending / accepted / declined / withdrawn
  timing_memo?: string | null;
};
type ExternalMember = {
  id: string;
  part: string;
  member_name: string;
};
type Song = {
  id: string;
  circle_id: string;
  title: string;
  artist: string;
  reference_url?: string | null;
  memo?: string | null;
  timing_preference_memo?: string | null;
  status: string;
  requested_by: string;
  requested_by_id: string;
  matching_parts: string[];
  recruiting_parts: RecruitingPart[];
  external_members: ExternalMember[];
  entries: Entry[];
  chat_room_id?: string | null;
  planned_month?: string | null;
};
type Me = { id: string; name: string; email: string; parts: string[] };
type LiveEvent = { id: string; name: string; entry_status: string; event_date?: string | null };
type LiveApplication = {
  id: string;
  song_request_id: string;
  live_event_id: string;
  status: string;
  applied_by: string;
};
type CircleMember = { id: string; name: string; parts: string[]; role?: string };

function entryKindLabel(entry: Entry, song: Song): string {
  if (entry.kind === "application") {
    return "応募";
  }
  if (entry.kind === "offer" && entry.user_id === song.requested_by_id) {
    return "自分で担当";
  }
  return "お誘い";
}

export default function SongDetail() {
  const { songId } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState<Song | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [liveApps, setLiveApps] = useState<LiveApplication[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // 応募モーダル用
  const [applyPart, setApplyPart] = useState("");
  const [applyMemo, setApplyMemo] = useState("");

  // オファーモーダル用
  const [offerUserId, setOfferUserId] = useState("");
  const [offerPart, setOfferPart] = useState("");

  // ライブ申請用
  const [selectedEventId, setSelectedEventId] = useState("");
  const [plannedMonth, setPlannedMonth] = useState("");
  const [suggestedMonths, setSuggestedMonths] = useState<{ month: string; label: string }[]>([]);

  const goBackToCircle = () => {
    if (song?.circle_id) {
      navigate(`/circles/${song.circle_id}`);
      return;
    }
    navigate("/me");
  };

  const reload = async () => {
    if (!songId) return;
    try {
      const s = await api.get<Song>(`/songs/${songId}`);
      setSong(s);
      setPlannedMonth(s.planned_month || "");
      const m = await api.get<Me>(`/me`);
      setMe(m);
      // サークル詳細からメンバーリスト
      const detail = await api.get<{ members: CircleMember[]; id: string }>(
        `/circles/${s.requested_by_id ? "" : ""}`  // placeholder
      ).catch(() => null);
      // circle_id を song から直接取れないので songエンドポイントから推測... → 仕方なくfor-meから取る
      // simpler: 別エンドポイントで取得 (拡張余地。今は省略)
      void detail;
      // ライブ申請
      const apps = await api.get<LiveApplication[]>(`/songs/${songId}/live-applications`).catch(() => []);
      setLiveApps(apps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  // 起案者である場合のみ、サークルメンバーとライブを取りに行く
  useEffect(() => {
    if (!song || !me) return;
    if (song.requested_by_id !== me.id) return;
    // サークル詳細からメンバー一覧を取得するために、circle_id が必要
    // → song エンドポイントの requested_by_id != circle_id なので別途取得が必要
    // 簡易策: /me/circles から探し出す
    api.get<any[]>(`/me/circles`)
      .then(async (circles) => {
        for (const c of circles) {
          const det = await api.get<any>(`/circles/${c.id}`).catch(() => null);
          if (!det) continue;
          if (det.songs.some((s: any) => s.id === song.id)) {
            setMembers(det.members);
            const evs = await api.get<LiveEvent[]>(`/circles/${c.id}/live-events`).catch(() => []);
            setEvents(evs);
            const suggestions = evs.map((e: any) => {
              if (e.event_date) {
                const m = e.event_date.substring(0, 7); // YYYY-MM
                return { month: m, label: `${m} (${e.name})` };
              }
              return null;
            }).filter(Boolean) as { month: string; label: string }[];
            // Remove duplicates
            const unique = Array.from(new Map(suggestions.map(s => [s.month, s])).values());
            setSuggestedMonths(unique);
            break;
          }
        }
      })
      .catch(() => {});
  }, [song, me]);

  if (error) return <main style={styles.page}><button onClick={goBackToCircle}>戻る</button><p style={styles.error}>{error}</p></main>;
  if (!song || !me) return <main style={styles.page}>読み込み中...</main>;

  const isRequester = song.requested_by_id === me.id;
  const canApply = !isRequester && song.matching_parts.length > 0 && song.status === "recruiting";
  const acceptedEntries = song.entries.filter((entry) => entry.status === "accepted");

  // 既に自分が応募/オファー中の entry
  const myActiveEntry = song.entries.find(
    (e) => e.user_id === me.id && (e.status === "pending" || e.status === "accepted")
  );

  // ----- 各アクション -----
  const submitApplication = async () => {
    if (!applyPart) return;
    setBusy(true);
    try {
      await api.post(`/songs/${songId}/applications`, {
        part: applyPart,
        timing_memo: applyMemo,
      });
      setApplyPart("");
      setApplyMemo("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "応募に失敗");
    } finally { setBusy(false); }
  };

  const submitOffer = async () => {
    if (!offerUserId || !offerPart) return;
    setBusy(true);
    try {
      await api.post(`/songs/${songId}/offers`, {
        user_id: offerUserId,
        part: offerPart,
      });
      setOfferUserId("");
      setOfferPart("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "オファーに失敗");
    } finally { setBusy(false); }
  };

  const updateEntry = async (entryId: string, status: string) => {
    setBusy(true);
    try {
      await api.patch(`/entries/${entryId}`, { status });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally { setBusy(false); }
  };

  const updateSongStatus = async (status: string, targetMonth?: string) => {
    setBusy(true);
    try {
      await api.patch(`/songs/${songId}/status`, { status, planned_month: targetMonth });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "状態更新失敗");
    } finally { setBusy(false); }
  };

  const submitLiveApplication = async () => {
    if (!selectedEventId) return;
    setBusy(true);
    try {
      await api.post(`/songs/${songId}/live-applications`, { live_event_id: selectedEventId });
      setSelectedEventId("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ライブ申請失敗");
    } finally { setBusy(false); }
  };

  const withdrawLiveApplication = async (appId: string) => {
    setBusy(true);
    try {
      await api.post(`/live-applications/${appId}/withdraw`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取り下げ失敗");
    } finally { setBusy(false); }
  };

  return (
    <main style={styles.page}>
      <button onClick={goBackToCircle}>戻る</button>

      {/* 曲ヘッダ */}
      <header style={styles.header}>
        <h1 style={styles.h1}>{song.title}</h1>
        <p style={styles.sub}>{song.artist}</p>
        <p style={styles.meta}>起票者: {song.requested_by}</p>
        <p style={styles.meta}>状態: <span style={styles.statusBadge}>{song.status}</span></p>
        {song.reference_url && (
          <p style={styles.meta}>
            参考音源: <a href={song.reference_url} target="_blank" rel="noreferrer">開く</a>
          </p>
        )}
        {song.timing_preference_memo && <p style={styles.meta}>時期希望: {song.timing_preference_memo}</p>}
        {song.memo && <p style={styles.memo}>{song.memo}</p>}
      </header>

      {/* 募集パート */}
      <section style={styles.section}>
        <h2 style={styles.h2}>募集パート</h2>
        <ul style={styles.list}>
          {song.recruiting_parts.map((p) => (
            <li key={p.part}>
              {p.part}: {p.accepted_count}/{p.required_count}
              {p.accepted_count >= p.required_count && " ✓充足"}
            </li>
          ))}
        </ul>
      </section>

      {(acceptedEntries.length > 0 || song.external_members.length > 0) && (
        <section style={styles.section}>
          <h2 style={styles.h2}>決定済みメンバー</h2>
          <ul style={styles.list}>
            {acceptedEntries.map((entry) => (
              <li key={entry.id}>
                {entry.part}: {entry.user_name}
              </li>
            ))}
            {song.external_members.map((member) => (
              <li key={member.id}>
                {member.part}: {member.member_name} (外部)
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 応募 (ユーザー) */}
      {!isRequester && (
        <section style={styles.section}>
          <h2 style={styles.h2}>このパートに応募する</h2>
          {myActiveEntry ? (
            <div>
              <p>
                あなたは <strong>{myActiveEntry.part}</strong> に
                {entryKindLabel(myActiveEntry, song)}中 (状態: {myActiveEntry.status})
              </p>
              {myActiveEntry.status === "pending" && (
                <>
                  {myActiveEntry.kind === "offer" && (
                    <>
                      <button disabled={busy} onClick={() => updateEntry(myActiveEntry.id, "accepted")}>参加する</button>
                      <button disabled={busy} onClick={() => updateEntry(myActiveEntry.id, "declined")} style={{ marginLeft: 8 }}>辞退</button>
                    </>
                  )}
                  <button disabled={busy} onClick={() => updateEntry(myActiveEntry.id, "withdrawn")} style={{ marginLeft: 8 }}>取り下げ</button>
                </>
              )}
            </div>
          ) : canApply ? (
            <div style={{ display: "grid", gap: 8, maxWidth: 360 }}>
              <select value={applyPart} onChange={(e) => setApplyPart(e.target.value)} style={styles.input}>
                <option value="">パートを選択</option>
                {song.matching_parts.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <textarea
                placeholder="時期希望メモ(任意)"
                value={applyMemo}
                onChange={(e) => setApplyMemo(e.target.value)}
                style={styles.input}
                rows={2}
              />
              <button disabled={busy || !applyPart} onClick={submitApplication}>応募する</button>
            </div>
          ) : (
            <p style={styles.empty}>応募できるパートがありません(担当パート未設定 or 募集終了)</p>
          )}
        </section>
      )}

      {/* 起案者向け: 応募/オファー一覧 + 承認 */}
      {isRequester && (
        <>
          <section style={styles.section}>
            <h2 style={styles.h2}>応募・お誘い一覧</h2>
            {song.entries.length === 0 ? (
              <p style={styles.empty}>まだ応募/お誘いはありません</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>ユーザー</th><th>パート</th><th>種別</th><th>状態</th><th>メモ</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {song.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{e.user_name}</td>
                      <td>{e.part}</td>
                      <td>{entryKindLabel(e, song)}</td>
                      <td>{e.status}</td>
                      <td>{e.timing_memo || ""}</td>
                      <td>
                        {e.status === "pending" && e.kind === "application" && (
                          <>
                            <button disabled={busy} onClick={() => updateEntry(e.id, "accepted")}>承認</button>
                            <button disabled={busy} onClick={() => updateEntry(e.id, "declined")} style={{ marginLeft: 4 }}>拒否</button>
                          </>
                        )}
                        {e.status === "pending" && e.kind === "offer" && (
                          <button disabled={busy} onClick={() => updateEntry(e.id, "withdrawn")}>取り下げ</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* オファー送信 */}
          <section style={styles.section}>
            <h2 style={styles.h2}>メンバーにお誘い(オファー)を送る</h2>
            <div style={{ display: "grid", gap: 8, maxWidth: 480 }}>
              <select value={offerUserId} onChange={(e) => setOfferUserId(e.target.value)} style={styles.input}>
                <option value="">メンバーを選択</option>
                {members.filter(m => m.id !== me.id).map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.parts.join("/") || "未設定"})</option>
                ))}
              </select>
              <select value={offerPart} onChange={(e) => setOfferPart(e.target.value)} style={styles.input}>
                <option value="">パートを選択</option>
                {song.recruiting_parts.map((p) => <option key={p.part} value={p.part}>{p.part}</option>)}
              </select>
              <button disabled={busy || !offerUserId || !offerPart} onClick={submitOffer}>オファーを送る</button>
            </div>
          </section>

          {/* メンバー確定/取り消し */}
          <section style={styles.section}>
            <h2 style={styles.h2}>メンバー確定</h2>
            <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
              <div>
                <label style={{ fontSize: 13, color: "#666" }}>実施予定月 (例: 2026-08)</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <input
                    type="month"
                    value={plannedMonth}
                    onChange={(e) => setPlannedMonth(e.target.value)}
                    style={{ ...styles.input, flex: 1 }}
                  />
                  {suggestedMonths.length > 0 && (
                    <select
                      onChange={(e) => setPlannedMonth(e.target.value)}
                      style={{ ...styles.input, width: "auto" }}
                      value=""
                    >
                      <option value="" disabled>予定から選ぶ</option>
                      {suggestedMonths.map(s => (
                        <option key={s.month} value={s.month}>{s.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {song.status === "recruiting" && (
                <button
                  disabled={busy}
                  onClick={() => updateSongStatus("ready", plannedMonth)}
                  style={{ background: "#2563eb", color: "#fff" }}
                >
                  この予定でメンバー確定する
                </button>
              )}
              {song.status === "ready" && (
                <>
                  <p>このメンバーで確定しています ✓ ({song.planned_month || "実施月未定"})</p>
                  <button
                    disabled={busy}
                    onClick={() => updateSongStatus("ready", plannedMonth)}
                    style={{ background: "#059669", color: "#fff" }}
                  >
                    予定月を更新する
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => updateSongStatus("recruiting")}
                    style={{ background: "#ef4444", color: "#fff", marginTop: 8 }}
                  >
                    メンバー確定を取り消す
                  </button>
                </>
              )}
            </div>
            {song.status === "archived" && <p>アーカイブ済み</p>}
            {song.status === "cancelled" && <p>キャンセル済み</p>}
          </section>

          {/* ライブ申請 */}
          <section style={styles.section}>
            <h2 style={styles.h2}>ライブ申請</h2>
            <h3>申請履歴</h3>
            {liveApps.length === 0 ? (
              <p style={styles.empty}>まだ申請はありません</p>
            ) : (
              <ul style={styles.list}>
                {liveApps.map((a) => {
                  const ev = events.find((e) => e.id === a.live_event_id);
                  return (
                    <li key={a.id}>
                      {ev?.name || a.live_event_id} — 状態: {a.status}
                      {(a.status === "applied" || a.status === "approved") && (
                        <button disabled={busy} onClick={() => withdrawLiveApplication(a.id)} style={{ marginLeft: 8 }}>
                          取り下げ
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <h3>新規申請</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} style={styles.input}>
                <option value="">ライブを選択</option>
                {events.filter(ev => ev.entry_status === "open").map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name} ({ev.event_date || "日付未定"})</option>
                ))}
              </select>
              <button disabled={busy || !selectedEventId} onClick={submitLiveApplication}>申請</button>
            </div>
          </section>
        </>
      )}

      {/* チャット導線 */}
      {song.chat_room_id && (
        <section style={styles.section}>
          <h2 style={styles.h2}>チャット</h2>
          <button onClick={() => navigate(`/songs/${songId}/chat`)}>チャット画面を開く</button>
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(900px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  header: { marginTop: 16, borderBottom: "1px solid #e5e7eb", paddingBottom: 16 },
  h1: { margin: "0 0 4px", fontSize: 26 },
  h2: { fontSize: 18, marginTop: 0, marginBottom: 12 },
  sub: { margin: "0 0 12px", color: "#4b5563" },
  meta: { margin: "4px 0", color: "#374151", fontSize: 14 },
  memo: { margin: "12px 0 0", color: "#111827" },
  section: { marginTop: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" },
  list: { paddingLeft: 18, margin: 0 },
  table: { width: "100%", borderCollapse: "collapse" },
  input: { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14 },
  empty: { color: "#6b7280" },
  error: { color: "#dc2626" },
  statusBadge: { display: "inline-block", border: "1px solid #bfdbfe", borderRadius: 999, padding: "2px 8px", color: "#1d4ed8", fontSize: 12 },
};
