// app/api/periodos-letivos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  dataInicio: z.string().datetime().optional(),
  dataFim: z.string().datetime().optional(),
  status: z.enum(['PLANEJAMENTO', 'ATIVO', 'FINALIZADO']).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const periodo = await prisma.periodoLetivo.findUnique({
    where: { id },
    include: {
      turmas: {
        include: { curso: { select: { nome: true } } },
        orderBy: { periodo: 'asc' },
      },
      _count: { select: { turmas: true } },
    },
  })

  if (!periodo) return NextResponse.json({ error: 'Período não encontrado' }, { status: 404 })

  return NextResponse.json({ periodo })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const existente = await prisma.periodoLetivo.findUnique({ where: { id } })
  if (!existente) return NextResponse.json({ error: 'Período não encontrado' }, { status: 404 })

  // Não pode editar período FINALIZADO
  if (existente.status === 'FINALIZADO' && parsed.data.status !== 'FINALIZADO') {
    return NextResponse.json({ error: 'Períodos finalizados não podem ser reabertos' }, { status: 422 })
  }

  const { dataInicio, dataFim, status } = parsed.data

  const periodo = await prisma.$transaction(async (tx) => {
    const updated = await tx.periodoLetivo.update({
      where: { id },
      data: {
        ...(dataInicio ? { dataInicio: new Date(dataInicio) } : {}),
        ...(dataFim ? { dataFim: new Date(dataFim) } : {}),
        ...(status ? { status } : {}),
      },
    })

    if (status && status !== existente.status) {
      await tx.logAlteracao.create({
        data: {
          usuarioId: (session.user as any).id,
          entidade: 'PeriodoLetivo',
          entidadeId: id,
          campo: 'status',
          valorAntes: existente.status,
          valorDepois: status,
        },
      })
    }

    return updated
  })

  return NextResponse.json({ periodo })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const periodo = await prisma.periodoLetivo.findUnique({
    where: { id },
    include: { _count: { select: { turmas: true } } },
  })

  if (!periodo) return NextResponse.json({ error: 'Período não encontrado' }, { status: 404 })

  if (periodo._count.turmas > 0) {
    return NextResponse.json(
      { error: `Não é possível excluir: existem ${periodo._count.turmas} turma(s) vinculada(s)` },
      { status: 422 }
    )
  }

  if (periodo.status === 'ATIVO') {
    return NextResponse.json({ error: 'Não é possível excluir um período letivo ativo' }, { status: 422 })
  }

  await prisma.periodoLetivo.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
