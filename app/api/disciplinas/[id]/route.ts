// app/api/disciplinas/[id]/route.ts
// Sprint 2 — Handlers dinâmicos para operações em disciplina específica

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// ─── Schema de atualização ────────────────────────────────────────────────────

const updateDisciplinaSchema = z.object({
  codigo: z.string().min(2, 'Código obrigatório').max(20).optional(),
  nome: z.string().min(3, 'Nome obrigatório').max(100).optional(),
  cargaHoraria: z.number().int().min(1, 'Carga horária inválida').max(500).optional(),
  modalidade: z.enum(['PRESENCIAL', 'ONLINE']).optional(),
  cursos: z
    .array(
      z.object({
        cursoId: z.string(),
        periodo: z.number().int().min(1).max(10),
        obrigatoria: z.boolean().default(true),
      })
    )
    .optional(),
  motivo: z.string().optional(),
})

// ─── GET /api/disciplinas/[id] ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const disciplina = await prisma.disciplina.findUnique({
    where: { id },
    include: {
      cursos: {
        include: { curso: { select: { id: true, nome: true, codigo: true } } },
      },
      professores: {
        include: {
          professor: {
            include: {
              usuario: { select: { id: true, nome: true } },
            },
          },
        },
      },
    },
  })

  if (!disciplina) {
    return NextResponse.json(
      { error: 'Disciplina não encontrada' },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: disciplina })
}

// ─── PUT /api/disciplinas/[id] ────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = updateDisciplinaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  // Verifica existência da disciplina
  const disciplinaExistente = await prisma.disciplina.findUnique({
    where: { id },
    include: { cursos: true },
  })

  if (!disciplinaExistente) {
    return NextResponse.json(
      { error: 'Disciplina não encontrada' },
      { status: 404 }
    )
  }

  const { codigo, nome, cargaHoraria, modalidade, cursos, motivo } = parsed.data

  // Verifica código duplicado (se estiver sendo alterado)
  if (codigo && codigo !== disciplinaExistente.codigo) {
    const existing = await prisma.disciplina.findUnique({
      where: { codigo },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Já existe uma disciplina com esse código.' },
        { status: 409 }
      )
    }
  }

  // Atualiza em transação
  const disciplina = await prisma.$transaction(async (tx) => {
    // Snapshot para auditoria
    const snapshot = {
      codigo: disciplinaExistente.codigo,
      nome: disciplinaExistente.nome,
      cargaHoraria: disciplinaExistente.cargaHoraria,
      modalidade: disciplinaExistente.modalidade,
    }

    // Atualiza dados básicos
    const dadosDisciplina: Record<string, unknown> = {}
    if (codigo !== undefined) dadosDisciplina.codigo = codigo
    if (nome !== undefined) dadosDisciplina.nome = nome
    if (cargaHoraria !== undefined) dadosDisciplina.cargaHoraria = cargaHoraria
    if (modalidade !== undefined) dadosDisciplina.modalidade = modalidade

    if (Object.keys(dadosDisciplina).length > 0) {
      await tx.disciplina.update({
        where: { id },
        data: dadosDisciplina,
      })
    }

    // Atualiza cursos (replace completo)
    if (cursos !== undefined) {
      await tx.cursoDisciplina.deleteMany({
        where: { disciplinaId: id },
      })
      if (cursos.length > 0) {
        await tx.cursoDisciplina.createMany({
          data: cursos.map((c) => ({
            disciplinaId: id,
            cursoId: c.cursoId,
            periodo: c.periodo,
            obrigatoria: c.obrigatoria,
          })),
          skipDuplicates: true,
        })
      }
    }

    // Log de auditoria
    await tx.logAlteracao.create({
      data: {
        usuarioId: session.user.id,
        entidade: 'Disciplina',
        entidadeId: id,
        campo: 'atualizacao',
        valorAntes: JSON.stringify(snapshot),
        valorDepois: JSON.stringify({ codigo, nome, cargaHoraria, modalidade }),
        motivo: motivo ?? 'Atualização de dados da disciplina',
      },
    })

    return tx.disciplina.findUnique({
      where: { id },
      include: {
        cursos: {
          include: { curso: { select: { id: true, nome: true } } },
        },
      },
    })
  })

  return NextResponse.json({ data: disciplina })
}

// ─── DELETE /api/disciplinas/[id] (desativação lógica) ──────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const disciplina = await prisma.disciplina.findUnique({
    where: { id },
  })

  if (!disciplina) {
    return NextResponse.json(
      { error: 'Disciplina não encontrada' },
      { status: 404 }
    )
  }

  // Verifica alocações ativas (PENDENTE, CONFIRMADA, CONFLITO)
  const alocacoesAtivas = await prisma.alocacao.count({
    where: {
      disciplinaId: id,
      status: { in: ['PENDENTE', 'CONFIRMADA', 'CONFLITO'] },
    },
  })

  if (alocacoesAtivas > 0) {
    return NextResponse.json(
      {
        error: `Disciplina possui ${alocacoesAtivas} alocação(ões) ativa(s). Remova as alocações antes de desativar.`,
      },
      { status: 422 }
    )
  }

  let motivo: string | undefined
  try {
    const body = await req.json()
    motivo = body.motivo
  } catch {
    // Ignora erro de JSON
  }

  // Desativa em transação
  await prisma.$transaction(async (tx) => {
    await tx.disciplina.update({
      where: { id },
      data: { ativo: false },
    })

    // Log de auditoria
    await tx.logAlteracao.create({
      data: {
        usuarioId: session.user.id,
        entidade: 'Disciplina',
        entidadeId: id,
        campo: 'ativo',
        valorAntes: 'true',
        valorDepois: 'false',
        motivo: motivo ?? 'Desativação da disciplina',
      },
    })
  })

  return NextResponse.json({ mensagem: 'Disciplina desativada com sucesso' })
}
