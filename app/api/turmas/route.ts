// app/api/turmas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  codigo: z.string().min(3).max(30),
  nome: z.string().min(3).max(100),
  cursoId: z.string().cuid(),
  periodoLetivoId: z.string().cuid(),
  periodo: z.number().int().min(1).max(10),
  turno: z.enum(['MANHA', 'TARDE', 'NOITE']),
})

// Regra institucional: semestre 1 → períodos ímpares; semestre 2 → períodos pares
function validarPeriodoVsSemestre(periodo: number, semestre: number): string | null {
  const isImpar = periodo % 2 !== 0
  if (semestre === 1 && !isImpar) {
    return `O ${periodo}º período só pode ser ofertado no semestre .2 (períodos pares)`
  }
  if (semestre === 2 && isImpar) {
    return `O ${periodo}º período só pode ser ofertado no semestre .1 (períodos ímpares)`
  }
  return null
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const busca = searchParams.get('busca') ?? ''
  const cursoId = searchParams.get('cursoId')
  const periodoLetivoId = searchParams.get('periodoLetivoId')
  const turno = searchParams.get('turno')
  const periodo = searchParams.get('periodo')
  const ativo = searchParams.get('ativo')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const skip = (page - 1) * limit

  const where: any = {
    ...(busca ? { OR: [{ codigo: { contains: busca, mode: 'insensitive' } }, { nome: { contains: busca, mode: 'insensitive' } }] } : {}),
    ...(cursoId ? { cursoId } : {}),
    ...(periodoLetivoId ? { periodoLetivoId } : {}),
    ...(turno ? { turno } : {}),
    ...(periodo ? { periodo: parseInt(periodo) } : {}),
    ...(ativo !== null && ativo !== '' ? { ativo: ativo === 'true' } : {}),
  }

  const [turmas, total] = await Promise.all([
    prisma.turma.findMany({
      where,
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
        periodoLetivo: { select: { id: true, descricao: true, status: true } },
        _count: { select: { alocacoes: true } },
      },
      orderBy: [{ periodoLetivo: { ano: 'desc' } }, { periodo: 'asc' }, { codigo: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.turma.count({ where }),
  ])

  return NextResponse.json({
    turmas,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { codigo, nome, cursoId, periodoLetivoId, periodo, turno } = parsed.data

  // Busca o período letivo para validar a regra ímpar/par
  const periodoLetivo = await prisma.periodoLetivo.findUnique({ where: { id: periodoLetivoId } })
  if (!periodoLetivo) {
    return NextResponse.json({ error: 'Período letivo não encontrado' }, { status: 404 })
  }

  const erroRegra = validarPeriodoVsSemestre(periodo, periodoLetivo.semestre)
  if (erroRegra) {
    return NextResponse.json({ error: erroRegra }, { status: 422 })
  }

  // Verifica se o curso existe
  const curso = await prisma.curso.findUnique({ where: { id: cursoId } })
  if (!curso) {
    return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 })
  }

  // Verifica duplicidade de código dentro do mesmo período letivo
  const duplicada = await prisma.turma.findUnique({
    where: { codigo_periodoLetivoId: { codigo, periodoLetivoId } },
  })
  if (duplicada) {
    return NextResponse.json(
      { error: `Já existe uma turma com o código "${codigo}" neste período letivo` },
      { status: 409 }
    )
  }

  const turma = await prisma.$transaction(async (tx) => {
    const nova = await tx.turma.create({
      data: { codigo, nome, cursoId, periodoLetivoId, periodo, turno },
      include: {
        curso: { select: { nome: true } },
        periodoLetivo: { select: { descricao: true } },
      },
    })

    await tx.logAlteracao.create({
      data: {
        usuarioId: (session.user as any).id,
        entidade: 'Turma',
        entidadeId: nova.id,
        campo: 'criacao',
        valorDepois: `${codigo} — ${nome}`,
      },
    })

    return nova
  })

  return NextResponse.json({ turma }, { status: 201 })
}
