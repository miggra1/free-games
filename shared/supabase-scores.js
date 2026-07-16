(() => {
  const SUPABASE_URL = "https://etaedrixhwtcfykczram.supabase.co";
  const SUPABASE_KEY = "sb_publishable_F3CdHW5XABUrO-Fc4TAeVA_UVpnYen3";
  const TABLE = "game_scores";
  const ENDPOINT = `${SUPABASE_URL}/rest/v1/${TABLE}`;

  const baseHeaders = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };

  function cleanName(name) {
    const value = String(name || "").trim();
    return value.slice(0, 24) || "匿名玩家";
  }

  async function request(path, options = {}) {
    const response = await fetch(`${ENDPOINT}${path}`, {
      ...options,
      headers: {
        ...baseHeaders,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`Supabase ${response.status}: ${message}`);
    }

    if (response.status === 204) return null;
    return response.json().catch(() => null);
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
      await request("", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });
      return true;
    } catch (error) {
      console.warn("Score sync failed. Run the Supabase table SQL first.", error);
      return false;
    }
  }

  async function getBestScore(gameKey) {
    if (!gameKey) return null;
    const key = encodeURIComponent(String(gameKey));
    const query = `?game_key=eq.${key}&select=*&order=score.desc,created_at.desc&limit=1`;
    try {
      const rows = await request(query, {
        headers: { Accept: "application/json" },
      });
      return Array.isArray(rows) ? rows[0] || null : null;
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
