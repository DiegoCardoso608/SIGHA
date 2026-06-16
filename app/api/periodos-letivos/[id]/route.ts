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
  // Permitir mudança de status em qualquer direção — o ciclo de vida é reversível
  // (anteriormente havia uma restrição que impedia reabertura de períodos finalizados)

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


  // Verifica dependências antes de excluir: turmas e alocações
  const turmas = await prisma.turma.findMany({ where: { periodoLetivoId: id }, select: { id: true } })
  const turmaIds = turmas.map((t) => t.id)
  let alocacoesCount = 0
  if (turmaIds.length > 0) {
    alocacoesCount = await prisma.alocacao.count({ where: { turmaId: { in: turmaIds } } })
  }

  if (turmas.length > 0 || alocacoesCount > 0) {
    const parts: string[] = []
    if (turmas.length > 0) parts.push(`existem ${turmas.length} turma(s) vinculada(s)`)
    if (alocacoesCount > 0) parts.push(`existem ${alocacoesCount} alocação(ões) vinculada(s)`)
    return NextResponse.json({ error: `Não é possível excluir: ${parts.join(' e ')}` }, { status: 422 })
  }

  await prisma.periodoLetivo.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
