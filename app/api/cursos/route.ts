// app/api/cursos/route.ts
// GET /api/cursos — retorna lista de cursos ativos para uso nos selects
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const cursos = await prisma.curso.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, codigo: true, totalPeriodos: true, modalidade: true },
    orderBy: { nome: 'asc' },
  })

  return NextResponse.json({ cursos })
}
