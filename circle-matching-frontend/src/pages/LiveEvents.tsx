import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import NotificationButton from "../components/NotificationButton";

type LiveEvent = {
  id: string;
  name: string;
  event_date?: string | null;
  entry_status: string;
  lifecycle_status: string;
  created_by: string;
  songs: LiveEventSong[];
  current_user_status: string;
  current_user_status_memo?: string | null;
  current_user_auto_labels: string[];
};

type LiveEventSong = {
  song_id: string;
  title: string;
  artist: string;
  song_status: string;
  live_application_status: string;
  recruiting_labels: string[];
};

type LiveApplication = {
  id: string;
  song_request_id: string;
  live_event_id: string;
  status: string;
};

const STATUS_OPTIONS = [
  { value: "want_invites", label: "誘ってほしい" },
  { value: "available", label: "出演予定あり" },
  { value: "unavailable", label: "今月は出演予定なし" },
];

const LIFECYCLE_LABELS: Record<string, string> = {
  scheduled: "開催前",
  completed: "終了",
  cancelled: "中止",
};

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
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [eventApplications, setEventApplications] = useState<Record<string, LiveApplication[]>>({});

  const reload = async () => {
    if (!circleId) return;
    try {
      const evs = await api.get<LiveEvent[]>(`/circles/${circleId}/live-events`);
      setEvents(evs);
      setStatuses(
        Object.fromEntries(evs.map((event) => [event.id, event.current_user_status || "want_invites"]))
      );
      const applicationsByEvent = Object.fromEntries(
        await Promise.all(
          evs.map(async (event) => {
            const applications = await api
              .get<LiveApplication[]>(`/live-events/${event.id}/applications`)
              .catch(() => []);
            return [event.id, applications];
          })
        )
      ) as Record<string, LiveApplication[]>;
      setEventApplications(applicationsByEvent);

      const forMe = await api.get<any>(`/circles/${circleId}/songs/for-me`).catch(() => null);
      if (forMe) setUserPermissions(forMe.current_user_permissions || []);
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
        entry_status: "closed",
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

  const updateLifecycleStatus = async (eventId: string, lifecycleStatus: "scheduled" | "completed" | "cancelled") => {
    setBusy(true);
    try {
      await api.patch(`/live-events/${eventId}`, { lifecycle_status: lifecycleStatus });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ライブ状態の更新に失敗しました");
    } finally {
      setBusy(false);
    }
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

  const decideApplication = async (applicationId: string, status: "approved" | "rejected") => {
    setBusy(true);
    try {
      await api.patch(`/live-applications/${applicationId}`, { status });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認処理に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const canCreateLiveEvent = userPermissions.includes("create_live_event");
  const canOpenLiveEntry = userPermissions.includes("open_live_entry");
  const canCloseLiveEntry = userPermissions.includes("close_live_entry");
  const canMarkLiveCompleted = userPermissions.includes("mark_live_completed");
  const canMarkLiveCancelled = userPermissions.includes("mark_live_cancelled");
  const canRevertLiveToScheduled = userPermissions.includes("revert_live_to_scheduled");
  const canApproveLiveApplications = userPermissions.includes("approve_live_applications");
  const canRejectLiveApplications = userPermissions.includes("reject_live_applications");
  const canManageAnyLive =
    canCreateLiveEvent ||
    canOpenLiveEntry ||
    canCloseLiveEntry ||
    canMarkLiveCompleted ||
    canMarkLiveCancelled ||
    canRevertLiveToScheduled ||
    canApproveLiveApplications ||
    canRejectLiveApplications;

  const getStatusLabel = (status: string) =>
    STATUS_OPTIONS.find((opt) => opt.value === status)?.label || "誘ってほしい";

  const getConflictMessage = (event: LiveEvent) => {
    const manualStatus = statuses[event.id] || event.current_user_status || "want_invites";
    if (manualStatus !== "unavailable") return null;
    if (event.current_user_auto_labels.length === 0) return null;
    return "手動設定は「今月は出演予定なし」ですが、自動集計ではこの月に参加予定の曲があります。";
  };

  const isOverdueUncompleted = (event: LiveEvent) => {
    if (!event.event_date || event.lifecycle_status !== "scheduled") return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(event.event_date) < today;
  };

  const getPendingApplications = (eventId: string) =>
    (eventApplications[eventId] || []).filter((item) => item.status === "applied");

  const renderEventSongList = (ev: LiveEvent, showManagementActions: boolean) => (
    <div style={{ marginTop: 14 }}>
      <p style={styles.meta}>{showManagementActions ? "このライブの申請曲:" : "このライブに紐づく曲:"}</p>
      {ev.songs.length === 0 ? (
        <p style={styles.empty}>まだ申請中の曲はありません</p>
      ) : (
        <div style={styles.songList}>
          {ev.songs.map((song) => {
            const application = (eventApplications[ev.id] || []).find(
              (item) =>
                item.song_request_id === song.song_id &&
                (item.status === "applied" || item.status === "approved")
            );

            return (
              <div key={song.song_id} style={styles.songCard}>
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
                <div style={styles.songActions}>
                  <button
                    type="button"
                    onClick={() => navigate(`/songs/${song.song_id}`)}
                    style={styles.secondaryButton}
                  >
                    曲詳細を見る
                  </button>
                  {showManagementActions && song.live_application_status === "applied" && application && (
                    <>
                      {canApproveLiveApplications && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decideApplication(application.id, "approved")}
                          style={styles.primaryButton}
                        >
                          承認
                        </button>
                      )}
                      {canRejectLiveApplications && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decideApplication(application.id, "rejected")}
                          style={styles.dangerButton}
                        >
                          却下
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <main style={styles.page}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
        <NotificationButton />
      </div>
      <h1 style={styles.h1}>定期ライブ一覧</h1>
      {error && <p style={styles.error}>{error}</p>}

      {canManageAnyLive && (
        <section style={{ ...styles.section, ...styles.adminSection }}>
          <h2 style={styles.h2}>権限ありメニュー</h2>
          <p style={styles.meta}>自分に付与されている操作だけ実行できます。</p>
          {canCreateLiveEvent && (
            <div style={{ display: "grid", gap: 8, maxWidth: 480, marginTop: 16, marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>新しいライブを作成</h3>
              <p style={styles.meta}>作成直後は申請受付を閉じた状態で作成されます。予定候補としてはすぐ使えます。</p>
              <input
                placeholder="ライブ名 (例: 2026年8月 定例夏ライブ)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
              />
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={styles.input} />
              <button disabled={busy || !name.trim()} onClick={createEvent}>作成</button>
            </div>
          )}
          {events.length === 0 ? (
            <p style={styles.empty}>管理するライブはまだありません</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {events.map((ev) => {
                const pendingApplications = getPendingApplications(ev.id);
                return (
                  <div key={ev.id} style={styles.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{ev.name}</h3>
                        <p style={styles.meta}>
                          日付: {ev.event_date || "未定"} / 受付: {ev.entry_status} / 状態: {LIFECYCLE_LABELS[ev.lifecycle_status] || ev.lifecycle_status}
                        </p>
                        <p style={styles.meta}>承認待ち申請: {pendingApplications.length} 件</p>
                      </div>
                      <div style={styles.adminActions}>
                        {ev.lifecycle_status === "scheduled" && (
                          <>
                            {((ev.entry_status === "open" && canCloseLiveEntry) ||
                              (ev.entry_status !== "open" && canOpenLiveEntry)) && (
                              <button onClick={() => toggleEntryStatus(ev)} disabled={busy}>
                                {ev.entry_status === "open" ? "受付を閉じる" : "受付を開く"}
                              </button>
                            )}
                            {canMarkLiveCompleted && (
                              <button
                                onClick={() => updateLifecycleStatus(ev.id, "completed")}
                                disabled={busy}
                                style={styles.primaryButton}
                              >
                                終了にする
                              </button>
                            )}
                            {canMarkLiveCancelled && (
                              <button
                                onClick={() => updateLifecycleStatus(ev.id, "cancelled")}
                                disabled={busy}
                                style={styles.dangerButton}
                              >
                                中止にする
                              </button>
                            )}
                          </>
                        )}
                        {ev.lifecycle_status !== "scheduled" && canRevertLiveToScheduled && (
                          <button
                            onClick={() => updateLifecycleStatus(ev.id, "scheduled")}
                            disabled={busy}
                            style={styles.secondaryButton}
                          >
                            開催前に戻す
                          </button>
                        )}
                      </div>
                    </div>
                    {isOverdueUncompleted(ev) && (
                      <div style={styles.warningBox}>
                        <p style={styles.warningTitle}>終了処理待ち</p>
                        <p style={styles.warningText}>
                          開催予定日を過ぎています。実施済みなら「終了にする」、中止なら「中止にする」で状態を更新してください。
                        </p>
                      </div>
                    )}
                    {renderEventSongList(ev, canApproveLiveApplications || canRejectLiveApplications)}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section style={styles.section}>
        <h2 style={styles.h2}>{canManageAnyLive ? "参加者向け表示" : "ライブ一覧"}</h2>
        <p style={styles.meta}>
          {canManageAnyLive
            ? "以下は一般メンバーと同じ見え方です。自分の参加意思や自動集計を確認できます。"
            : "自分の参加意思と、この月の参加状況を確認できます。"}
        </p>
        {events.length === 0 ? (
          <p style={styles.empty}>まだライブはありません</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {events.map((ev) => (
              <div key={ev.id} style={styles.card}>
                <div>
                  <div>
                    <h3 style={{ margin: 0 }}>{ev.name}</h3>
                    <p style={styles.meta}>
                      日付: {ev.event_date || "未定"} / 受付: {ev.entry_status} / 状態: {LIFECYCLE_LABELS[ev.lifecycle_status] || ev.lifecycle_status}
                    </p>
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <p style={styles.meta}>あなたの参加意思:</p>
                  <p style={styles.statusDescription}>
                    手動設定: {getStatusLabel(statuses[ev.id] || ev.current_user_status)}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setMyStatus(ev.id, opt.value)}
                        disabled={busy || ev.lifecycle_status !== "scheduled"}
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
                  {getConflictMessage(ev) && (
                    <div style={styles.warningBox}>
                      <p style={styles.warningTitle}>注意</p>
                      <p style={styles.warningText}>{getConflictMessage(ev)}</p>
                    </div>
                  )}
                  {ev.current_user_auto_labels.length > 0 && (
                    <div style={styles.autoSummaryBox}>
                      <p style={styles.autoSummaryTitle}>自動集計</p>
                      <ul style={styles.autoSummaryList}>
                        {ev.current_user_auto_labels.map((label) => (
                          <li key={label}>{label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {renderEventSongList(ev, false)}
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
  adminSection: { borderColor: "#c7d2fe", background: "#f8faff" },
  card: { padding: 16, border: "1px solid #d1d5db", borderRadius: 8 },
  adminActions: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  songList: { display: "grid", gap: 8, marginTop: 8 },
  songCard: {
    textAlign: "left",
    padding: 12,
    border: "1px solid #dbeafe",
    borderRadius: 8,
    background: "#f8fbff",
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
  songActions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 },
  primaryButton: {
    border: "1px solid #2563eb",
    borderRadius: 6,
    padding: "6px 12px",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #dc2626",
    borderRadius: 6,
    padding: "6px 12px",
    background: "#fff",
    color: "#dc2626",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "6px 12px",
    background: "#fff",
    color: "#0f172a",
    cursor: "pointer",
  },
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
  statusDescription: { margin: "4px 0 10px", color: "#1f2937", fontSize: 14, fontWeight: 600 },
  autoSummaryBox: {
    marginTop: 10,
    padding: "10px 12px",
    border: "1px solid #fde68a",
    borderRadius: 8,
    background: "#fffbeb",
  },
  autoSummaryTitle: { margin: "0 0 6px", color: "#92400e", fontSize: 13, fontWeight: 700 },
  autoSummaryList: { margin: 0, paddingLeft: 18, color: "#92400e", fontSize: 13 },
  warningBox: {
    marginTop: 10,
    padding: "10px 12px",
    border: "1px solid #fca5a5",
    borderRadius: 8,
    background: "#fef2f2",
  },
  warningTitle: { margin: "0 0 4px", color: "#b91c1c", fontSize: 13, fontWeight: 700 },
  warningText: { margin: 0, color: "#b91c1c", fontSize: 13, lineHeight: 1.5 },
  empty: { color: "#6b7280" },
  error: { color: "#dc2626" },
};
