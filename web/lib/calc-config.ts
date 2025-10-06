export type CalculationPreferences = {
  currencySymbol: string;
  expectedAnnualReturnPct?: number; // e.g., 8 for 8%
};

export type CalculationSnapshot = {
  totalValue: number;
  avgBuyPrice: number;
  totalQuantity: number;
  savedAt: string; // ISO string
};

const PREFS_KEY = "portfolio_calc_prefs";
const SNAPSHOT_KEY = "portfolio_calc_snapshot";

export function loadCalculationPreferences(): CalculationPreferences {
  if (typeof window === "undefined") return { currencySymbol: "₹", expectedAnnualReturnPct: 8 };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { currencySymbol: "₹", expectedAnnualReturnPct: 8 };
    const parsed = JSON.parse(raw) as Partial<CalculationPreferences>;
    return {
      currencySymbol: parsed.currencySymbol ?? "₹",
      expectedAnnualReturnPct: parsed.expectedAnnualReturnPct ?? 8,
    };
  } catch {
    return { currencySymbol: "$", expectedAnnualReturnPct: 8 };
  }
}

export function saveCalculationPreferences(prefs: CalculationPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function loadCalculationSnapshot(): CalculationSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CalculationSnapshot;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCalculationSnapshot(snapshot: CalculationSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}


