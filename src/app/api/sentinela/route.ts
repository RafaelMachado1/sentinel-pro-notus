// ...existing imports...+
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";


const prisma = new PrismaClient();

export async function GET() {
  const rules = await prisma.rule.findMany();
  return NextResponse.json(rules);
}

export async function POST(request: Request) {
  const data = await request.json();

  // Validação simples
  if (!data.name || !data.ownerAddress || !data.networkId || !data.contractAddress || !data.eventName) {
    return NextResponse.json(
      { error: "Todos os campos são obrigatórios." },
      { status: 400 }
    );
  }

  const rule = await prisma.rule.create({
    data: {
      name: data.name,
      ownerAddress: data.ownerAddress,
      networkId: data.networkId,
      contractAddress: data.contractAddress,
      eventName: data.eventName,
      notusSubscriptionId: data.notusSubscriptionId || "",
      // Adicione action se necessário
    },
  });
  return NextResponse.json(rule);
}