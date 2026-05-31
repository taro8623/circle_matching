import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import NotificationButton from "../components/NotificationButton";

type PaymentSummary = {
  unpaid_count: number;
  same_day_planned_count: number;
  exempt_count: number;
  paid_count: number;
};

type LiveOverview = {
  live_event_id: string;
  live_event_name: string;
  event_date?: string | null;
  created_at: string;
  lifecycle_status: string;
  approved_song_count: number;
  participant_count: number;
  unpaid_count: number;
  same_day_planned_count: number;
  exempt_count: number;
  paid_count: number;
};

type PopularArtist = {
  artist_name: string;
  member_count: number;
};

type MemberStat = {
  user_id: string;
  user_name: string;
  appearance_count: number;
  participation_rate: number;
};

type CircleBIResponse = {
  circle_id: string;
  circle_name: string;
  member_count: number;
  can_view_live_participants: boolean;
  recent_new_member_count: number;
  recent_new_member_approved_count: number;
  recent_new_member_approval_rate: number;
  total_live_count: number;
  scheduled_live_count: number;
  completed_live_count: number;
  cancelled_live_count: number;
  pending_payment_count: number;
  payment_summary: PaymentSummary;
  live_overviews: LiveOverview[];
  popular_artists: PopularArtist[];
  member_stats: MemberStat[];
};

type DashboardView = "menu" | "member" | "operations";

const EMPTY_PAYMENT_SUMMARY: PaymentSummary = {
  unpaid_count: 0,
  same_day_planned_count: 0,
  exempt_count: 0,
  paid_count: 0,
};

const LIFECYCLE_LABELS: Record<string, string> = {
  scheduled: "開催前",
  completed: "終了",
  cancelled: "中止",
};

function formatDate(value?: string | null) {
  if (!value) return "未定";
  return new Date(value).toLocaleDateString("ja-JP");
}

function getUpcomingLives(lives: LiveOverview[]) {
  return lives.filter((live) => live.lifecycle_status === "scheduled");
}

function getRecentlyActiveMemberCount(data: CircleBIResponse) {
  return data.member_stats.filter((member) => member.appearance_count > 0).length;
}

function normalizeBIResponse(raw: Partial<CircleBIResponse>): CircleBIResponse {
  return {
    circle_id: raw.circle_id ?? "",
    circle_name: raw.circle_name ?? "BI",
    member_count: raw.member_count ?? 0,
    can_view_live_participants: raw.can_view_live_participants ?? false,
    recent_new_member_count: raw.recent_new_member_count ?? 0,
    recent_new_member_approved_count: raw.recent_new_member_approved_count ?? 0,
    recent_new_member_approval_rate: raw.recent_new_member_approval_rate ?? 0,
    total_live_count: raw.total_live_count ?? raw.completed_live_count ?? 0,
    scheduled_live_count: raw.scheduled_live_count ?? 0,
    completed_live_count: raw.completed_live_count ?? 0,
    cancelled_live_count: raw.cancelled_live_count ?? 0,
    pending_payment_count: raw.pending_payment_count ?? 0,
    payment_summary: raw.payment_summary ?? EMPTY_PAYMENT_SUMMARY,
    live_overviews: raw.live_overviews ?? [],
    popular_artists: raw.popular_artists ?? [],
    member_stats: raw.member_stats ?? [],
  };
}

export default function CircleBI() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CircleBIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedView, setSelectedView] = useState<DashboardView>("menu");

  useEffect(() => {
    if (!circleId) return;
    api.get<CircleBIResponse>(`/circles/${circleId}/bi`)
      .then((response) => setData(normalizeBIResponse(response)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [circleId]);

  if (loading) return <main style={styles.page}>読み込み中...</main>;
  if (error || !data) {
    return (
      <main style={styles.page}>
        <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
        <p style={styles.error}>{error || "BIを取得できませんでした"}</p>
      </main>
    );
  }

  const upcomingLives = getUpcomingLives(data.live_overviews);
  const upcomingApprovedSongCount = upcomingLives.reduce((sum, live) => sum + live.approved_song_count, 0);
  const upcomingParticipantCount = upcomingLives.reduce((sum, live) => sum + live.participant_count, 0);
  const upcomingParticipantRate =
    data.member_count > 0 ? Math.round((upcomingParticipantCount / data.member_count) * 100) : 0;
  const activeMemberCount = getRecentlyActiveMemberCount(data);
  const memberActivationRate =
    data.member_count > 0 ? Math.round((activeMemberCount / data.member_count) * 100) : 0;

  const renderMenu = () => (
    <>
      <h1 style={styles.h1}>{data.circle_name} - 統計</h1>
      <p style={styles.lead}>見たい相手に合わせて、統計の見方を選べます。</p>

      <div style={styles.menuGrid}>
        <button type="button" style={styles.menuCard} onClick={() => setSelectedView("member")}>
          <div style={styles.menuEyebrow}>メンバー向け</div>
          <h2 style={styles.menuTitle}>参加しやすさサマリー</h2>
          <p style={styles.menuText}>
            このサークルなら自分もバンドできそう、と思える活動量や参加のしやすさを見ます。
          </p>
        </button>
        <button type="button" style={styles.menuCard} onClick={() => setSelectedView("operations")}>
          <div style={styles.menuEyebrow}>運営向け</div>
          <h2 style={styles.menuTitle}>運営サマリー</h2>
          <p style={styles.menuText}>
            ライブ数、決済状況、進行中イベントの状態など、運営上の滞りを確認します。
          </p>
        </button>
      </div>
    </>
  );

  const renderMemberSummary = () => (
    <>
      <div style={styles.viewHeader}>
        <div>
          <div style={styles.eyebrow}>メンバー向け</div>
          <h1 style={styles.h1}>参加しやすさサマリー</h1>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={() => setSelectedView("menu")}>
          統計メニューに戻る
        </button>
      </div>
      <p style={styles.lead}>「このサークルに入れば、自分もライブに参加できそう」と感じやすい指標をまとめています。</p>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>開催前ライブの参加予定率</div>
          <div style={styles.summaryValue}>{upcomingParticipantRate}%</div>
          <div style={styles.summarySubValue}>在籍メンバー {data.member_count}人中 {upcomingParticipantCount}人</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>直近で出演実績のある人数</div>
          <div style={styles.summaryValue}>{activeMemberCount}</div>
          <div style={styles.summarySubValue}>在籍メンバーの {memberActivationRate}%</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>新規入会者のライブ承認率</div>
          <div style={styles.summaryValue}>{data.recent_new_member_approval_rate}%</div>
          <div style={styles.summarySubValue}>
            直近90日入会 {data.recent_new_member_count}人中 {data.recent_new_member_approved_count}人が承認済み
          </div>
        </div>
      </div>

      <section style={styles.section}>
        <h2 style={styles.h2}>このサークルでバンドできそう度</h2>
        <div style={styles.insightList}>
          <div style={styles.insightCard}>
            <strong>今もライブが動いています</strong>
            <p style={styles.insightText}>
              開催前ライブで、承認済みの出演曲は合計 <strong>{upcomingApprovedSongCount} 曲</strong> あります。
            </p>
          </div>
          <div style={styles.insightCard}>
            <strong>参加の母集団があります</strong>
            <p style={styles.insightText}>
              在籍メンバー <strong>{data.member_count} 人</strong> のうち、開催前ライブの参加予定者は
              <strong> {upcomingParticipantCount} 人</strong> で、参加予定率は
              <strong> {upcomingParticipantRate}%</strong> です。
            </p>
          </div>
          <div style={styles.insightCard}>
            <strong>実際に動いているメンバーがいます</strong>
            <p style={styles.insightText}>
              終了済みライブベースで、出演実績のあるメンバーは <strong>{activeMemberCount} 人</strong> です。
            </p>
          </div>
          <div style={styles.insightCard}>
            <strong>新しく入っても承認まで届いています</strong>
            <p style={styles.insightText}>
              直近90日で入会した <strong>{data.recent_new_member_count} 人</strong> のうち、
              <strong> {data.recent_new_member_approved_count} 人</strong> がライブ承認まで進んでいます。
            </p>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>近いライブの動き</h2>
        <p style={styles.hint}>開催前ライブの予定を見て、今どれくらい動きがあるかを把握できます。</p>
        {upcomingLives.length === 0 ? (
          <p style={styles.empty}>現在、開催前のライブはありません。</p>
        ) : (
          <div style={styles.liveTable}>
            <div style={{ ...styles.liveRow, ...styles.liveHeader }}>
              <span>ライブ</span>
              <span>日付</span>
              <span>状態</span>
              <span>承認曲</span>
              <span>参加者</span>
              <span>決済</span>
            </div>
            {upcomingLives.map((live) => (
              <div key={live.live_event_id} style={styles.liveRow}>
                <span>
                  <strong>{live.live_event_name}</strong>
                  <div style={styles.rowSubText}>起票日: {formatDate(live.created_at)}</div>
                </span>
                <span>{formatDate(live.event_date)}</span>
                <span>{LIFECYCLE_LABELS[live.lifecycle_status] || live.lifecycle_status}</span>
                <span>{live.approved_song_count}曲</span>
                <span>{live.participant_count}人</span>
                <span style={styles.paymentBreakdown}>
                  <span style={styles.unpaidText}>未 {live.unpaid_count}</span>
                  <span style={styles.sameDayText}>当 {live.same_day_planned_count}</span>
                  <span style={styles.exemptText}>免 {live.exempt_count}</span>
                  <span style={styles.paidText}>済 {live.paid_count}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>人気アーティスト</h2>
        <p style={styles.hint}>好きなアーティストの傾向から、音楽の相性をイメージできます。</p>
        {data.popular_artists.length === 0 ? (
          <p style={styles.empty}>まだ好きなアーティストの登録がありません。</p>
        ) : (
          <div style={styles.artistList}>
            {data.popular_artists.slice(0, 8).map((artist, index) => (
              <div key={artist.artist_name} style={styles.artistRow}>
                <span style={styles.rank}>{index + 1}</span>
                <span style={styles.artistName}>{artist.artist_name}</span>
                <span style={styles.artistCount}>{artist.member_count}人</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );

  const renderOperationsSummary = () => (
    <>
      <div style={styles.viewHeader}>
        <div>
          <div style={styles.eyebrow}>運営向け</div>
          <h1 style={styles.h1}>運営サマリー</h1>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={() => setSelectedView("menu")}>
          統計メニューに戻る
        </button>
      </div>
      <p style={styles.lead}>全ライブ横断の状況を見てから、ライブ単位の明細へ掘れる運営ダッシュボードです。</p>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>在籍メンバー数</div>
          <div style={styles.summaryValue}>{data.member_count}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>全ライブ数</div>
          <div style={styles.summaryValue}>{data.total_live_count}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>開催前ライブ数</div>
          <div style={styles.summaryValue}>{data.scheduled_live_count}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>終了済みライブ数</div>
          <div style={styles.summaryValue}>{data.completed_live_count}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>中止ライブ数</div>
          <div style={styles.summaryValue}>{data.cancelled_live_count}</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>要確認の決済人数</div>
          <div style={styles.summaryValue}>{data.pending_payment_count}</div>
          <div style={styles.summarySubValue}>未決済 + 当日払い予定</div>
        </div>
      </div>

      <section style={styles.section}>
        <h2 style={styles.h2}>決済サマリー</h2>
        <p style={styles.hint}>参加者リストで付けた決済状態を、全ライブ横断で集計しています。</p>
        <div style={styles.paymentGrid}>
          <div style={{ ...styles.paymentCard, ...styles.unpaidCard }}>
            <div style={styles.summaryLabel}>未決済</div>
            <div style={styles.summaryValue}>{data.payment_summary.unpaid_count}</div>
          </div>
          <div style={{ ...styles.paymentCard, ...styles.sameDayCard }}>
            <div style={styles.summaryLabel}>当日払い予定</div>
            <div style={styles.summaryValue}>{data.payment_summary.same_day_planned_count}</div>
          </div>
          <div style={{ ...styles.paymentCard, ...styles.exemptCard }}>
            <div style={styles.summaryLabel}>支払不要</div>
            <div style={styles.summaryValue}>{data.payment_summary.exempt_count}</div>
          </div>
          <div style={{ ...styles.paymentCard, ...styles.paidCard }}>
            <div style={styles.summaryLabel}>決済完了</div>
            <div style={styles.summaryValue}>{data.payment_summary.paid_count}</div>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>ライブ一覧サマリー</h2>
        <p style={styles.hint}>各ライブごとの出演曲数・参加人数・決済状況をまとめて見られます。</p>
        {!data.can_view_live_participants && (
          <p style={styles.hint}>参加者リスト閲覧権限がないため、この画面から詳細ページには移動できません。</p>
        )}
        {data.live_overviews.length === 0 ? (
          <p style={styles.empty}>まだライブがありません。</p>
        ) : (
          <div style={styles.liveTable}>
            <div style={{ ...styles.liveRow, ...styles.liveHeader }}>
              <span>ライブ</span>
              <span>日付</span>
              <span>状態</span>
              <span>承認曲</span>
              <span>参加者</span>
              <span>決済</span>
            </div>
            {data.live_overviews.map((live) =>
              data.can_view_live_participants ? (
                <button
                  key={live.live_event_id}
                  type="button"
                  onClick={() => navigate(`/circles/${circleId}/live-events/${live.live_event_id}/participants`)}
                  style={styles.liveButton}
                >
                  <div style={styles.liveRow}>
                    <span>
                      <strong>{live.live_event_name}</strong>
                      <div style={styles.rowSubText}>起票日: {formatDate(live.created_at)}</div>
                    </span>
                    <span>{formatDate(live.event_date)}</span>
                    <span>{LIFECYCLE_LABELS[live.lifecycle_status] || live.lifecycle_status}</span>
                    <span>{live.approved_song_count}曲</span>
                    <span>{live.participant_count}人</span>
                    <span style={styles.paymentBreakdown}>
                      <span style={styles.unpaidText}>未 {live.unpaid_count}</span>
                      <span style={styles.sameDayText}>当 {live.same_day_planned_count}</span>
                      <span style={styles.exemptText}>免 {live.exempt_count}</span>
                      <span style={styles.paidText}>済 {live.paid_count}</span>
                    </span>
                  </div>
                </button>
              ) : (
                <div key={live.live_event_id} style={styles.liveRow}>
                  <span>
                    <strong>{live.live_event_name}</strong>
                    <div style={styles.rowSubText}>起票日: {formatDate(live.created_at)}</div>
                  </span>
                  <span>{formatDate(live.event_date)}</span>
                  <span>{LIFECYCLE_LABELS[live.lifecycle_status] || live.lifecycle_status}</span>
                  <span>{live.approved_song_count}曲</span>
                  <span>{live.participant_count}人</span>
                  <span style={styles.paymentBreakdown}>
                    <span style={styles.unpaidText}>未 {live.unpaid_count}</span>
                    <span style={styles.sameDayText}>当 {live.same_day_planned_count}</span>
                    <span style={styles.exemptText}>免 {live.exempt_count}</span>
                    <span style={styles.paidText}>済 {live.paid_count}</span>
                  </span>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>出演回数・参加率</h2>
        <p style={styles.hint}>終了済みライブを母数に、各メンバーが何回出演したかを集計しています。</p>
        {data.member_stats.length === 0 ? (
          <p style={styles.empty}>集計対象メンバーがいません。</p>
        ) : (
          <div style={styles.table}>
            <div style={{ ...styles.tableRow, ...styles.tableHeader }}>
              <span>メンバー</span>
              <span>出演回数</span>
              <span>参加率</span>
            </div>
            {data.member_stats.map((member) => (
              <div key={member.user_id} style={styles.tableRow}>
                <span>{member.user_name}</span>
                <span>{member.appearance_count}回</span>
                <span>{member.participation_rate}%</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
        <NotificationButton />
      </div>
      {selectedView === "menu" && renderMenu()}
      {selectedView === "member" && renderMemberSummary()}
      {selectedView === "operations" && renderOperationsSummary()}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(960px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  header: { display: "flex", justifyContent: "space-between", gap: 12 },
  viewHeader: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" },
  eyebrow: { color: "#2563eb", fontWeight: 700, fontSize: 13 },
  h1: { margin: "20px 0" },
  lead: { margin: "0 0 20px", color: "#475569" },
  menuGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 20 },
  menuCard: {
    border: "1px solid #dbeafe",
    background: "#f8fbff",
    borderRadius: 16,
    padding: 20,
    textAlign: "left",
    cursor: "pointer",
  },
  menuEyebrow: { color: "#2563eb", fontWeight: 700, fontSize: 13, marginBottom: 8 },
  menuTitle: { margin: "0 0 10px", fontSize: 22, color: "#0f172a" },
  menuText: { margin: 0, color: "#475569", lineHeight: 1.6 },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: 999,
    padding: "10px 16px",
    cursor: "pointer",
  },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  summaryCard: { padding: 16, border: "1px solid #dbeafe", borderRadius: 12, background: "#f8fbff" },
  summaryLabel: { color: "#64748b", fontSize: 14 },
  summaryValue: { marginTop: 8, fontSize: 28, fontWeight: 700, color: "#0f172a" },
  summarySubValue: { marginTop: 6, color: "#475569", fontSize: 12 },
  section: { marginTop: 24, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" },
  h2: { margin: "0 0 8px", fontSize: 20 },
  hint: { margin: "0 0 12px", color: "#64748b", fontSize: 14 },
  insightList: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" },
  insightCard: { border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 12, padding: 16 },
  insightText: { margin: "8px 0 0", color: "#475569", lineHeight: 1.6 },
  paymentGrid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" },
  paymentCard: { padding: 16, borderRadius: 12, border: "1px solid #e5e7eb" },
  unpaidCard: { background: "#fef2f2", borderColor: "#fecaca" },
  sameDayCard: { background: "#fffbeb", borderColor: "#fde68a" },
  exemptCard: { background: "#faf5ff", borderColor: "#d8b4fe" },
  paidCard: { background: "#f0fdf4", borderColor: "#bbf7d0" },
  liveTable: { display: "grid" },
  liveHeader: { color: "#64748b", fontWeight: 700, fontSize: 13 },
  liveButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    textAlign: "inherit",
    cursor: "pointer",
  },
  liveRow: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 1.6fr) 120px 90px 80px 80px minmax(170px, 1fr)",
    gap: 12,
    alignItems: "center",
    padding: "12px 0",
    borderTop: "1px solid #f1f5f9",
  },
  rowSubText: { marginTop: 4, color: "#64748b", fontSize: 12 },
  paymentBreakdown: { display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, fontWeight: 700 },
  unpaidText: { color: "#b91c1c" },
  sameDayText: { color: "#92400e" },
  exemptText: { color: "#7e22ce" },
  paidText: { color: "#15803d" },
  artistList: { display: "grid", gap: 8 },
  artistRow: { display: "grid", gridTemplateColumns: "40px minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px solid #f1f5f9" },
  rank: { color: "#2563eb", fontWeight: 700 },
  artistName: { color: "#0f172a" },
  artistCount: { color: "#334155", fontWeight: 600 },
  table: { display: "grid" },
  tableRow: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 140px 120px", gap: 12, alignItems: "center", padding: "12px 0", borderTop: "1px solid #f1f5f9" },
  tableHeader: { color: "#64748b", fontWeight: 700, fontSize: 13 },
  empty: { color: "#6b7280" },
  error: { color: "#dc2626" },
};
