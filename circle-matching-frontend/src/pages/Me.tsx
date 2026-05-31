import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import NotificationButton from "../components/NotificationButton";
import { api } from "../api";

const PART_OPTIONS = ["Vo", "Gt", "Ba", "Dr", "Key", "Cho", "Other"];

type MeResponse = {
  name: string;
  parts: string[];
  bio?: string | null;
  favorite_artists?: string[];
};

type CircleSummary = {
  id: string;
  name: string;
};

export default function MePage() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [parts, setParts] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [favoriteArtists, setFavoriteArtists] = useState<string[]>([]);
  const [artistSearchKeyword, setArtistSearchKeyword] = useState("");
  const [artistSearchResults, setArtistSearchResults] = useState<Array<{
    artist_name: string;
    artwork_url?: string | null;
    artist_view_url?: string | null;
    primary_genre_name?: string | null;
  }>>([]);
  const [customPart, setCustomPart] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchingArtists, setSearchingArtists] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [me, myCircles] = await Promise.all([
          api.get<MeResponse>("/me"),
          api.get<CircleSummary[]>("/me/circles"),
        ]);
        setUserName(me.name || "");
        setParts(Array.isArray(me.parts) ? me.parts : []);
        setBio(me.bio ?? "");
        setFavoriteArtists(Array.isArray(me.favorite_artists) ? me.favorite_artists : []);
        setCircles(Array.isArray(myCircles) ? myCircles : []);
      } catch {
        setError("プロフィール取得に失敗しました");
      }
    };

    load();
  }, []);

  const togglePart = (part: string) => {
    setParts((current) =>
      current.includes(part) ? current.filter((item) => item !== part) : [...current, part]
    );
  };

  const addCustomPart = () => {
    const part = customPart.trim();
    if (!part || parts.includes(part)) return;
    setParts((current) => [...current, part]);
    setCustomPart("");
  };

  const saveProfile = async () => {
    setProfileMessage("");
    setError("");
    const normalizedBio = bio.trim();

    if (!normalizedBio) {
      setError("自己紹介は必須です。メンバー検索時にも表示されます。");
      return;
    }

    try {
      setSaving(true);
      const [profile, partsResponse] = await Promise.all([
        api.put<MeResponse>("/me/profile", { bio: normalizedBio, favorite_artists: favoriteArtists }),
        api.put<{ parts: string[] }>("/me/parts", { parts }),
      ]);
      setBio(profile.bio ?? normalizedBio);
      setFavoriteArtists(Array.isArray(profile.favorite_artists) ? profile.favorite_artists : favoriteArtists);
      setParts(partsResponse.parts || parts);
      setProfileMessage("プロフィールを保存しました！ ✨");
    } catch (err) {
      setError(err instanceof Error ? err.message : "プロフィールの保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const searchArtists = async () => {
    const query = artistSearchKeyword.trim();
    if (!query) return;
    setSearchingArtists(true);
    setError("");
    try {
      const response = await api.get<{
        query: string;
        results: Array<{
          artist_name: string;
          artwork_url?: string | null;
          artist_view_url?: string | null;
          primary_genre_name?: string | null;
        }>;
      }>(`/artists/public-search?q=${encodeURIComponent(query)}`);
      setArtistSearchResults(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アーティスト検索に失敗しました");
    } finally {
      setSearchingArtists(false);
    }
  };

  const addFavoriteArtist = (artistName: string) => {
    const normalized = artistName.trim();
    if (!normalized || favoriteArtists.includes(normalized)) return;
    setFavoriteArtists((current) => [...current, normalized]);
    setProfileMessage("");
  };

  const removeFavoriteArtist = (artistName: string) => {
    setFavoriteArtists((current) => current.filter((artist) => artist !== artistName));
    setProfileMessage("");
  };

  return (
    <main className="container">
      <div className="flex-row justify-between">
        <button className="btn-ghost" onClick={() => navigate("/home")}>← ホーム</button>
        <NotificationButton />
      </div>

      <div className="mt-lg">
        <h1 className="h1">{userName || "..."} さんのプロフィール 👤</h1>
        <p className="text-subtle mt-sm">サークル内でのあなたの表示設定です。</p>
      </div>

      <section className="card mt-xl">
        <h2 className="h3">📝 自己紹介 <span className="text-error">*</span></h2>
        <p className="text-subtle mt-sm" style={{ fontSize: "0.85rem" }}>
          メンバー一覧などに表示されます。得意なジャンルややりたい曲などを自由に書いてください。
        </p>
        <textarea
          className="mt-md"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="例: ロックとファンクが好きです！週末に活動したいです。"
          rows={5}
        />
      </section>

      <section className="card mt-lg">
        <h2 className="h3">🎸 担当パート</h2>
        <p className="text-subtle mt-sm" style={{ fontSize: "0.85rem" }}>募集への応募時に選択できるパートです。</p>
        <div className="flex-row mt-md" style={{ flexWrap: "wrap", gap: "8px" }}>
          {PART_OPTIONS.map((part) => (
            <button
              key={part}
              type="button"
              className={parts.includes(part) ? "btn-primary btn-pill" : "btn-outline btn-pill"}
              onClick={() => togglePart(part)}
              style={{ padding: "8px 16px", fontSize: "0.9rem" }}
            >
              {part}
            </button>
          ))}
        </div>
        <div className="flex-row mt-md">
          <input
            value={customPart}
            onChange={(event) => setCustomPart(event.target.value)}
            placeholder="その他自由入力パート"
            style={{ flex: 1 }}
          />
          <button type="button" className="btn-outline" onClick={addCustomPart}>追加</button>
        </div>
        {parts.length > 0 && (
          <p className="text-subtle mt-md">
            選択中: <strong>{parts.join(", ")}</strong>
          </p>
        )}
      </section>

      <section className="card mt-lg">
        <h2 className="h3">🎨 好きなアーティスト</h2>
        <p className="text-subtle mt-sm" style={{ fontSize: "0.85rem" }}>好みの合うメンバーを見つける手がかりになります。</p>
        
        <div className="flex-row mt-md" style={{ flexWrap: "wrap", gap: "8px" }}>
          {favoriteArtists.map((artist) => (
            <span key={artist} className="badge badge-primary" style={{ padding: "6px 12px", gap: "8px" }}>
              {artist}
              <button
                type="button"
                onClick={() => removeFavoriteArtist(artist)}
                style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: "1.1rem" }}
              >
                ×
              </button>
            </span>
          ))}
          {favoriteArtists.length === 0 && <p className="text-subtle" style={{ fontSize: "0.9rem" }}>まだ登録していません</p>}
        </div>

        <div className="flex-row mt-lg">
          <input
            value={artistSearchKeyword}
            onChange={(event) => setArtistSearchKeyword(event.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchArtists()}
            placeholder="好きなアーティストを検索"
            style={{ flex: 1 }}
          />
          <button type="button" className="btn-primary" onClick={searchArtists} disabled={searchingArtists}>
            {searchingArtists ? "..." : "検索"}
          </button>
        </div>

        {artistSearchResults.length > 0 && (
          <div className="grid-list mt-md">
            {artistSearchResults.map((artist) => (
              <button
                key={`${artist.artist_name}-${artist.artist_view_url || ""}`}
                type="button"
                className="card card-interactive"
                onClick={() => addFavoriteArtist(artist.artist_name)}
                style={{ padding: "12px", display: "grid", gridTemplateColumns: artist.artwork_url ? "50px 1fr auto" : "1fr auto", gap: "12px", alignItems: "center" }}
              >
                {artist.artwork_url && (
                  <img src={artist.artwork_url} alt="" style={{ width: 50, height: 50, borderRadius: "8px" }} />
                )}
                <div style={{ textAlign: "left" }}>
                  <strong style={{ fontSize: "0.9rem" }}>{artist.artist_name}</strong>
                  <p className="text-subtle" style={{ fontSize: "0.75rem" }}>{artist.primary_genre_name}</p>
                </div>
                <span className="badge badge-outline">追加</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="mt-xl">
        <button type="button" className="btn-primary" style={{ width: "100%", padding: "16px" }} onClick={saveProfile} disabled={saving}>
          {saving ? "保存中..." : "プロフィールを保存する ✨"}
        </button>
        {profileMessage && <p className="mt-md" style={{ color: "var(--color-success)", textAlign: "center" }}>{profileMessage}</p>}
        {error && <p className="mt-md text-error" style={{ textAlign: "center" }}>{error}</p>}
      </div>

      <section className="card mt-xl" style={{ backgroundColor: "var(--color-bg)" }}>
        <h2 className="h3">🏠 参加サークル</h2>
        <div className="grid-list mt-md">
          {circles.length === 0 ? (
            <p className="text-subtle">参加しているサークルはありません</p>
          ) : (
            circles.map((circle) => (
              <button key={circle.id} className="btn-outline btn-pill justify-between" onClick={() => navigate(`/circles/${circle.id}`)}>
                {circle.name} <span>→</span>
              </button>
            ))
          )}
        </div>
        <div className="flex-row mt-lg" style={{ flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={() => navigate("/circle/join")}>＋ サークルに参加</button>
          <button className="btn-ghost" onClick={() => navigate("/circle/create")}>＋ 新しく作成</button>
        </div>
      </section>

      <div className="mt-xl" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "24px", textAlign: "center" }}>
        <button onClick={handleLogout} className="btn-danger btn-ghost btn-pill">
          ログアウトする
        </button>
      </div>
    </main>
  );
}
