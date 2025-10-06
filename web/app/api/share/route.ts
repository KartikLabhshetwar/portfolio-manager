import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password, expireInMinutes } = await req.json();
  const expiresAt = expireInMinutes ? new Date(Date.now() + expireInMinutes * 60 * 1000) : null;
  const token = crypto.randomUUID().replace(/-/g, "");
  const link = await prisma.sharedLink.create({
    data: { reportId: 1, password: password || null, expiresAt, token },
  });

  return NextResponse.json({ link: `/view/${link.token}` });
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

  return NextResponse.json({ valid: true });
}


