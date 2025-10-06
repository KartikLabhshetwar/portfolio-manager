import { NextResponse } from "next/server";

async function fetchStooqCsv(symbol: string): Promise<string | null> {
  const sym = symbol.toLowerCase().replace(/\s+/g, "");
  const candidates = [sym, `${sym}.us`];
  for (const s of candidates) {
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const text = await res.text();
      if (text && text.includes("Date,Open,High,Low,Close,Volume")) return text;
    }
  }
  return null;
}

async function resolveTicker(query: string): Promise<string> {
  const q = query.trim();
  if (/^[a-zA-Z.]{1,6}$/.test(q)) return q.toUpperCase();
  // Fallback: Yahoo Finance search (server-side; CORS-safe)
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=1&newsCount=0`; 
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const symbol = data?.quotes?.[0]?.symbol;
      if (typeof symbol === "string" && symbol) return symbol;
    }
  } catch {}
  return q;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbolOrQuery = (url.searchParams.get("symbol") || "").trim();
  const date = (url.searchParams.get("date") || "").trim(); // YYYY-MM-DD
  if (!symbolOrQuery || !date) {
    return NextResponse.json({ error: "symbol and date required" }, { status: 400 });
  }

  const resolvedSymbol = await resolveTicker(symbolOrQuery);
  const csv = await fetchStooqCsv(resolvedSymbol);
  if (!csv) return NextResponse.json({ error: "symbol not found" }, { status: 404 });
  const lines = csv.split(/\r?\n/).slice(1).filter(Boolean);
  // Build list of {date, close}
  const entries = lines.map((line) => {
    const [d, _o, _h, _l, c] = line.split(",");
    const close = Number(c);
    return { d, close } as { d: string; close: number };
  }).filter((e) => Number.isFinite(e.close));

  // Find the most recent entry on or before requested date
  const target = new Date(date);
  if (isNaN(target.getTime())) return NextResponse.json({ error: "invalid date" }, { status: 400 });
  // Stooq dates are in YYYY-MM-DD sorted ascending; pick the last <= date
  let chosen: { d: string; close: number } | undefined;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.d <= date) { chosen = e; break; }
  }
  // If request is earlier than first available, choose the first
  if (!chosen && entries.length) chosen = entries[0];
  if (!chosen) return NextResponse.json({ error: "no price data" }, { status: 404 });
  return NextResponse.json({ close: chosen.close, date: chosen.d, symbol: resolvedSymbol });
}


