import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function CreateCirclePage() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleCreate = async () => {
    setSubmitting(true);
    setError("");
    try {
      const data = await api.post<{ message: string; circle_id: string }>("/circles", {
        name,
        join_password: password,
        description,
      });
      navigate(`/circles/${data.circle_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "サークル作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>サークル作成</h2>

      <label>サークル名</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />

      <label>参加パスワード</label>
      <input value={password} onChange={(e) => setPassword(e.target.value)} />

      <label>説明</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <button onClick={handleCreate} disabled={submitting}>
        {submitting ? "作成中..." : "作成する"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <br />
      <button onClick={() => navigate("/me")}>← ログイン直後の画面に戻る</button>
    </div>
  );
}
