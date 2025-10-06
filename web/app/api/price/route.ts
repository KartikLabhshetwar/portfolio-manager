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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "").trim();
  const date = (url.searchParams.get("date") || "").trim(); // YYYY-MM-DD
  if (!symbol || !date) {
    return NextResponse.json({ error: "symbol and date required" }, { status: 400 });
  }

  const csv = await fetchStooqCsv(symbol);
  if (!csv) return NextResponse.json({ error: "symbol not found" }, { status: 404 });
  const lines = csv.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const [d, _o, _h, _l, c] = line.split(",");
    if (d === date) {
      const close = Number(c);
      if (Number.isFinite(close)) return NextResponse.json({ close });
    }
  }
  return NextResponse.json({ error: "price not available for date" }, { status: 404 });
}


