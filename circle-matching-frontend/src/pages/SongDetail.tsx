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
type LiveEvent = {
  id: string;
  name: string;
  entry_status: string;
  lifecycle_status: string;
  event_date?: string | null;
};
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
      const apps = await api.get<LiveApplication[]>(`/songs/${songId}/live-applications`).catch(() => []);
      setLiveApps(apps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
  };

  useEffect(() => {
    reload();
  }, [songId]);

  useEffect(() => {
    if (!song || !me) return;
    if (song.requested_by_id !== me.id) return;
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
            const unique = Array.from(new Map(suggestions.map(s => [s.month, s])).values());
            setSuggestedMonths(unique);
            break;
          }
        }
      })
      .catch(() => {});
  }, [song, me]);

  if (error) return (
    <main className="container">
      <button className="btn-outline" onClick={goBackToCircle}>戻る</button>
      <p className="text-error mt-md">{error}</p>
    </main>
  );
  if (!song || !me) return <main className="container">読み込み中...</main>;

  const isRequester = song.requested_by_id === me.id;
  const canApply = !isRequester && song.matching_parts.length > 0 && song.status === "recruiting";
  const acceptedEntries = song.entries.filter((entry) => entry.status === "accepted");

  const myActiveEntry = song.entries.find(
    (e) => e.user_id === me.id && (e.status === "pending" || e.status === "accepted")
  );

  const submitApplication = async () => {
    if (!applyPart) return;
    setBusy(true);
    try {
      await api.post(`/songs/${songId}/applications`, { part: applyPart, timing_memo: applyMemo });
      setApplyPart(""); setApplyMemo(""); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "応募に失敗");
    } finally { setBusy(false); }
  };

  const submitOffer = async () => {
    if (!offerUserId || !offerPart) return;
    setBusy(true);
    try {
      await api.post(`/songs/${songId}/offers`, { user_id: offerUserId, part: offerPart });
      setOfferUserId(""); setOfferPart(""); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "オファーに失敗");
    } finally { setBusy(false); }
  };

  const updateEntry = async (entryId: string, status: string) => {
    setBusy(true);
    try { await api.patch(`/entries/${entryId}`, { status }); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "更新失敗");
    } finally { setBusy(false); }
  };

  const updateSongStatus = async (status: string, targetMonth?: string) => {
    setBusy(true);
    try { await api.patch(`/songs/${songId}/status`, { status, planned_month: targetMonth }); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "状態更新失敗");
    } finally { setBusy(false); }
  };

  const submitLiveApplication = async () => {
    if (!selectedEventId) return;
    setBusy(true);
    try { await api.post(`/songs/${songId}/live-applications`, { live_event_id: selectedEventId }); setSelectedEventId(""); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "ライブ申請失敗");
    } finally { setBusy(false); }
  };

  const withdrawLiveApplication = async (appId: string) => {
    setBusy(true);
    try { await api.post(`/live-applications/${appId}/withdraw`); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "取り下げ失敗");
    } finally { setBusy(false); }
  };

  return (
    <main className="container">
      <button className="btn-ghost" onClick={goBackToCircle}>← 戻る</button>

      {/* 曲ヘッダ */}
      <header className="card mt-lg" style={{ borderLeft: "8px solid var(--color-primary)" }}>
        <div className="flex-row justify-between">
          <div>
            <h1 className="h1">{song.title}</h1>
            <p className="text-subtle mt-sm" style={{ fontSize: "1.2rem" }}>{song.artist}</p>
          </div>
          <span className={`badge ${song.status === "ready" ? "badge-primary" : "badge-outline"}`}>
            {song.status === "ready" ? "✅ メンバー確定" : "🔍 募集中"}
          </span>
        </div>
        <div className="mt-md flex-row" style={{ flexWrap: "wrap", gap: "12px" }}>
          <p className="text-subtle">👤 起票: {song.requested_by}</p>
          {song.reference_url && (
            <a href={song.reference_url} target="_blank" rel="noreferrer" className="btn-outline btn-pill" style={{ padding: "4px 12px", fontSize: "0.8rem" }}>
              🔗 参考音源
            </a>
          )}
          {song.chat_room_id && (
            <button onClick={() => navigate(`/songs/${songId}/chat`)} className="btn-primary btn-pill" style={{ padding: "4px 12px", fontSize: "0.8rem" }}>
              💬 チャット
            </button>
          )}
        </div>
        {song.timing_preference_memo && <p className="text-subtle mt-sm">📅 時期希望: {song.timing_preference_memo}</p>}
        {song.memo && <p className="mt-md card" style={{ backgroundColor: "var(--color-bg)", fontSize: "0.9rem" }}>{song.memo}</p>}
      </header>

      <div className="grid-list mt-xl" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {/* 募集パート */}
        <section className="card">
          <h2 className="h3">📢 募集状況</h2>
          <ul className="mt-md" style={{ paddingLeft: "18px", color: "var(--color-text)" }}>
            {song.recruiting_parts.map((p) => (
              <li key={p.part} style={{ marginBottom: "8px" }}>
                <strong>{p.part}</strong>: {p.accepted_count}/{p.required_count}
                {p.accepted_count >= p.required_count && <span style={{ color: "var(--color-success)" }}> ✓充足</span>}
              </li>
            ))}
          </ul>
        </section>

        {/* 決定メンバー */}
        {(acceptedEntries.length > 0 || song.external_members.length > 0) && (
          <section className="card">
            <h2 className="h3">👥 メンバー</h2>
            <ul className="mt-md" style={{ paddingLeft: "18px", color: "var(--color-text)" }}>
              {acceptedEntries.map((entry) => (
                <li key={entry.id} style={{ marginBottom: "8px" }}>
                  <strong>{entry.part}</strong>: {entry.user_name}
                </li>
              ))}
              {song.external_members.map((member) => (
                <li key={member.id} style={{ marginBottom: "8px" }}>
                  <strong>{member.part}</strong>: {member.member_name} (外部)
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* 応募セクション */}
      {!isRequester && (
        <section className="card mt-xl" style={{ backgroundColor: "var(--color-primary-soft)" }}>
          <h2 className="h3">🤝 参加する</h2>
          <div className="mt-md">
            {myActiveEntry ? (
              <div className="flex-col">
                <p>
                  あなたは <strong>{myActiveEntry.part}</strong> に
                  {entryKindLabel(myActiveEntry, song)}中です（状態: {myActiveEntry.status}）
                </p>
                <div className="flex-row">
                  {myActiveEntry.status === "pending" && myActiveEntry.kind === "offer" && (
                    <button disabled={busy} onClick={() => updateEntry(myActiveEntry.id, "accepted")} className="btn-primary">参加を承諾</button>
                  )}
                  {myActiveEntry.status === "pending" && (
                    <button disabled={busy} onClick={() => updateEntry(myActiveEntry.id, "withdrawn")} className="btn-outline">取り消し</button>
                  )}
                </div>
              </div>
            ) : canApply ? (
              <div className="flex-col">
                <select value={applyPart} onChange={(e) => setApplyPart(e.target.value)}>
                  <option value="">応募するパートを選択</option>
                  {song.matching_parts.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <textarea
                  placeholder="時期希望や意気込みなど（任意）"
                  value={applyMemo}
                  onChange={(e) => setApplyMemo(e.target.value)}
                  rows={2}
                />
                <button disabled={busy || !applyPart} onClick={submitApplication} className="btn-primary">応募する！</button>
              </div>
            ) : (
              <p className="text-subtle">応募できるパートがありません（募集終了またはパート未設定）</p>
            )}
          </div>
        </section>
      )}

      {/* 起案者向け管理パネル */}
      {isRequester && (
        <div className="mt-xl" style={{ borderTop: "2px dashed var(--color-border)", paddingTop: "32px" }}>
          <h2 className="h2">🛠️ 管理メニュー</h2>
          
          {/* エントリー管理 */}
          <section className="card mt-lg">
            <h3 className="h3">📋 応募・お誘い一覧</h3>
            <div className="mt-md" style={{ overflowX: "auto" }}>
              {song.entries.length === 0 ? (
                <p className="text-subtle">まだ応募はありません</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead style={{ borderBottom: "2px solid var(--color-border)" }}>
                    <tr style={{ textAlign: "left" }}>
                      <th style={{ padding: "8px" }}>名前</th>
                      <th style={{ padding: "8px" }}>パート</th>
                      <th style={{ padding: "8px" }}>状態</th>
                      <th style={{ padding: "8px" }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {song.entries.map((e) => (
                      <tr key={e.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "8px" }}>{e.user_name}</td>
                        <td style={{ padding: "8px" }}>{e.part}</td>
                        <td style={{ padding: "8px" }}><span className="badge">{e.status}</span></td>
                        <td style={{ padding: "8px" }}>
                          {e.status === "pending" && e.kind === "application" && (
                            <div className="flex-row">
                              <button disabled={busy} onClick={() => updateEntry(e.id, "accepted")} className="btn-primary" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>承認</button>
                              <button disabled={busy} onClick={() => updateEntry(e.id, "declined")} className="btn-danger" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>見送り</button>
                            </div>
                          )}
                          {e.status === "pending" && e.kind === "offer" && (
                            <button disabled={busy} onClick={() => updateEntry(e.id, "withdrawn")} className="btn-outline" style={{ padding: "4px 8px", fontSize: "0.75rem" }}>取り下げ</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="mt-lg" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
              <h4 className="h4" style={{ fontSize: "0.9rem" }}>👉 メンバーを誘う</h4>
              <div className="flex-row mt-sm" style={{ flexWrap: "wrap" }}>
                <select value={offerUserId} onChange={(e) => setOfferUserId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">メンバーを選択</option>
                  {members.filter(m => m.id !== me.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <select value={offerPart} onChange={(e) => setOfferPart(e.target.value)} style={{ width: "120px" }}>
                  <option value="">パート</option>
                  {song.recruiting_parts.map((p) => <option key={p.part} value={p.part}>{p.part}</option>)}
                </select>
                <button disabled={busy || !offerUserId || !offerPart} onClick={submitOffer} className="btn-outline">お誘いを送る</button>
              </div>
            </div>
          </section>

          {/* ステータス管理 */}
          <section className="card mt-lg">
            <h3 className="h3">🏁 メンバー確定</h3>
            <div className="flex-col mt-md">
              <div className="flex-row">
                <input
                  type="month"
                  value={plannedMonth}
                  onChange={(e) => setPlannedMonth(e.target.value)}
                  style={{ flex: 1 }}
                />
                {suggestedMonths.length > 0 && (
                  <select onChange={(e) => setPlannedMonth(e.target.value)} value="">
                    <option value="" disabled>予定から選ぶ</option>
                    {suggestedMonths.map(s => <option key={s.month} value={s.month}>{s.label}</option>)}
                  </select>
                )}
              </div>
              <button
                disabled={busy}
                onClick={() => updateSongStatus(song.status === "ready" ? "recruiting" : "ready", plannedMonth)}
                className={song.status === "ready" ? "btn-outline" : "btn-primary"}
              >
                {song.status === "ready" ? "メンバー確定を取り消す" : "この予定でメンバーを確定する"}
              </button>
            </div>
          </section>

          {/* ライブ申請 */}
          <section className="card mt-lg">
            <h3 className="h3">🎸 ライブ出演申請</h3>
            <div className="mt-md">
              {liveApps.map((a) => (
                <div key={a.id} className="flex-row justify-between card mt-sm" style={{ padding: "8px 12px" }}>
                  <span>{events.find(e => e.id === a.live_event_id)?.name || "イベント"}</span>
                  <div className="flex-row">
                    <span className="badge badge-primary">{a.status}</span>
                    <button disabled={busy} onClick={() => withdrawLiveApplication(a.id)} className="btn-ghost" style={{ fontSize: "0.75rem" }}>取消</button>
                  </div>
                </div>
              ))}
              <div className="flex-row mt-md">
                <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">申請するライブを選択</option>
                  {events.filter(ev => ev.entry_status === "open").map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
                <button disabled={busy || !selectedEventId} onClick={submitLiveApplication} className="btn-primary">申請する</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
