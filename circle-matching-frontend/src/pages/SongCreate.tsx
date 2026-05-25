import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

const PART_OPTIONS = ["Vo", "Gt", "Ba", "Dr", "Key", "Cho", "Other"];

type PartMode = "recruiting" | "self" | "circle_member" | "external_member";
type CircleMember = { id: string; name: string; parts: string[]; role?: string };
type CircleDetail = { id: string; name: string; members: CircleMember[] };
type CurrentUser = { id: string; name: string };
type PartSlot = {
  mode: PartMode;
  user_id: string;
  external_name: string;
};
type PartSetup = {
  part: string;
  enabled: boolean;
  slot_count: number;
  slots: PartSlot[];
  isCustom: boolean;
};

const MODE_OPTIONS: Array<{ value: PartMode; label: string }> = [
  { value: "recruiting", label: "募集中" },
  { value: "self", label: "自分" },
  { value: "circle_member", label: "サークル内メンバー" },
  { value: "external_member", label: "外部メンバー" },
];

function createSlot(mode: PartMode = "recruiting"): PartSlot {
  return {
    mode,
    user_id: "",
    external_name: "",
  };
}

function createPartSetup(part: string, isCustom = false): PartSetup {
  return {
    part,
    enabled: isCustom,
    slot_count: 1,
    slots: [createSlot()],
    isCustom,
  };
}

export default function SongCreate() {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [memo, setMemo] = useState("");
  const [timingMemo, setTimingMemo] = useState("");
  const [customPart, setCustomPart] = useState("");
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [partSetups, setPartSetups] = useState<PartSetup[]>(
    PART_OPTIONS.map((part) => createPartSetup(part))
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    if (!circleId) {
      setLoadingMembers(false);
      return;
    }

    setLoadingMembers(true);
    Promise.all([
      api.get<CircleDetail>(`/circles/${circleId}`),
      api.get<CurrentUser>("/me"),
    ])
      .then(([circle, me]) => {
        setMembers(circle.members);
        setCurrentUser(me);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "サークル情報の取得に失敗しました");
      })
      .finally(() => setLoadingMembers(false));
  }, [circleId]);

  const updatePartEnabled = (part: string, enabled: boolean) => {
    setPartSetups((current) =>
      current.map((setup) => {
        if (setup.part !== part) {
          return setup;
        }
        return {
          ...setup,
          enabled,
          slot_count: enabled ? Math.max(1, setup.slot_count) : 1,
          slots: enabled ? (setup.slots.length > 0 ? setup.slots : [createSlot()]) : [createSlot()],
        };
      })
    );
  };

  const updateSlotCount = (part: string, value: number) => {
    const slotCount = Math.max(1, value);
    setPartSetups((current) =>
      current.map((setup) => {
        if (setup.part !== part) {
          return setup;
        }
        return {
          ...setup,
          slot_count: slotCount,
          slots: Array.from({ length: slotCount }, (_, index) => setup.slots[index] ?? createSlot()),
        };
      })
    );
  };

  const updateSlot = (part: string, index: number, patch: Partial<PartSlot>) => {
    setPartSetups((current) =>
      current.map((setup) => {
        if (setup.part !== part) {
          return setup;
        }

        const slots = setup.slots.map((slot, slotIndex) => {
          if (slotIndex !== index) {
            return slot;
          }

          const next = { ...slot, ...patch };
          if (patch.mode === "recruiting") {
            next.user_id = "";
            next.external_name = "";
          } else if (patch.mode === "self") {
            next.user_id = "";
            next.external_name = "";
          } else if (patch.mode === "circle_member") {
            next.external_name = "";
          } else if (patch.mode === "external_member") {
            next.user_id = "";
          }
          return next;
        });

        return { ...setup, slots };
      })
    );
  };

  const removeSlot = (part: string, index: number) => {
    setPartSetups((current) =>
      current.map((setup) => {
        if (setup.part !== part || setup.slots.length <= 1) {
          return setup;
        }

        const slots = setup.slots.filter((_, slotIndex) => slotIndex !== index);
        return {
          ...setup,
          slot_count: slots.length,
          slots,
        };
      })
    );
  };

  const addCustomPart = () => {
    const part = customPart.trim();
    setError("");
    if (!part) {
      return;
    }
    if (partSetups.some((setup) => setup.part === part)) {
      setError("同じ名前のパートは追加できません");
      return;
    }
    setPartSetups((current) => [...current, createPartSetup(part, true)]);
    setCustomPart("");
  };

  const removeCustomPart = (part: string) => {
    setPartSetups((current) => current.filter((setup) => setup.part !== part));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!circleId) {
      setError("サークルIDが見つかりません");
      return;
    }

    const activeSetups = partSetups.filter((setup) => setup.enabled);
    if (activeSetups.length === 0) {
      setError("少なくとも1つのパート設定を選んでください");
      return;
    }

    for (const setup of activeSetups) {
      const seenUserIds = new Set<string>();
      for (const slot of setup.slots) {
        if (slot.mode === "self") {
          if (!currentUser) {
            setError("自分の情報を取得できていません。再読み込みしてからお試しください");
            return;
          }
          if (seenUserIds.has(currentUser.id)) {
            setError(`${setup.part} で同じメンバーは重複指定できません`);
            return;
          }
          seenUserIds.add(currentUser.id);
        }
        if (slot.mode === "circle_member") {
          if (!slot.user_id) {
            setError(`${setup.part} のサークル内メンバーを選択してください`);
            return;
          }
          if (seenUserIds.has(slot.user_id)) {
            setError(`${setup.part} で同じメンバーは重複指定できません`);
            return;
          }
          seenUserIds.add(slot.user_id);
        }
        if (slot.mode === "external_member" && !slot.external_name.trim()) {
          setError(`${setup.part} の外部メンバー名を入力してください`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      await api.post(`/circles/${circleId}/songs`, {
        title,
        artist,
        reference_url: referenceUrl,
        memo,
        timing_preference_memo: timingMemo,
        part_setups: activeSetups.map((setup) => ({
          part: setup.part,
          slot_count: setup.slot_count,
          slots: setup.slots.map((slot) => ({
            mode: slot.mode,
            user_id: slot.user_id || undefined,
            external_name: slot.external_name.trim() || undefined,
          })),
        })),
      });
      navigate(`/circles/${circleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "曲の起票に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={styles.page}>
      <button type="button" onClick={() => navigate(`/circles/${circleId}`)}>戻る</button>
      <h2 style={styles.title}>曲起票</h2>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          曲名
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} required />
        </label>

        <label style={styles.label}>
          アーティスト名
          <input value={artist} onChange={(e) => setArtist(e.target.value)} style={styles.input} required />
        </label>

        <label style={styles.label}>
          YouTube / 参考音源URL
          <input
            type="url"
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          メモ
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} style={styles.textarea} rows={3} />
        </label>

        <label style={styles.label}>
          出演時期の希望メモ (例: 9月以降希望 / 7月は不可)
          <textarea
            value={timingMemo}
            onChange={(e) => setTimingMemo(e.target.value)}
            style={styles.textarea}
            rows={2}
          />
        </label>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h3 style={styles.sectionTitle}>パート設定</h3>
              <p style={styles.help}>
                使うパートだけONにして、各枠ごとに募集中・自分・サークル内メンバー・外部メンバーを選べます。
              </p>
            </div>
            {loadingMembers && <span style={styles.help}>メンバー読み込み中...</span>}
          </div>

          <div style={styles.partTable}>
            {partSetups.map((setup) => (
              <div key={setup.part} style={styles.partRow}>
                <div style={styles.partHeader}>
                  <div style={styles.partNameCell}>
                    <strong>{setup.part}</strong>
                    <label style={styles.toggleLabel}>
                      <input
                        type="checkbox"
                        checked={setup.enabled}
                        onChange={(e) => updatePartEnabled(setup.part, e.target.checked)}
                      />
                      このパートを使う
                    </label>
                    {setup.isCustom && (
                      <button
                        type="button"
                        onClick={() => removeCustomPart(setup.part)}
                        style={styles.removeButton}
                      >
                        削除
                      </button>
                    )}
                  </div>

                  {setup.enabled && (
                    <div style={styles.inlineField}>
                      <span style={styles.help}>枠数</span>
                      <input
                        type="number"
                        min={1}
                        value={setup.slot_count}
                        onChange={(e) => updateSlotCount(setup.part, parseInt(e.target.value || "1", 10))}
                        style={styles.numberInput}
                      />
                    </div>
                  )}
                </div>

                {setup.enabled ? (
                  <div style={styles.slotList}>
                     {setup.slots.map((slot, index) => (
                       <div key={`${setup.part}-${index}`} style={styles.slotRow}>
                         <div style={styles.slotLabel}>枠 {index + 1}</div>
                         <select
                           value={slot.mode}
                          onChange={(e) => updateSlot(setup.part, index, { mode: e.target.value as PartMode })}
                          style={styles.input}
                        >
                          {MODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <div>
                          {slot.mode === "recruiting" && (
                            <span style={styles.help}>この枠を募集します。</span>
                          )}

                          {slot.mode === "circle_member" && (
                            <select
                              value={slot.user_id}
                              onChange={(e) => updateSlot(setup.part, index, { user_id: e.target.value })}
                              style={styles.input}
                            >
                              <option value="">メンバーを選択</option>
                              {members.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name} {member.parts.length > 0 ? `(${member.parts.join("/")})` : "(担当未設定)"}
                                </option>
                              ))}
                              </select>
                          )}

                          {slot.mode === "self" && (
                            <span style={styles.help}>
                              この枠は{currentUser?.name ? ` ${currentUser.name} さん` : " 自分"}が担当します。
                            </span>
                          )}

                          {slot.mode === "external_member" && (
                            <input
                              value={slot.external_name}
                              onChange={(e) => updateSlot(setup.part, index, { external_name: e.target.value })}
                              placeholder="外部メンバー名"
                              style={styles.input}
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSlot(setup.part, index)}
                          disabled={setup.slots.length <= 1}
                          style={{
                            ...styles.slotRemoveButton,
                            ...(setup.slots.length <= 1 ? styles.slotRemoveButtonDisabled : {}),
                          }}
                        >
                          消す
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={styles.help}>このパートは今回使いません。</span>
                )}
              </div>
            ))}
          </div>

          <div style={styles.customPartRow}>
            <input
              value={customPart}
              onChange={(e) => setCustomPart(e.target.value)}
              placeholder="自由入力パートを追加"
              style={styles.input}
            />
            <button type="button" onClick={addCustomPart}>追加</button>
          </div>
        </section>

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" disabled={submitting} style={styles.submit}>
          {submitting ? "保存中..." : "起票する"}
        </button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "min(900px, calc(100vw - 32px))", margin: "32px auto", textAlign: "left" },
  title: { margin: "20px 0", fontSize: 28 },
  form: { display: "grid", gap: 18 },
  section: { display: "grid", gap: 12 },
  sectionHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  label: { display: "grid", gap: 6, fontWeight: 600 },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 16 },
  numberInput: { width: 90, padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 16 },
  textarea: { width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 16, resize: "vertical" },
  sectionTitle: { margin: 0, fontSize: 18 },
  help: { margin: 0, color: "#4b5563", fontSize: 14 },
  partTable: { display: "grid", gap: 12 },
  partRow: {
    display: "grid",
    gap: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 12,
    background: "#fff",
  },
  partHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  partNameCell: { display: "flex", flexDirection: "column", gap: 6 },
  toggleLabel: { display: "flex", alignItems: "center", gap: 6, color: "#334155", fontSize: 14 },
  slotList: { display: "grid", gap: 10 },
  slotRow: {
    display: "grid",
    gridTemplateColumns: "80px minmax(180px, 220px) minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "center",
    borderTop: "1px solid #f1f5f9",
    paddingTop: 10,
  },
  slotLabel: { fontWeight: 600, color: "#334155" },
  inlineField: { display: "flex", alignItems: "center", gap: 10 },
  customPartRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10 },
  removeButton: {
    width: "fit-content",
    border: "none",
    background: "transparent",
    color: "#dc2626",
    padding: 0,
    cursor: "pointer",
  },
  slotRemoveButton: {
    width: "fit-content",
    border: "1px solid #fecaca",
    background: "#fff5f5",
    color: "#dc2626",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
  },
  slotRemoveButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  error: { color: "#dc2626", whiteSpace: "pre-wrap" },
  submit: { width: "fit-content" },
};
