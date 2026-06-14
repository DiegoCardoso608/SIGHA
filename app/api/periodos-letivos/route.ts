// app/api/periodos-letivos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  ano: z.number().int().min(2020).max(2099),
  semestre: z.number().int().min(1).max(2),
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime(),
  status: z.enum(['PLANEJAMENTO', 'ATIVO', 'FINALIZADO']).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const ano = searchParams.get('ano')

  const periodos = await prisma.periodoLetivo.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(ano ? { ano: parseInt(ano) } : {}),
    },
    include: {
      _count: { select: { turmas: true } },
    },
    orderBy: [{ ano: 'desc' }, { semestre: 'desc' }],
  })

  return NextResponse.json({ periodos })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { ano, semestre, dataInicio, dataFim, status } = parsed.data

  // Verifica duplicidade
  const existente = await prisma.periodoLetivo.findUnique({
    where: { ano_semestre: { ano, semestre } },
  })
  if (existente) {
    return NextResponse.json({ error: `Já existe o período ${ano}.${semestre}` }, { status: 409 })
  }

  const descricao = `${ano}.${semestre}`

  const periodo = await prisma.periodoLetivo.create({
    data: {
      ano,
      semestre,
      descricao,
      dataInicio: new Date(dataInicio),
      dataFim: new Date(dataFim),
      status: status ?? 'PLANEJAMENTO',
    },
  })

  // Auditoria
  await prisma.logAlteracao.create({
    data: {
      usuarioId: (session.user as any).id,
      entidade: 'PeriodoLetivo',
      entidadeId: periodo.id,
      campo: 'criacao',
      valorDepois: descricao,
    },
  })

  return NextResponse.json({ periodo }, { status: 201 })
}
