import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password, expireInMinutes } = await req.json();
  const expiresAt = expireInMinutes ? new Date(Date.now() + expireInMinutes * 60 * 1000) : null;

  const link = await prisma.sharedLink.create({
    data: { reportId: 1, password: password || null, expiresAt },
  });

  return NextResponse.json({ link: `/view/${link.id}` });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const link = await prisma.sharedLink.findUnique({ where: { id } });

  if (!link) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (link.expiresAt && new Date() > link.expiresAt)
    return NextResponse.json({ error: "Link expired" }, { status: 403 });

  return NextResponse.json({ valid: true });
}


