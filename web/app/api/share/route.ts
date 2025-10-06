import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password, expireInMinutes, maxViews, portfolioId } = await req.json();
  const expiresAt = expireInMinutes ? new Date(Date.now() + expireInMinutes * 60 * 1000) : null;
  const token = crypto.randomUUID().replace(/-/g, "");
  const link = await prisma.sharedLink.create({
    data: {
      reportId: 1,
      password: password || null,
      expiresAt,
      token,
      // The following fields require a migration; cast to any to satisfy TS until schema generates types
      ...(maxViews != null ? ({ maxViews } as any) : {}),
      ...(portfolioId != null ? ({ portfolioId } as any) : {}),
    } as any,
  });

  // Build absolute URL for sharing (works locally and on Vercel)
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const origin = `${proto}://${host}`;
  return NextResponse.json({ link: `${origin}/view/${link.token}` });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const password = url.searchParams.get("password") || undefined;
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  const link = await prisma.sharedLink.findUnique({ where: { token } });

  if (!link) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (link.expiresAt && new Date() > link.expiresAt)
    return NextResponse.json({ error: "Link expired" }, { status: 403 });

  if (link.password && link.password !== password)
    return NextResponse.json({ error: "Password required or incorrect" }, { status: 401 });
  if ((link as any).maxViews != null && (link as any).views >= (link as any).maxViews)
    return NextResponse.json({ error: "Link view limit reached" }, { status: 403 });
  await prisma.sharedLink.update({ where: { id: link.id }, data: { views: { increment: 1 } } as any });
  return NextResponse.json({ valid: true, portfolioId: (link as any).portfolioId ?? null });
}


