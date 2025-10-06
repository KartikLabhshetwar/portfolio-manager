import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const portfolios = await prisma.portfolio.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(portfolios);
}

export async function POST(req: Request) {
  const { name } = await req.json();
  const trimmed = (name || "").trim();
  if (!trimmed) return NextResponse.json({ error: "name required" }, { status: 400 });
  const created = await prisma.portfolio.create({ data: { name: trimmed } });
  return NextResponse.json(created);
}


