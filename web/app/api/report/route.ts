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
  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; color: #111827; }
        h1 { margin: 0 0 4px; font-size: 24px; }
        .sub { color: #6B7280; margin-bottom: 16px; }
        .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0 24px; }
        .card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; }
        .label { color: #6B7280; font-size: 12px; }
        .value { font-size: 18px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; font-size: 12px; }
        th { background: #F3F4F6; }
      </style>
    </head>
    <body>
      <h1>Portfolio Report</h1>
      <div class="sub">Generated at ${new Date().toLocaleString()}</div>
      <div class="cards">
        <div class="card"><div class="label">Total Value</div><div class="value">${totalValue.toFixed(2)}</div></div>
        <div class="card"><div class="label">Average Buy</div><div class="value">${avgBuy.toFixed(2)}</div></div>
        <div class="card"><div class="label">Total Quantity</div><div class="value">${totalQty}</div></div>
      </div>
      <table>
        <tr><th>Name</th><th>Qty</th><th>Buy Price</th><th>Value</th></tr>
        ${stocks
          .map(
            (s) => `
          <tr>
            <td>${s.name}</td>
            <td>${s.quantity}</td>
            <td>${s.buyPrice}</td>
            <td>${(s.quantity * s.buyPrice).toFixed(2)}</td>
          </tr>
        `
          )
          .join("")}
      </table>
    </body>
  </html>`;

  const executablePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });
  const page = await browser.newPage();
  await page.setContent(html);
  const pdfBuffer = await page.pdf({ format: "A4" });
  await browser.close();

  return new NextResponse(Buffer.from(pdfBuffer), {
    headers: { "Content-Type": "application/pdf" },
  });
}


