import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

type AuthMode = "login" | "signup";
type LoginResponse = { access_token: string; token_type: string };

export default function Login({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const switchMode = (nextMode: AuthMode) => {
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
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.switcher}>
          <button
            type="button"
            onClick={() => switchMode("login")}
            style={mode === "login" ? styles.activeTab : styles.tab}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            style={mode === "signup" ? styles.activeTab : styles.tab}
          >
            新規登録
          </button>
        </div>

        <h2 style={styles.title}>{mode === "login" ? "ログイン" : "新規登録"}</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "signup" && (
            <input
              type="text"
              placeholder="ユーザ名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              required
            />
          )}

          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />

          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />

          <button type="submit" disabled={submitting} style={styles.submit}>
            {submitting ? "送信中..." : mode === "login" ? "ログイン" : "登録する"}
          </button>
        </form>

        {message && <p style={styles.message}>{message}</p>}
        {error && <p style={styles.error}>{error}</p>}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background: "#f8fafc",
  },
  card: {
    width: "min(420px, 100%)",
    padding: "24px",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    background: "#fff",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
  },
  switcher: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginBottom: "20px",
  },
  tab: {
    padding: "10px 12px",
    borderRadius: "999px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    cursor: "pointer",
  },
  activeTab: {
    padding: "10px 12px",
    borderRadius: "999px",
    border: "1px solid #2563eb",
    borderWidth: "1px",
    borderStyle: "solid",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  title: {
    margin: "0 0 16px",
    fontSize: "28px",
    textAlign: "center",
  },
  form: {
    display: "grid",
    gap: "12px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    fontSize: "16px",
  },
  submit: {
    marginTop: "8px",
    padding: "12px",
    border: "none",
    borderRadius: "10px",
    background: "#2563eb",
    color: "#fff",
    fontSize: "16px",
    cursor: "pointer",
  },
  error: {
    marginTop: "14px",
    color: "#dc2626",
    whiteSpace: "pre-wrap",
  },
  message: {
    marginTop: "14px",
    color: "#15803d",
  },
};
