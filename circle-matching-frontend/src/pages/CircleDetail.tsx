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

function SongCard({ song, onClick, className = "" }: { song: CircleSong; onClick: () => void; className?: string }) {
  return (
    <article className={`card card-interactive ${className}`} onClick={onClick}>
      <div className="flex-row justify-between">
        <div>
          <h3 className="h3">{song.title}</h3>
          <p className="text-subtle">{song.artist}</p>
        </div>
      </div>
      <div className="flex-row mt-sm" style={{ flexWrap: "wrap", gap: "6px" }}>
        {getStatusBadges(song).map((badge, idx) => (
          <span key={idx} className="badge" style={{
            color: badge.color,
            background: badge.bg,
            border: `1px solid ${badge.border}`,
          }}>
            {badge.label}
          </span>
        ))}
      </div>
      <div className="mt-md">
        <p className="text-subtle" style={{ fontSize: "0.8rem" }}>👤 起票: {song.requested_by}</p>
        {song.planned_month && <p className="text-subtle" style={{ fontSize: "0.8rem" }}>📅 予定: {song.planned_month}</p>}
        {song.matching_parts.length > 0 && (
          <p className="text-subtle mt-sm" style={{ color: "var(--color-primary)", fontWeight: "bold", fontSize: "0.8rem" }}>
            🎸 あなたの募集枠あり！
          </p>
        )}
      </div>
      {song.recruiting_parts.length > 0 && (
        <div className="mt-md" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "12px" }}>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem", color: "var(--color-text-subtle)" }}>
            {song.recruiting_parts.map((p) => (
              <li key={p.part}>
                {p.part}: {p.accepted_count}/{p.required_count}
                {p.accepted_count >= p.required_count ? " ✅" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
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

  if (songs.length === 0) return <p className="text-subtle" style={{ textAlign: "center" }}>現在応募できる曲はありません。</p>;

  const animationStyle: React.CSSProperties = exitDirection === "left" 
    ? { transform: "translateX(-150%) rotate(-20deg)", opacity: 0, transition: "0.3s" }
    : exitDirection === "right"
    ? { transform: "translateX(150%) rotate(20deg)", opacity: 0, transition: "0.3s" }
    : { transition: "0.3s" };

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", position: "relative" }}>
      <div style={{ position: "relative", minHeight: 280 }}>
        {songs.length > 1 && (
           <div className="card" style={{ position: "absolute", top: 8, left: 4, right: -4, zIndex: 0, opacity: 0.5, pointerEvents: "none" }} />
        )}
        <SongCard 
          song={currentSong} 
          onClick={() => {}} 
          className="relative z-1"
          style={animationStyle} 
        />
      </div>

      <div className="flex-row mt-lg" style={{ justifyContent: "center", gap: "16px" }}>
        <button onClick={handlePass} className="btn-outline btn-pill" style={{ width: "120px" }}>
          ✕ 次へ
        </button>
        <button onClick={handleLike} className="btn-primary btn-pill" style={{ width: "120px" }}>
          ♥ 詳しく！
        </button>
      </div>
      <p className="text-subtle mt-md" style={{ textAlign: "center", fontSize: "0.75rem" }}>
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
  if (songs.length === 0) return <p className="text-subtle">{emptyText}</p>;
  return (
    <div className="grid-list">
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

  if (loading) return <div className="container">読み込み中...</div>;
  if (error) return (
    <div className="container">
      <button className="btn-outline" onClick={() => navigate("/home")}>戻る</button>
      <p className="text-error mt-md">{error}</p>
    </div>
  );
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
    <main className="container">
      <div className="flex-row justify-between">
        <button className="btn-ghost" onClick={() => navigate("/home")}>← ホームへ戻る</button>
        <NotificationButton />
      </div>

      <div className="mt-lg">
        <h1 className="h1">{data.circle_name} 🎸</h1>
        <p className="text-subtle mt-sm">
          あなたの担当パート: <strong>{data.current_user_parts.length > 0 ? data.current_user_parts.join(", ") : "未設定"}</strong>
        </p>
      </div>

      <div className="mt-lg" style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderBottom: "1px solid var(--color-border)", paddingBottom: "24px" }}>
        <button className="btn-outline btn-pill" onClick={() => navigate(`/circles/${circleId}/songs/new`)}>✨ 曲を起票</button>
        <button className="btn-outline btn-pill" onClick={() => navigate(`/circles/${circleId}/chats`)}>💬 チャット</button>
        <button className="btn-outline btn-pill" onClick={() => navigate(`/circles/${circleId}/live-events`)}>📅 ライブ</button>
        <button className="btn-outline btn-pill" onClick={() => navigate(`/circles/${circleId}/members`)}>👥 メンバー</button>
        <div style={{ flexBasis: "100%", height: 0 }} /> {/* 改行用 */}
        <button className="btn-ghost btn-pill" style={{ fontSize: "0.8rem" }} onClick={() => navigate(`/circles/${circleId}/request-management`)}>応募管理</button>
        <button className="btn-ghost btn-pill" style={{ fontSize: "0.8rem" }} onClick={() => navigate(`/circles/${circleId}/bi`)}>統計</button>
        <button className="btn-ghost btn-pill" style={{ fontSize: "0.8rem" }} onClick={() => navigate(`/circles/${circleId}/permission-settings`)}>設定</button>
      </div>

      <section className="mt-xl">
        <h2 className="h2" style={{ color: "var(--color-success)" }}>✅ 参加決定</h2>
        <p className="text-subtle mt-sm">練習を始めましょう！</p>
        <div className="mt-md">
          <SongList songs={acceptedSongs} emptyText="参加決定した曲はありません。" onSongClick={(id) => navigate(`/songs/${id}`)} />
        </div>
      </section>

      <section className="card mt-xl" style={{ backgroundColor: "var(--color-primary-soft)", borderColor: "var(--color-primary)" }}>
        <div className="flex-row justify-between" style={{ flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 className="h2" style={{ color: "var(--color-primary)" }}>🔍 曲を見つける</h2>
            <p className="text-subtle mt-sm">気になる曲があればチェック！</p>
          </div>
          <div className="flex-row" style={{ gap: "8px" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-subtle)" }}>絞り込み:</span>
            <select value={recruitFilter} onChange={(e) => setRecruitFilter(e.target.value)} style={{ padding: "4px 8px", borderRadius: "var(--radius-sm)" }}>
              <option value="">すべて</option>
              {PART_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-lg">
          <SongDiscovery songs={openSongs} onApply={(id) => navigate(`/songs/${id}`)} />
        </div>
      </section>

      <section className="mt-xl">
        <h2 className="h2" style={{ color: "var(--color-accent)" }}>⏳ 応募中・回答待ち</h2>
        <div className="mt-md">
          <SongList songs={pendingSongs} emptyText="進行中の応募はありません。" onSongClick={(id) => navigate(`/songs/${id}`)} />
        </div>
      </section>

      {data.own_songs.length > 0 && (
        <section className="mt-xl" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "32px" }}>
          <h2 className="h2">📝 自分が起票した曲</h2>
          <div className="mt-md">
            <SongList songs={data.own_songs} emptyText="" onSongClick={(id) => navigate(`/songs/${id}`)} />
          </div>
        </section>
      )}
    </main>
  );
}
