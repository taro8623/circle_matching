import React, { useState } from "react";

export default function Me() {
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState("");

  const fetchMe = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("トークンがありません。ログインしてください。");
      return;
    }

    const res = await fetch("http://localhost:8000/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      setError("認証エラー。ログインし直してください。");
      return;
    }

    const data = await res.json();
    setUser(data);
  };

  return (
    <div>
      <h2>/me のテスト</h2>
      <button onClick={fetchMe}>ユーザー情報を取得</button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {user && (
        <div>
          <p>ID: {user.id}</p>
          <p>名前: {user.name}</p>
          <p>Email: {user.email}</p>
        </div>
      )}
    </div>
  );
}
