import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { DiaSemana, Prisma, Turno } from '@prisma/client'

const diaSemanaSchema = z.enum(['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'])
const turnoSchema = z.enum(['MANHA', 'TARDE', 'NOITE'])

const querySchema = z.object({
  professorId: z.string().optional(),
  diaSemana: diaSemanaSchema.optional(),
  turno: turnoSchema.optional(),
  blocoId: z.string().optional(),
  disponivel: z.enum(['true', 'false']).optional(),
  cursoId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

const createSchema = z.object({
  professorId: z.string().min(1),
  blocoId: z.string().min(1),
  diaSemana: diaSemanaSchema,
  disponivel: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parametros invalidos', detalhes: parsed.error.flatten() }, { status: 400 })
  }

  const { professorId, diaSemana, turno, blocoId, disponivel, cursoId } = parsed.data
  const page = parsed.data.page ?? 1
  const pageSize = parsed.data.pageSize ?? 20

  const where: Prisma.DisponibilidadeBlocoWhereInput = {}
  if (professorId) where.professorId = professorId
  if (diaSemana) where.diaSemana = diaSemana as DiaSemana
  if (blocoId) where.blocoId = blocoId
  if (disponivel !== undefined) where.disponivel = disponivel === 'true'
  if (turno) where.bloco = { turno: turno as Turno }
  if (cursoId) {
    where.professor = {
      disciplinas: {
        some: {
          disciplina: {
            cursos: { some: { cursoId } },
          },
        },
      },
    }
  }

  const [total, registros] = await Promise.all([
    prisma.disponibilidadeBloco.count({ where }),
    prisma.disponibilidadeBloco.findMany({
      where,
      include: {
        professor: { include: { usuario: true } },
        bloco: true,
      },
      orderBy: [{ diaSemana: 'asc' }, { bloco: { turno: 'asc' } }, { bloco: { ordem: 'asc' } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({
    data: registros,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil === 'ALUNO') {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 403 })
  }

  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', detalhes: parsed.error.flatten() }, { status: 400 })
  }

  const { professorId, blocoId, diaSemana, disponivel } = parsed.data

  const [professor, bloco] = await Promise.all([
    prisma.professor.findUnique({ where: { id: professorId } }),
    prisma.blocoHorario.findUnique({ where: { id: blocoId } }),
  ])
  if (!professor) return NextResponse.json({ error: 'Professor nao encontrado' }, { status: 404 })
  if (!bloco) return NextResponse.json({ error: 'Bloco de horario nao encontrado' }, { status: 404 })

  const registro = await prisma.$transaction(async (tx) => {
    const reg = await tx.disponibilidadeBloco.upsert({
      where: { professorId_blocoId_diaSemana: { professorId, blocoId, diaSemana } },
      update: { disponivel },
      create: { professorId, blocoId, diaSemana, disponivel },
    })

    await tx.logAlteracao.create({
      data: {
        usuarioId: session.user.id,
        entidade: 'DisponibilidadeBloco',
        entidadeId: reg.id,
        campo: `disponibilidade:${diaSemana}:${bloco.inicio}`,
        valorDepois: disponivel ? 'disponivel' : 'indisponivel',
        motivo: 'Atualizacao individual de disponibilidade',
      },
    })

    return reg
  })

  return NextResponse.json(registro, { status: 201 })
}
