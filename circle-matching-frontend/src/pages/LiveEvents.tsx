import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import NotificationButton from "../components/NotificationButton";

type LiveEvent = {
  id: string;
  name: string;
  event_date?: string | null;
  entry_status: string;
  created_by: string;
  songs: LiveEventSong[];
};

type LiveEventSong = {
  song_id: string;
  title: string;
  artist: string;
  song_status: string;
  live_application_status: string;
  recruiting_labels: string[];
};

const STATUS_OPTIONS = [
  { value: "want_invites", label: "誘ってほしい" },
  { value: "available", label: "出演予定あり" },
  { value: "unavailable", label: "今月は出演予定なし" },
];

export default function LiveEvents() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // 作成フォーム
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");

  // 各イベントのユーザーステータス保持
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState("");

  const reload = async () => {
    if (!circleId) return;
    try {
      const evs = await api.get<LiveEvent[]>(`/circles/${circleId}/live-events`);
      setEvents(evs);
      // Fetch role
      const forMe = await api.get<any>(`/circles/${circleId}/songs/for-me`).catch(() => null);
      if (forMe) setUserRole(forMe.current_user_role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得失敗");
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [circleId]);

  const createEvent = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post(`/circles/${circleId}/live-events`, {
        name: name.trim(),
        event_date: eventDate || undefined,
        entry_status: "open",
      });
      setName(""); setEventDate("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成失敗");
    } finally { setBusy(false); }
  };

  const toggleEntryStatus = async (event: LiveEvent) => {
    setBusy(true);
    try {
      await api.patch(`/live-events/${event.id}`, {
        entry_status: event.entry_status === "open" ? "closed" : "open",
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally { setBusy(false); }
  };

  const setMyStatus = async (eventId: string, status: string) => {
    setBusy(true);
    try {
      await api.put(`/me/live-events/${eventId}/status`, { status });
      setStatuses((cur) => ({ ...cur, [eventId]: status }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally { setBusy(false); }
  };

  const isAdmin = userRole === "owner" || userRole === "admin";

  return (
    <main style={styles.page}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
        <NotificationButton />
      </div>
      <h1 style={styles.h1}>定期ライブ一覧</h1>
      {error && <p style={styles.error}>{error}</p>}

      {isAdmin && (
        <section style={styles.section}>
          <h2 style={styles.h2}>新しいライブを作成 (主催者のみ)</h2>
          <div style={{ display: "grid", gap: 8, maxWidth: 480 }}>
            <input
              placeholder="ライブ名 (例: 2026年8月 定例夏ライブ)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
            />
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={styles.input} />
            <button disabled={busy || !name.trim()} onClick={createEvent}>作成</button>
          </div>
        </section>
      )}

      <section style={styles.section}>
        <h2 style={styles.h2}>ライブ一覧</h2>
        {events.length === 0 ? (
          <p style={styles.empty}>まだライブはありません</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {events.map((ev) => (
              <div key={ev.id} style={styles.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{ev.name}</h3>
                    <p style={styles.meta}>日付: {ev.event_date || "未定"} / 受付: {ev.entry_status}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => toggleEntryStatus(ev)} disabled={busy}>
                      {ev.entry_status === "open" ? "受付を閉じる" : "受付を開く"}
                    </button>
                  )}
                </div>
                <div style={{ marginTop: 10 }}>
                  <p style={styles.meta}>あなたの参加意思:</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setMyStatus(ev.id, opt.value)}
                        disabled={busy}
                        style={{
                          background: statuses[ev.id] === opt.value ? "#dbeafe" : "#fff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          padding: "4px 8px",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <p style={styles.meta}>このライブに申請中の曲:</p>
                  {ev.songs.length === 0 ? (
                    <p style={styles.empty}>まだ申請中の曲はありません</p>
                  ) : (
                    <div style={styles.songList}>
                      {ev.songs.map((song) => (
                        <button
                          key={song.song_id}
                          type="button"
                          onClick={() => navigate(`/songs/${song.song_id}`)}
                          style={styles.songCard}
                        >
                          <div style={styles.songHeader}>
                            <div>
                              <strong>{song.title}</strong>
                              <div style={styles.meta}>{song.artist}</div>
                            </div>
                            <span style={styles.statusChip}>
                              {song.live_application_status === "approved" ? "承認済み" : "申請中"}
                            </span>
                          </div>
                          {song.recruiting_labels.length > 0 ? (
                            <div style={styles.labelRow}>
                              {song.recruiting_labels.map((label) => (
                                <span key={label} style={styles.recruitingChip}>{label}</span>
                              ))}
                            </div>
                          ) : (
                            <div style={styles.meta}>募集中のパートはありません</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(900px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  h1: { margin: "16px 0" },
  h2: { fontSize: 18, marginTop: 0, marginBottom: 12 },
  section: { marginTop: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff" },
  card: { padding: 16, border: "1px solid #d1d5db", borderRadius: 8 },
  songList: { display: "grid", gap: 8, marginTop: 8 },
  songCard: {
    textAlign: "left",
    padding: 12,
    border: "1px solid #dbeafe",
    borderRadius: 8,
    background: "#f8fbff",
    cursor: "pointer",
  },
  songHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  statusChip: {
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "2px 8px",
    color: "#1d4ed8",
    fontSize: 12,
    background: "#eff6ff",
  },
  labelRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 },
  recruitingChip: {
    border: "1px solid #fecaca",
    borderRadius: 999,
    padding: "2px 8px",
    color: "#b91c1c",
    fontSize: 12,
    background: "#fef2f2",
  },
  input: { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14 },
  meta: { margin: "4px 0", color: "#374151", fontSize: 14 },
  empty: { color: "#6b7280" },
  error: { color: "#dc2626" },
};
