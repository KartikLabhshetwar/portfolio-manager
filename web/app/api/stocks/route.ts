import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const stocks = await prisma.stock.findMany();
  return NextResponse.json(stocks);
}

export async function POST(req: Request) {
  const data = await req.json();
  const stock = await prisma.stock.create({ data });
  return NextResponse.json(stock);
}

export async function PUT(req: Request) {
  const data = await req.json();
  const stock = await prisma.stock.update({
    where: { id: data.id },
    data,
  });
  return NextResponse.json(stock);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await prisma.stock.delete({ where: { id } });
  return NextResponse.json({ success: true });
}


