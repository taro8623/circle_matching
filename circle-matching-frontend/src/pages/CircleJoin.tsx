import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function CircleJoin() {
  const navigate = useNavigate();
  const [circleName, setCircleName] = useState("");
  const [circlePassword, setCirclePassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const data = await api.post<{ message: string; circle_id: string }>("/circles/join", {
        circle_name: circleName.trim(),
        join_password: circlePassword,
      });
      setMessage(data.message);
      navigate(`/circles/${data.circle_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "サークル参加に失敗しました");
    }
  }

  return (
    <main className="container" style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
      <div className="card" style={{ width: "min(400px, 100%)" }}>
        <h2 className="h2" style={{ textAlign: "center", marginBottom: "24px" }}>🤝 サークルに参加</h2>
        <form onSubmit={handleSubmit} className="flex-col">
          <div>
            <label className="text-subtle" style={{ fontSize: "0.9rem", display: "block", marginBottom: "4px" }}>サークル名</label>
            <input
              type="text"
              value={circleName}
              onChange={(e) => setCircleName(e.target.value)}
              placeholder="例: Circle Matching Demo"
              required
            />
          </div>
          <div>
            <label className="text-subtle" style={{ fontSize: "0.9rem", display: "block", marginBottom: "4px" }}>参加パスワード</label>
            <input
              type="password"
              value={circlePassword}
              onChange={(e) => setCirclePassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary mt-md">
            参加する
          </button>
        </form>
        {message && <p className="mt-md" style={{ color: "var(--color-success)", textAlign: "center" }}>{message}</p>}
        {error && <p className="mt-md text-error" style={{ textAlign: "center" }}>{error}</p>}
        <div className="mt-lg" style={{ textAlign: "center" }}>
          <button className="btn-ghost" onClick={() => navigate(-1)}>
            ← 戻る
          </button>
        </div>
      </div>
    </main>
  );
}
