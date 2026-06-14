// app/api/turmas/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  nome: z.string().min(3).max(100).optional(),
  turno: z.enum(['MANHA', 'TARDE', 'NOITE']).optional(),
  ativo: z.boolean().optional(),
  motivo: z.string().optional(),
})

function validarPeriodoVsSemestre(periodo: number, semestre: number): string | null {
  const isImpar = periodo % 2 !== 0
  if (semestre === 1 && !isImpar) return `O ${periodo}º período só pode ser ofertado no semestre .2`
  if (semestre === 2 && isImpar) return `O ${periodo}º período só pode ser ofertado no semestre .1`
  return null
}

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const turma = await prisma.turma.findUnique({
    where: { id },
    include: {
      curso: true,
      periodoLetivo: true,
      alocacoes: {
        include: {
          disciplina: { select: { nome: true, codigo: true } },
          professor: { include: { usuario: { select: { nome: true } } } },
          bloco: { select: { inicio: true, fim: true, turno: true } },
        },
        orderBy: { diaSemana: 'asc' },
      },
    },
  })

  if (!turma) return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 })

  return NextResponse.json({ turma })
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

  const existente = await prisma.turma.findUnique({
    where: { id },
    include: { periodoLetivo: true, _count: { select: { alocacoes: true } } },
  })
  if (!existente) return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 })

  const { nome, turno, ativo, motivo } = parsed.data

  // Se está desativando: verificar alocações ativas
  if (ativo === false && existente._count.alocacoes > 0) {
    const alocacoesAtivas = await prisma.alocacao.count({
      where: { turmaId: id, status: { in: ['PENDENTE', 'CONFIRMADA'] } },
    })
    if (alocacoesAtivas > 0) {
      return NextResponse.json(
        { error: `Não é possível desativar: existem ${alocacoesAtivas} alocação(ões) ativa(s) vinculada(s)` },
        { status: 422 }
      )
    }
  }

  const turma = await prisma.$transaction(async (tx) => {
    const updated = await tx.turma.update({
      where: { id },
      data: {
        ...(nome !== undefined ? { nome } : {}),
        ...(turno !== undefined ? { turno } : {}),
        ...(ativo !== undefined ? { ativo } : {}),
      },
      include: {
        curso: { select: { nome: true } },
        periodoLetivo: { select: { descricao: true } },
      },
    })

    // Registra logs dos campos alterados
    const campos: Array<{ campo: string; antes: string; depois: string }> = []
    if (nome && nome !== existente.nome) campos.push({ campo: 'nome', antes: existente.nome, depois: nome })
    if (turno && turno !== existente.turno) campos.push({ campo: 'turno', antes: existente.turno, depois: turno })
    if (ativo !== undefined && ativo !== existente.ativo)
      campos.push({ campo: 'ativo', antes: String(existente.ativo), depois: String(ativo) })

    for (const c of campos) {
      await tx.logAlteracao.create({
        data: {
          usuarioId: (session.user as any).id,
          entidade: 'Turma',
          entidadeId: id,
          campo: c.campo,
          valorAntes: c.antes,
          valorDepois: c.depois,
          motivo: motivo ?? null,
        },
      })
    }

    return updated
  })

  return NextResponse.json({ turma })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const turma = await prisma.turma.findUnique({
    where: { id },
    include: { _count: { select: { alocacoes: true } } },
  })

  if (!turma) return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 })

  if (turma._count.alocacoes > 0) {
    return NextResponse.json(
      { error: `Não é possível excluir: existem ${turma._count.alocacoes} alocação(ões) vinculada(s). Use a desativação.` },
      { status: 422 }
    )
  }

  await prisma.turma.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
