import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

type AuthMode = "login" | "signup";
type LoginResponse = { access_token: string; token_type: string };
const PUBLIC_SIGNUP_ENABLED =
  (import.meta.env.VITE_PUBLIC_SIGNUP_ENABLED ?? "false").toLowerCase() === "true";

export default function Login({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(PUBLIC_SIGNUP_ENABLED ? initialMode : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === "signup" && !PUBLIC_SIGNUP_ENABLED) {
      return;
    }
    setMode(nextMode);
    setError("");
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (mode === "login") {
        const data = await api.postForm<LoginResponse>("/login", {
          username: email.trim(),
          password,
        });
        localStorage.setItem("token", data.access_token);
        navigate("/home");
        return;
      }

      if (!PUBLIC_SIGNUP_ENABLED) {
        throw new Error("現在は公開デモ中のため新規登録を停止しています");
      }

      await api.post("/signup", {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      setMode("login");
      setPassword("");
      setMessage("登録しました。続けてログインしてください。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "認証に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div className="card" style={{ width: "min(400px, 100%)" }}>
        <div className="flex-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "24px" }}>
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={mode === "login" ? "btn-primary btn-pill" : "btn-outline btn-pill"}
          >
            ログイン
          </button>
          {PUBLIC_SIGNUP_ENABLED ? (
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={mode === "signup" ? "btn-primary btn-pill" : "btn-outline btn-pill"}
            >
              新規登録
            </button>
          ) : (
            <div className="btn-ghost btn-pill" style={{ opacity: 0.5, cursor: "not-allowed", textAlign: "center", fontSize: "0.8rem" }}>
              新規登録停止中
            </div>
          )}
        </div>

        <h2 className="h2" style={{ textAlign: "center", marginBottom: "24px" }}>
          {mode === "login" ? "おかえりなさい！ 😊" : "はじめまして！ ✨"}
        </h2>

        <form onSubmit={handleSubmit} className="flex-col">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="表示名（例: たろう）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={submitting} className="btn-primary mt-md">
            {submitting ? "送信中..." : mode === "login" ? "ログインする" : "登録して始める"}
          </button>
        </form>

        {message && <p className="mt-md" style={{ color: "var(--color-success)", textAlign: "center" }}>{message}</p>}
        {error && <p className="mt-md text-error" style={{ textAlign: "center" }}>{error}</p>}
        {!PUBLIC_SIGNUP_ENABLED && (
          <p className="text-subtle mt-lg" style={{ textAlign: "center", fontSize: "0.8rem" }}>
            現在は公開デモ中のため新規登録を停止しています。
          </p>
        )}
      </div>
    </main>
  );
}
