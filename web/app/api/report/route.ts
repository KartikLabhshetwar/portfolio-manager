import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const stocks = await prisma.stock.findMany();
  const html = `
  <html>
    <body style="font-family: sans-serif; padding: 20px;">
      <h1>Portfolio Report</h1>
      <table border="1" cellspacing="0" cellpadding="5" width="100%">
        <tr><th>Name</th><th>Qty</th><th>Buy Price</th></tr>
        ${stocks
          .map(
            (s) => `
          <tr>
            <td>${s.name}</td>
            <td>${s.quantity}</td>
            <td>${s.buyPrice}</td>
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


