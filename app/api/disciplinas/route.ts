// app/api/disciplinas/route.ts
// Sprint 2 — substitui o GET básico do Sprint 1B
// Expande com POST e filtros completos

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// ─── Schema de validação ─────────────────────────────────────────────────────

const createDisciplinaSchema = z.object({
  codigo: z.string().min(2, 'Código obrigatório').max(20),
  nome: z.string().min(3, 'Nome obrigatório').max(100),
  cargaHoraria: z.number().int().min(1, 'Carga horária inválida').max(500),
  modalidade: z.enum(['PRESENCIAL', 'ONLINE']).default('PRESENCIAL'),
  // Vinculações opcionais com cursos
  cursos: z
    .array(
      z.object({
        cursoId: z.string(),
        periodo: z.number().int().min(1).max(10),
        obrigatoria: z.boolean().default(true),
      })
    )
    .optional()
    .default([]),
})

// ─── GET /api/disciplinas ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? 'todos' // todos | ativo | inativo
  const cursoId = searchParams.get('cursoId') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? '15')))
  const skip = (page - 1) * limit

  // ── Filtro WHERE ──────────────────────────────────────────────────────────
  const where: Record<string, unknown> = {}

  if (search) {
    where.OR = [
      { nome: { contains: search, mode: 'insensitive' } },
      { codigo: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (status === 'ativo') where.ativo = true
  if (status === 'inativo') where.ativo = false

  // Filtrar por curso (via relação CursoDisciplina)
  if (cursoId) {
    where.cursos = {
      some: { cursoId },
    }
  }

  // ── Query ─────────────────────────────────────────────────────────────────
  const [disciplinas, total] = await Promise.all([
    prisma.disciplina.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      include: {
        cursos: {
          include: {
            curso: { select: { id: true, nome: true, codigo: true } },
          },
        },
        professores: {
          where: { professor: { ativo: true } },
          include: {
            professor: {
              include: {
                usuario: { select: { id: true, nome: true } },
              },
            },
          },
        },
      },
    }),
    prisma.disciplina.count({ where }),
  ])

  return NextResponse.json({
    disciplinas,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  })
}

// ─── POST /api/disciplinas ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = createDisciplinaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { codigo, nome, cargaHoraria, modalidade, cursos } = parsed.data

  // Verificar código duplicado
  const existing = await prisma.disciplina.findUnique({ where: { codigo } })
  if (existing) {
    return NextResponse.json(
      { error: 'Já existe uma disciplina com esse código.' },
      { status: 409 }
    )
  }

  // Criar disciplina + vínculos de curso em transação
  const disciplina = await prisma.$transaction(async (tx) => {
    const created = await tx.disciplina.create({
      data: {
        codigo,
        nome,
        cargaHoraria,
        modalidade,
        ativo: true,
      },
    })

    if (cursos && cursos.length > 0) {
      await tx.cursoDisciplina.createMany({
        data: cursos.map((c) => ({
          disciplinaId: created.id,
          cursoId: c.cursoId,
          periodo: c.periodo,
          obrigatoria: c.obrigatoria,
        })),
      })
    }

    // Log de auditoria
    await tx.logAlteracao.create({
      data: {
        usuarioId: session.user.id,
        entidade: 'Disciplina',
        entidadeId: created.id,
        campo: null,
        valorAntes: null,
        valorDepois: JSON.stringify({ codigo, nome, cargaHoraria, modalidade }),
        motivo: null,
      },
    })

    return tx.disciplina.findUnique({
      where: { id: created.id },
      include: {
        cursos: {
          include: { curso: { select: { id: true, nome: true } } },
        },
      },
    })
  })

  return NextResponse.json(disciplina, { status: 201 })
}
