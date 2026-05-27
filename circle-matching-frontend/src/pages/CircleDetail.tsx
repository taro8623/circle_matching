const PART_OPTIONS = ["Vo", "Gt", "Ba", "Dr", "Key", "Cho", "Other"];
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import NotificationButton from "../components/NotificationButton";

type RecruitingPart = {
  part: string;
  required_count: number;
  accepted_count: number;
};

type EntryItem = {
  id: string;
  user_id: string;
  user_name: string;
  part: string;
  kind: string;
  status: string;
};

type CircleSong = {
  id: string;
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
  entries: EntryItem[];
  chat_room_id?: string | null;
  planned_month?: string | null;
  latest_live_event_name?: string | null;
  latest_live_event_date?: string | null;
  latest_live_application_status?: string | null;
};

type CircleSongsForMe = {
  circle_id: string;
  circle_name: string;
  current_user_id: string;
  current_user_permissions: string[];
  current_user_parts: string[];
  own_songs: CircleSong[];
  applicable_songs: CircleSong[];
  applied_songs: CircleSong[];
  offered_songs: CircleSong[];
  joined_songs: CircleSong[];
  all_recruiting_songs: CircleSong[];
  matching_recruiting_songs?: CircleSong[];
};

function getStatusBadges(song: CircleSong) {
  const badges = [];
  if (song.status === "ready") {
    badges.push({ label: "メンバー確定", color: "#2563eb", bg: "#eff6ff", border: "#3b82f6" });
  } else if (song.status === "recruiting") {
    badges.push({ label: "募集中", color: "#4b5563", bg: "#f3f4f6", border: "#9ca3af" });
  }
  if (song.planned_month) {
    badges.push({ label: `予定: ${song.planned_month}`, color: "#7c3aed", bg: "#f5f3ff", border: "#8b5cf6" });
  } else if (song.status === "ready") {
    badges.push({ label: "予定月未定", color: "#6b7280", bg: "#f9fafb", border: "#d1d5db" });
  }
  if (song.latest_live_application_status === "approved") {
    badges.push({ label: `出演確定: ${song.latest_live_event_name}`, color: "#059669", bg: "#ecfdf5", border: "#10b981" });
  } else if (song.latest_live_application_status === "applied") {
    badges.push({ label: `申請中: ${song.latest_live_event_name}`, color: "#d97706", bg: "#fffbeb", border: "#f59e0b" });
  }
  return badges;
}

function SongCard({ song, onClick, style }: { song: CircleSong; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <article style={{ ...styles.songCard, ...style }} onClick={onClick}>
      <div style={styles.songHeader}>
        <div>
          <h3 style={styles.songTitle}>{song.title}</h3>
          <p style={styles.artist}>{song.artist}</p>
        </div>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {getStatusBadges(song).map((badge, idx) => (
          <span key={idx} style={{
            ...styles.status,
            color: badge.color,
            background: badge.bg,
            borderColor: badge.border,
            padding: "2px 10px",
            fontWeight: "bold"
          }}>
            {badge.label}
          </span>
        ))}
      </div>
      <p style={styles.meta}>起票者: {song.requested_by}</p>
      {song.reference_url && (
        <p style={styles.meta}>
          参考音源: <a href={song.reference_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>開く</a>
        </p>
      )}
      {song.timing_preference_memo && <p style={styles.meta}>時期希望: {song.timing_preference_memo}</p>}
      {song.matching_parts.length > 0 && <p style={styles.meta}>あなたが応募できるパート: {song.matching_parts.join(", ")}</p>}
      {song.recruiting_parts.length > 0 && (
        <ul style={styles.partList}>
          {song.recruiting_parts.map((p) => (
            <li key={p.part}>
              {p.part}: {p.accepted_count}/{p.required_count}
              {p.accepted_count >= p.required_count && " ✓"}
            </li>
          ))}
        </ul>
      )}
      {song.memo && <p style={styles.memo}>{song.memo}</p>}
    </article>
  );
}

// --- スワイプ体験を提供するディスカバリーコンポーネント ---
function SongDiscovery({ songs, onApply }: { songs: CircleSong[]; onApply: (id: string) => void }) {
  const [index, setIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  
  const currentSong = songs[index];

  const handlePass = () => {
    setExitDirection("left");
    setTimeout(() => {
      setIndex((i) => (i + 1) % songs.length);
      setExitDirection(null);
    }, 300);
  };

  const handleLike = () => {
    setExitDirection("right");
    setTimeout(() => {
      onApply(currentSong.id);
      setExitDirection(null);
    }, 300);
  };

  if (songs.length === 0) return <p style={styles.empty}>現在応募できる曲はありません。</p>;

  // アニメーション用のスタイル
  const animationStyle: React.CSSProperties = exitDirection === "left" 
    ? { transform: "translateX(-150%) rotate(-20deg)", opacity: 0, transition: "0.3s" }
    : exitDirection === "right"
    ? { transform: "translateX(150%) rotate(20deg)", opacity: 0, transition: "0.3s" }
    : { transition: "0.3s" };

  return (
    <div style={styles.discoveryContainer}>
      <div style={styles.cardStack}>
        {/* 背景のダミーカード (重なり感を出す) */}
        {songs.length > 1 && (
           <div style={{ ...styles.songCard, position: "absolute", top: 8, left: 4, right: -4, zIndex: 0, opacity: 0.5, pointerEvents: "none" }} />
        )}
        <SongCard 
          song={currentSong} 
          onClick={() => {}} 
          style={{ ...animationStyle, zIndex: 1, position: "relative", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }} 
        />
      </div>

      <div style={styles.actionRow}>
        <button onClick={handlePass} style={styles.passButton}>
          ✕ 興味なし
        </button>
        <button onClick={handleLike} style={styles.likeButton}>
          ♥ 応募する！
        </button>
      </div>
      <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 12 }}>
        {index + 1} / {songs.length} 曲目
      </p>
    </div>
  );
}

function SongList({ songs, emptyText, onSongClick }: {
  songs: CircleSong[];
  emptyText: string;
  onSongClick: (songId: string) => void;
}) {
  if (songs.length === 0) return <p style={styles.empty}>{emptyText}</p>;
  return (
    <div style={styles.songGrid}>
      {songs.map((song) => (
        <SongCard key={song.id} song={song} onClick={() => onSongClick(song.id)} />
      ))}
    </div>
  );
}

export default function CircleDetail() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CircleSongsForMe | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [recruitFilter, setRecruitFilter] = useState("");

  useEffect(() => {
    if (!circleId) return;
    api.get<CircleSongsForMe>(`/circles/${circleId}/songs/for-me`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [circleId]);

  if (loading) return <div style={styles.page}>読み込み中...</div>;
  if (error) return <div style={styles.page}><button onClick={() => navigate("/me")}>戻る</button><p style={styles.error}>{error}</p></div>;
  if (!data) return null;

  const acceptedSongs = data.joined_songs;
  const pendingSongs = [...data.applied_songs, ...data.offered_songs];
  const openSongs = data.all_recruiting_songs
    .filter(song => {
      if (song.requested_by_id === data.current_user_id) return false;
      if (data.joined_songs.some(js => js.id === song.id)) return false;
      const myEntry = song.entries.find(e => e.user_id === data.current_user_id);
      if (myEntry && (myEntry.status === "declined" || myEntry.status === "withdrawn")) return false;
      if (recruitFilter) {
        return song.recruiting_parts.some(rp => rp.part === recruitFilter && rp.accepted_count < rp.required_count);
      }
      return true;
    })
    .sort((a, b) => {
      const aHasUpcomingLive =
        (a.latest_live_application_status === "applied" || a.latest_live_application_status === "approved") &&
        !!a.latest_live_event_date;
      const bHasUpcomingLive =
        (b.latest_live_application_status === "applied" || b.latest_live_application_status === "approved") &&
        !!b.latest_live_event_date;

      if (aHasUpcomingLive !== bHasUpcomingLive) {
        return aHasUpcomingLive ? -1 : 1;
      }

      if (aHasUpcomingLive && bHasUpcomingLive) {
        const dateDiff =
          new Date(a.latest_live_event_date as string).getTime() -
          new Date(b.latest_live_event_date as string).getTime();
        if (dateDiff !== 0) return dateDiff;
      }

      const aHasPlannedMonth = !!a.planned_month;
      const bHasPlannedMonth = !!b.planned_month;
      if (aHasPlannedMonth !== bHasPlannedMonth) {
        return aHasPlannedMonth ? -1 : 1;
      }

      if (a.planned_month && b.planned_month && a.planned_month !== b.planned_month) {
        return a.planned_month.localeCompare(b.planned_month);
      }

      return a.title.localeCompare(b.title, "ja");
    });

  return (
    <main style={styles.page}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button onClick={() => navigate("/home")}>戻る</button>
        <NotificationButton />
      </div>
      <div style={styles.titleRow}>
        <div>
          <h2 style={styles.title}>{data.circle_name}</h2>
          <p style={styles.parts}>
            自分の担当パート: {data.current_user_parts.length > 0 ? data.current_user_parts.join(", ") : "未設定"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate(`/circles/${circleId}/live-events`)}>ライブ一覧</button>
          <button onClick={() => navigate(`/circles/${circleId}/bi`)}>BI</button>
          <button onClick={() => navigate(`/circles/${circleId}/request-management`)}>応募・依頼管理</button>
          <button onClick={() => navigate(`/circles/${circleId}/chats`)}>チャット</button>
          <button onClick={() => navigate(`/circles/${circleId}/participation-plans`)}>参加予定</button>
          <button onClick={() => navigate(`/circles/${circleId}/participation-history`)}>参加履歴</button>
          <button onClick={() => navigate(`/circles/${circleId}/members`)}>メンバー</button>
          <button onClick={() => navigate(`/circles/${circleId}/permission-settings`)}>権限付与設定</button>
          {data.current_user_permissions.includes("view_admin_action_logs") && (
            <button onClick={() => navigate(`/circles/${circleId}/admin-action-logs`)}>管理者操作ログ</button>
          )}
          <button onClick={() => navigate(`/circles/${circleId}/songs/new`)}>曲を起票</button>
        </div>
      </div>

      <section style={styles.section}>
        <h2 style={{ ...styles.sectionTitle, color: "#059669" }}>【参加決定（Accepted）】</h2>
        <p style={styles.sectionHint}>あなたの参加が確定した曲です。練習を始めましょう！</p>
        <SongList songs={acceptedSongs} emptyText="参加が決定した曲はありません。" onSongClick={(id) => navigate(`/songs/${id}`)} />
      </section>

      <section style={{ ...styles.section, background: "#f0f9ff", border: "2px solid #bae6fd" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ ...styles.sectionTitle, color: "#0369a1", margin: 0 }}>【ディスカバリー（募集中）】</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, color: "#666" }}>パートで絞り込む:</label>
            <select value={recruitFilter} onChange={(e) => setRecruitFilter(e.target.value)} style={{ ...styles.input, padding: "4px 8px" }}>
              <option value="">すべて</option>
              {PART_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <p style={styles.sectionHint}>
          気になる曲をスワイプ！♥で詳細を確認できます。
        </p>
        
        <SongDiscovery songs={openSongs} onApply={(id) => navigate(`/songs/${id}`)} />
      </section>

      <section style={styles.section}>
        <h2 style={{ ...styles.sectionTitle, color: "#d97706" }}>【応募中（Pending）】</h2>
        <p style={styles.sectionHint}>回答待ち、または承認待ちの曲です。</p>
        <SongList songs={pendingSongs} emptyText="現在、回答待ちの応募はありません。" onSongClick={(id) => navigate(`/songs/${id}`)} />
      </section>

      {data.own_songs.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>自分が起票した曲</h2>
          <SongList songs={data.own_songs} emptyText="" onSongClick={(id) => navigate(`/songs/${id}`)} />
        </section>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(960px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  title: { margin: "0 0 6px", fontSize: 28 },
  titleRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginTop: 20 },
  parts: { margin: "0 0 24px", color: "#4b5563" },
  section: { marginTop: 32, padding: "20px", background: "#f9fafb", borderRadius: 16, border: "1px solid #e5e7eb" },
  sectionTitle: { fontSize: 20, marginBottom: 6 },
  sectionHint: { fontSize: 13, color: "#6b7280", margin: "0 0 16px" },
  songGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 },
  songCard: { border: "1px solid #d1d5db", borderRadius: 12, padding: 20, background: "#ffffff", cursor: "pointer", overflow: "hidden" },
  songHeader: { display: "flex", justifyContent: "space-between", gap: 12 },
  songTitle: { margin: 0, fontSize: 20, color: "#111827" },
  artist: { margin: "4px 0 0", color: "#4b5563", fontSize: 16 },
  status: { height: "fit-content", border: "1px solid #bfdbfe", borderRadius: 999, padding: "2px 8px", color: "#1d4ed8", fontSize: 12 },
  meta: { margin: "10px 0 0", color: "#374151", fontSize: 14 },
  memo: { margin: "12px 0 0", color: "#111827", lineHeight: 1.5 },
  empty: { color: "#6b7280", textAlign: "center", padding: "20px 0" },
  error: { color: "#dc2626" },
  partList: { margin: "12px 0 0", paddingLeft: 18, color: "#374151", fontSize: 14 },
  discoveryContainer: { maxWidth: 500, margin: "0 auto", position: "relative" },
  cardStack: { position: "relative", minHeight: 300 },
  actionRow: { display: "flex", justifyContent: "center", gap: 20, marginTop: 24 },
  passButton: { 
    width: 140, padding: "12px", borderRadius: 999, border: "2px solid #d1d5db", 
    background: "#fff", color: "#6b7280", fontWeight: "bold", cursor: "pointer" 
  },
  likeButton: { 
    width: 140, padding: "12px", borderRadius: 999, border: "2px solid #2563eb", 
    background: "#2563eb", color: "#fff", fontWeight: "bold", cursor: "pointer" 
  },
};
