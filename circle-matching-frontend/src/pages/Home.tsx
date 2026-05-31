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
    <section className="card mt-lg">
      <h2 className="h2">{title}</h2>
      <p className="text-subtle mt-sm">{hint}</p>
      <div className="mt-md">
        {hasContent ? children : <p className="text-subtle">{emptyText}</p>}
      </div>
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

  if (loading) return <main className="container">読み込み中...</main>;
  if (error || !data) {
    return <main className="container"><p className="text-error">{error || "ホームを取得できませんでした"}</p></main>;
  }

  return (
    <main className="container">
      <div className="flex-row justify-between">
        <div>
          <h1 className="h1">こんにちは、{data.user_name} さん 👋</h1>
          <p className="text-subtle mt-sm">今やることを、全サークル横断でまとめています。</p>
        </div>
        <div className="flex-row">
          <button className="btn-outline btn-pill" onClick={() => navigate("/me")}>👤 プロフィール</button>
          <NotificationButton />
        </div>
      </div>

      <SectionCard
        title="🏠 参加サークル"
        hint="サークル詳細へ移動できます。"
        emptyText="参加しているサークルはまだありません。"
      >
        <div className="flex-row" style={{ flexWrap: "wrap" }}>
          {data.circles.map((circle) => (
            <button key={circle.id} className="btn-outline btn-pill" onClick={() => navigate(`/circles/${circle.id}`)}>
              {circle.name}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="✉️ 返事待ちの依頼"
        hint="あなた宛てのお誘いです。"
        emptyText="返事待ちの依頼はありません。"
      >
        <div className="grid-list">
          {data.pending_offers.map((item) => (
            <button key={`${item.song_id}-${item.part}`} className="card card-interactive" onClick={() => navigate(`/songs/${item.song_id}`)}>
              <div className="flex-col" style={{ gap: "4px" }}>
                <strong style={{ fontSize: "1.1rem" }}>{item.song_title}</strong>
                <p className="text-subtle">{item.artist}</p>
                <p className="text-subtle" style={{ color: "var(--color-primary)", fontWeight: "bold" }}>
                  {item.circle_name} / {item.part}
                </p>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="🚀 自分の応募中"
        hint="承認待ちの応募です。"
        emptyText="承認待ちの応募はありません。"
      >
        <div className="grid-list">
          {data.pending_applications.map((item) => (
            <button key={`${item.song_id}-${item.part}`} className="card card-interactive" onClick={() => navigate(`/songs/${item.song_id}`)}>
              <div className="flex-col" style={{ gap: "4px" }}>
                <strong style={{ fontSize: "1.1rem" }}>{item.song_title}</strong>
                <p className="text-subtle">{item.artist}</p>
                <p className="text-subtle">{item.circle_name} / {item.part}</p>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="📅 近い参加予定"
        hint="承認済みの今後の出演です。"
        emptyText="承認済みの参加予定はありません。"
      >
        <div className="grid-list">
          {data.upcoming_participations.map((item) => (
            <button key={`${item.live_event_id}-${item.song_id}`} className="card card-interactive" onClick={() => navigate(`/circles/${item.circle_id}/participation-plans`)}>
              <div className="flex-col" style={{ gap: "4px" }}>
                <strong style={{ fontSize: "1.1rem" }}>{item.song_title}</strong>
                <p className="text-subtle">{item.artist}</p>
                <p className="text-subtle" style={{ fontWeight: "bold" }}>{item.circle_name} / {item.live_event_name}</p>
                <p className="text-subtle">
                  🗓️ {item.live_event_date || "日付未定"} / 🎸 {item.parts.join(", ")}
                </p>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="💬 未読チャット"
        hint="新着のある会話だけ表示しています。"
        emptyText="未読チャットはありません。"
      >
        <div className="grid-list">
          {data.unread_chats.map((item) => (
            <button key={`${item.song_id}-${item.last_message_at || ""}`} className="card card-interactive" onClick={() => navigate(`/songs/${item.song_id}/chat`)}>
              <div className="flex-row justify-between">
                <strong style={{ fontSize: "1.1rem" }}>{item.song_title}</strong>
                <span className="badge badge-primary">未読 {item.unread_count}</span>
              </div>
              <p className="text-subtle mt-sm">{item.artist} · {item.circle_name}</p>
              <p className="mt-sm" style={{ fontStyle: "italic", color: "var(--color-text-subtle)" }}>
                「 {item.last_message_preview || "新着があります"} 」
              </p>
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="flex-row mt-xl" style={{ flexWrap: "wrap", borderTop: "1px solid var(--color-border)", paddingTop: "24px" }}>
        <button className="btn-primary btn-pill" onClick={() => navigate("/circle/join")}>🤝 サークルに参加</button>
        <button className="btn-outline btn-pill" onClick={() => navigate("/circle/create")}>✨ 新しく作る</button>
        <button className="btn-danger btn-pill" style={{ marginLeft: "auto" }} onClick={logout}>ログアウト</button>
      </div>
    </main>
  );
}
