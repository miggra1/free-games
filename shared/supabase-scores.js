(() => {
  const SUPABASE_URL = "https://etaedrixhwtcfykczram.supabase.co";
  const SUPABASE_KEY = "sb_publishable_F3CdHW5XABUrO-Fc4TAeVA_UVpnYen3";
  const TABLE = "game_scores";
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  let clientPromise = null;

  function cleanName(name) {
    const value = String(name || "").trim();
    return value.slice(0, 24) || "匿名玩家";
  }

  function loadSupabaseSdk() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);

    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SDK_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(window.supabase), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve(window.supabase);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = loadSupabaseSdk().then((sdk) => sdk.createClient(SUPABASE_URL, SUPABASE_KEY));
    }
    return clientPromise;
  }

  async function saveScore(score) {
    if (!score || !score.game_key) return false;
    const payload = {
      game_key: String(score.game_key),
      player_name: cleanName(score.player_name),
      score: Number(score.score) || 0,
      level: Number(score.level) || 1,
      won: Boolean(score.won),
      time_used: score.time_used == null ? null : Number(score.time_used),
      remaining: score.remaining == null ? null : Number(score.remaining),
      best_combo: score.best_combo == null ? null : Number(score.best_combo),
      detail: score.detail || {},
    };

    try {
      const client = await getClient();
      const { error } = await client.from(TABLE).insert(payload);
      if (error) throw error;
      return true;
    } catch (error) {
      console.warn("Score sync failed. Check Supabase policies and API key.", error);
      return false;
    }
  }

  async function getBestScore(gameKey) {
    if (!gameKey) return null;
    try {
      const client = await getClient();
      const { data, error } = await client
        .from(TABLE)
        .select("*")
        .eq("game_key", String(gameKey))
        .order("score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data || null;
    } catch (error) {
      console.warn("Best score sync failed. Local score will be used.", error);
      return null;
    }
  }

  window.FreeGamesScores = {
    saveScore,
    getBestScore,
  };
})();
