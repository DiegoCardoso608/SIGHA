// app/api/disciplinas/route.ts
// Rota mínima necessária para o modal de professor carregar as disciplinas
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const busca = searchParams.get("busca") ?? "";
  const porPagina = Math.min(100, parseInt(searchParams.get("porPagina") ?? "50"));
  const pagina = Math.max(1, parseInt(searchParams.get("pagina") ?? "1"));

  const where = {
    ativo: true,
    ...(busca
      ? {
          OR: [
            { nome: { contains: busca, mode: "insensitive" as const } },
            { codigo: { contains: busca, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, disciplinas] = await Promise.all([
    prisma.disciplina.count({ where }),
    prisma.disciplina.findMany({
      where,
      orderBy: { nome: "asc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true,
        codigo: true,
        nome: true,
        cargaHoraria: true,
        ativo: true,
      },
    }),
  ]);

  return NextResponse.json({
    data: disciplinas,
    meta: {
      total,
      pagina,
      porPagina,
      totalPaginas: Math.ceil(total / porPagina),
    },
  });
}
