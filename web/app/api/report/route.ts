import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const portfolioId = url.searchParams.get("portfolioId");
  const where = portfolioId ? ({ portfolioId: Number(portfolioId) } as any) : undefined;
  const stocks = await prisma.stock.findMany({ where });
  const totalValue = stocks.reduce((sum, s) => sum + s.quantity * s.buyPrice, 0);
  const totalQty = stocks.reduce((sum, s) => sum + s.quantity, 0);
  const avgBuy = totalQty === 0 ? 0 : totalValue / totalQty;
  // Projection using expected annual return percentage from client defaults (fallback 8%).
  const expectedAnnualReturnPct = 8; // Server-side default; client can override in UI for display
  const projectedOneYear = totalValue * Math.pow(1 + expectedAnnualReturnPct / 100, 1);

  // --- Enrich with YoY based on market data ---
  async function resolveTicker(query: string): Promise<string> {
    const q = (query || "").trim();
    if (/^[a-zA-Z.]{1,8}$/.test(q)) return q.toUpperCase();
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=1&newsCount=0`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const sym = data?.quotes?.[0]?.symbol;
        if (typeof sym === "string" && sym) return sym;
      }
    } catch {}
    return q.toUpperCase();
  }

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

  function findCloseOnOrBefore(csv: string, targetYmd: string): number | null {
    const lines = csv.split(/\r?\n/).slice(1).filter(Boolean);
    let chosen: number | null = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      const [d, _o, _h, _l, c] = lines[i].split(",");
      if (d <= targetYmd) {
        const close = Number(c);
        if (Number.isFinite(close)) { chosen = close; }
        break;
      }
    }
    if (chosen == null && lines.length) {
      const [_d, _o, _h, _l, c] = lines[0].split(",");
      const close = Number(c);
      if (Number.isFinite(close)) chosen = close;
    }
    return chosen;
  }

  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(today.getFullYear() - 1);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const yearAgoYmd = ymd(yearAgo);

  const enriched = await Promise.all(
    stocks.map(async (s) => {
      try {
        const symbol = await resolveTicker(s.name);
        const csv = await fetchStooqCsv(symbol);
        if (!csv) return { s, symbol, latest: null as number | null, lastYear: null as number | null };
        // latest: last line
        const lines = csv.split(/\r?\n/).slice(1).filter(Boolean);
        const last = lines[lines.length - 1];
        const latest = last ? Number(last.split(",")[4]) : null;
        const lastYear = findCloseOnOrBefore(csv, yearAgoYmd);
        return { s, symbol, latest: Number.isFinite(latest!) ? latest : null, lastYear };
      } catch {
        return { s, symbol: s.name, latest: null as number | null, lastYear: null as number | null };
      }
    })
  );

  const rows = enriched.map((e) => {
    const yoy = e.latest != null && e.lastYear != null && e.lastYear !== 0
      ? ((e.latest - e.lastYear) / e.lastYear) * 100
      : null;
    const latestValue = e.latest != null ? e.latest * e.s.quantity : e.s.quantity * e.s.buyPrice;
    return { name: e.s.name, qty: e.s.quantity, buyPrice: e.s.buyPrice, latest: e.latest, lastYear: e.lastYear, yoy, latestValue };
  });

  const totalLatestValue = rows.reduce((sum, r) => sum + (r.latestValue || 0), 0);
  const weightedYoY = (() => {
    const acc = rows.reduce((sum, r) => sum + (r.yoy != null ? (r.latestValue || 0) * (r.yoy / 100) : 0), 0);
    return totalLatestValue ? (acc / totalLatestValue) * 100 : null;
  })();
  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; color: #111827; }
        header { border-bottom: 2px solid #2563EB; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: baseline; }
        .brand { font-weight: 700; color: #111827; }
        .title { font-size: 20px; color: #2563EB; }
        .sub { color: #6B7280; }
        .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0 24px; }
        .card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; }
        .label { color: #6B7280; font-size: 12px; }
        .value { font-size: 18px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; font-size: 12px; }
        th { background: #F3F4F6; }
        tfoot td { font-weight: 700; }
      </style>
    </head>
    <body>
      <header>
        <div class="brand">Portfolio Manager</div>
        <div class="title">Stock Entry Report</div>
        <div class="sub">${new Date().toLocaleDateString()}</div>
      </header>
      <div class="cards">
        <div class="card"><div class="label">Total Value</div><div class="value">${totalValue.toFixed(2)}</div></div>
        <div class="card"><div class="label">Average Buy</div><div class="value">${avgBuy.toFixed(2)}</div></div>
        <div class="card"><div class="label">Total Quantity</div><div class="value">${totalQty}</div></div>
        <div class="card"><div class="label">Projected in 1 Year (${expectedAnnualReturnPct}% p.a.)</div><div class="value">${projectedOneYear.toFixed(2)}</div></div>
        <div class="card"><div class="label">Weighted YoY (market)</div><div class="value">${weightedYoY != null ? weightedYoY.toFixed(2) + "%" : "—"}</div></div>
      </div>
      <table>
        <tr><th>Name</th><th>Qty</th><th>Buy Price</th><th>Latest Close</th><th>YoY</th><th>Value (Latest)</th></tr>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${r.name}</td>
            <td>${r.qty}</td>
            <td>${r.buyPrice}</td>
            <td>${r.latest != null ? r.latest : "—"}</td>
            <td>${r.yoy != null ? r.yoy.toFixed(2) + "%" : "—"}</td>
            <td>${(r.latestValue || 0).toFixed(2)}</td>
          </tr>
        `
          )
          .join("")}
        <tfoot>
          <tr>
            <td colspan="5">Totals</td>
            <td>${totalLatestValue.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </body>
  </html>`;

  try {
    const executablePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath || undefined,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(html);
    const pdfBuffer = await page.pdf({ format: "A4" });
    await browser.close();

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: { "Content-Type": "application/pdf" },
    });
  } catch {
    // Fallback to HTML when headless Chrome is unavailable in the environment
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  }
}


