export type SharePreferences = {
  password: string;
  expireInMinutes: number | null;
};

const STORAGE_KEY = "portfolio_share_preferences";

export function loadSharePreferences(): SharePreferences {
  if (typeof window === "undefined") return { password: "", expireInMinutes: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { password: "", expireInMinutes: null };
    const parsed = JSON.parse(raw) as Partial<SharePreferences>;
    return {
      password: parsed.password ?? "",
      expireInMinutes: parsed.expireInMinutes ?? null,
    };
  } catch {
    return { password: "", expireInMinutes: null };
  }
}

export function saveSharePreferences(prefs: SharePreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}


