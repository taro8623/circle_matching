import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import NotificationButton from "../components/NotificationButton";
import { api } from "../api";

type HomeCircle = {
  id: string;
  name: string;
};

type HomeOfferItem = {
  circle_id: string;
  circle_name: string;
  song_id: string;
  song_title: string;
  artist: string;
  part: string;
};

type HomeApplicationItem = {
  circle_id: string;
  circle_name: string;
  song_id: string;
  song_title: string;
  artist: string;
  part: string;
};

type HomeParticipationItem = {
  circle_id: string;
  circle_name: string;
  live_event_id: string;
  live_event_name: string;
  live_event_date?: string | null;
  song_id: string;
  song_title: string;
  artist: string;
  parts: string[];
};

type HomeChatItem = {
  circle_id: string;
  circle_name: string;
  song_id: string;
  song_title: string;
  artist: string;
  unread_count: number;
  last_message_preview?: string | null;
  last_message_at?: string | null;
};

type MeHomeResponse = {
  user_name: string;
  circles: HomeCircle[];
  pending_offers: HomeOfferItem[];
  pending_applications: HomeApplicationItem[];
  upcoming_participations: HomeParticipationItem[];
  unread_chats: HomeChatItem[];
};

function SectionCard({
  title,
  hint,
  emptyText,
  children,
}: {
  title: string;
  hint: string;
  emptyText: string;
  children: ReactNode;
}) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>{title}</h2>
      <p style={styles.hint}>{hint}</p>
      {hasContent ? children : <p style={styles.empty}>{emptyText}</p>}
    </section>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [data, setData] = useState<MeHomeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<MeHomeResponse>("/me/home")
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  if (loading) return <main style={styles.page}>読み込み中...</main>;
  if (error || !data) {
    return <main style={styles.page}><p style={styles.error}>{error || "ホームを取得できませんでした"}</p></main>;
  }

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.h1}>こんにちは、{data.user_name} さん</h1>
          <p style={styles.subtle}>今やることを、全サークル横断でまとめています。</p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={() => navigate("/me")}>プロフィール</button>
          <NotificationButton />
        </div>
      </div>

      <SectionCard
        title="参加サークル"
        hint="サークル詳細へ移動できます。"
        emptyText="参加しているサークルはまだありません。"
      >
        <div style={styles.circleRow}>
          {data.circles.map((circle) => (
            <button key={circle.id} style={styles.circleButton} onClick={() => navigate(`/circles/${circle.id}`)}>
              {circle.name}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="返事待ちの依頼"
        hint="あなた宛てのお誘いです。"
        emptyText="返事待ちの依頼はありません。"
      >
        <div style={styles.list}>
          {data.pending_offers.map((item) => (
            <button key={`${item.song_id}-${item.part}`} style={styles.itemCard} onClick={() => navigate(`/songs/${item.song_id}`)}>
              <strong>{item.song_title}</strong>
              <p style={styles.meta}>{item.artist}</p>
              <p style={styles.meta}>{item.circle_name} / {item.part}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="自分の応募中"
        hint="承認待ちの応募です。"
        emptyText="承認待ちの応募はありません。"
      >
        <div style={styles.list}>
          {data.pending_applications.map((item) => (
            <button key={`${item.song_id}-${item.part}`} style={styles.itemCard} onClick={() => navigate(`/songs/${item.song_id}`)}>
              <strong>{item.song_title}</strong>
              <p style={styles.meta}>{item.artist}</p>
              <p style={styles.meta}>{item.circle_name} / {item.part}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="近い参加予定"
        hint="承認済みの今後の出演です。"
        emptyText="承認済みの参加予定はありません。"
      >
        <div style={styles.list}>
          {data.upcoming_participations.map((item) => (
            <button key={`${item.live_event_id}-${item.song_id}`} style={styles.itemCard} onClick={() => navigate(`/circles/${item.circle_id}/participation-plans`)}>
              <strong>{item.song_title}</strong>
              <p style={styles.meta}>{item.artist}</p>
              <p style={styles.meta}>{item.circle_name} / {item.live_event_name}</p>
              <p style={styles.meta}>
                {item.live_event_date || "日付未定"} / {item.parts.join(", ")}
              </p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="未読チャット"
        hint="新着のある会話だけ表示しています。"
        emptyText="未読チャットはありません。"
      >
        <div style={styles.list}>
          {data.unread_chats.map((item) => (
            <button key={`${item.song_id}-${item.last_message_at || ""}`} style={styles.itemCard} onClick={() => navigate(`/songs/${item.song_id}/chat`)}>
              <div style={styles.itemHeader}>
                <strong>{item.song_title}</strong>
                <span style={styles.badge}>未読 {item.unread_count}</span>
              </div>
              <p style={styles.meta}>{item.artist}</p>
              <p style={styles.meta}>{item.circle_name}</p>
              <p style={styles.preview}>{item.last_message_preview || "新着があります"}</p>
            </button>
          ))}
        </div>
      </SectionCard>

      <div style={styles.footerActions}>
        <button onClick={() => navigate("/circle/join")}>新規サークル参加</button>
        <button onClick={() => navigate("/circle/create")}>新規サークル作成</button>
        <button onClick={logout} style={styles.logoutButton}>ログアウト</button>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(980px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  header: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" },
  headerActions: { display: "flex", gap: 8, alignItems: "center" },
  h1: { margin: 0, fontSize: 30 },
  subtle: { marginTop: 8, color: "#64748b" },
  section: { marginTop: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" },
  h2: { margin: "0 0 8px", fontSize: 20 },
  hint: { margin: "0 0 12px", color: "#64748b", fontSize: 14 },
  circleRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  circleButton: { border: "1px solid #cbd5e1", borderRadius: 999, padding: "10px 14px", background: "#fff", cursor: "pointer" },
  list: { display: "grid", gap: 10 },
  itemCard: { width: "100%", textAlign: "left", border: "1px solid #dbeafe", borderRadius: 10, padding: 14, background: "#f8fbff", cursor: "pointer" },
  itemHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  badge: { borderRadius: 999, padding: "4px 10px", background: "#dbeafe", color: "#1d4ed8", fontSize: 12, fontWeight: 700 },
  meta: { margin: "6px 0 0", color: "#374151", fontSize: 14 },
  preview: { margin: "8px 0 0", color: "#334155", fontSize: 14 },
  empty: { color: "#6b7280" },
  footerActions: { display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" },
  logoutButton: { color: "#dc2626" },
  error: { color: "#dc2626" },
};
