import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

type PermissionMember = {
  user_id: string;
  user_name: string;
  role: string;
};

type PermissionAssignee = {
  user_id: string;
  user_name: string;
  is_owner: boolean;
  is_explicit: boolean;
};

type PermissionItem = {
  key: string;
  label: string;
  description?: string | null;
  assigned_users: PermissionAssignee[];
};

type PermissionSettingsResponse = {
  circle_id: string;
  current_user_id: string;
  current_user_permissions: string[];
  members: PermissionMember[];
  permissions: PermissionItem[];
};

export default function CirclePermissionSettings() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PermissionSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Record<string, string>>({});

  const reload = async () => {
    if (!circleId) return;
    setLoading(true);
    try {
      const response = await api.get<PermissionSettingsResponse>(`/circles/${circleId}/permission-settings`);
      setData(response);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId]);

  const currentUserPermissions = useMemo(
    () => new Set(data?.current_user_permissions || []),
    [data]
  );

  const togglePermission = async (permissionKey: string, userId: string, enabled: boolean) => {
    if (!circleId) return;
    setBusyKey(`${permissionKey}:${userId}`);
    setError("");
    try {
      await api.patch(`/circles/${circleId}/permissions/${permissionKey}`, {
        user_id: userId,
        enabled,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setBusyKey("");
    }
  };

  const setSelectedMember = (permissionKey: string, userId: string) => {
    setSelectedMembers((current) => ({ ...current, [permissionKey]: userId }));
  };

  if (loading) return <div style={styles.page}>読み込み中...</div>;
  if (error && !data) return <div style={styles.page}><p style={styles.error}>{error}</p></div>;
  if (!data) return null;

  return (
    <main style={styles.page}>
      <button onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
      <h1 style={styles.h1}>権限付与設定</h1>
      <p style={styles.meta}>
        ライブ運営と管理者操作ログの閲覧権限を、タスクごとに個別付与できます。代表者は常に全権限を持ちます。
      </p>
      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.permissionGrid}>
        {data.permissions.map((permission) => {
          const assignedIds = new Set(permission.assigned_users.map((user) => user.user_id));
          const canGrant = currentUserPermissions.has("grant_circle_permissions");
          const canRevoke = currentUserPermissions.has("revoke_circle_permissions");
          const selectableMembers = data.members.filter(
            (member) => member.role !== "owner" && !assignedIds.has(member.user_id)
          );
          const selectedMemberId = selectedMembers[permission.key] || "";

          return (
            <section key={permission.key} style={styles.card}>
              <h2 style={styles.h2}>{permission.label}</h2>
              {permission.description && <p style={styles.meta}>{permission.description}</p>}

              <div style={styles.currentSection}>
                <div style={styles.sectionLabel}>現在この権限を持つメンバー</div>
                {permission.assigned_users.length === 0 ? (
                  <p style={styles.empty}>まだいません</p>
                ) : (
                  <div style={styles.assignedList}>
                    {permission.assigned_users.map((user) => (
                      <div key={user.user_id} style={styles.assignedRow}>
                        <span style={styles.chip}>
                          {user.user_name}
                          {user.is_owner ? "（代表）" : ""}
                        </span>
                        {!user.is_owner && user.is_explicit && canRevoke && (
                          <button
                            type="button"
                            style={styles.secondaryButton}
                            disabled={busyKey === `${permission.key}:${user.user_id}`}
                            onClick={() => togglePermission(permission.key, user.user_id, false)}
                          >
                            外す
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canGrant && (
                <div style={styles.grantSection}>
                  <div style={styles.sectionLabel}>この権限を付与する</div>
                  {selectableMembers.length === 0 ? (
                    <p style={styles.empty}>付与できるメンバーはもういません</p>
                  ) : (
                    <div style={styles.grantControls}>
                      <select
                        value={selectedMemberId}
                        onChange={(e) => setSelectedMember(permission.key, e.target.value)}
                        style={styles.select}
                      >
                        <option value="">メンバーを選択</option>
                        {selectableMembers.map((member) => (
                          <option key={member.user_id} value={member.user_id}>
                            {member.user_name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        style={styles.primaryButton}
                        disabled={!selectedMemberId || busyKey === `${permission.key}:${selectedMemberId}`}
                        onClick={() => {
                          if (!selectedMemberId) return;
                          togglePermission(permission.key, selectedMemberId, true);
                        }}
                      >
                        与える
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(980px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  h1: { fontSize: 28, margin: "20px 0 8px" },
  h2: { margin: "0 0 8px", fontSize: 18 },
  meta: { color: "#64748b", marginTop: 0, lineHeight: 1.5 },
  error: { color: "#dc2626" },
  permissionGrid: { display: "grid", gap: 16, marginTop: 20 },
  card: { border: "1px solid #dbeafe", borderRadius: 12, padding: 16, background: "#fff" },
  currentSection: { marginTop: 12, marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "bold", color: "#475569", marginBottom: 8 },
  assignedList: { display: "grid", gap: 8 },
  assignedRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  chip: {
    borderRadius: 999,
    padding: "4px 10px",
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 13,
  },
  grantSection: { marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" },
  grantControls: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  select: {
    minWidth: 220,
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "8px 12px",
    background: "#fff",
    color: "#0f172a",
  },
  primaryButton: {
    border: "1px solid #2563eb",
    borderRadius: 6,
    padding: "8px 12px",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "8px 12px",
    background: "#fff",
    color: "#0f172a",
    cursor: "pointer",
  },
  empty: { color: "#64748b", margin: 0 },
};
