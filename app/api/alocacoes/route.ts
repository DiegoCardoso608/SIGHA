import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import type { DiaSemana } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { simularAlocacao } from '@/lib/algoritmo'

const diaSemanaSchema = z.enum(['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'])

const criarAlocacaoSchema = z.object({
  turmaId: z.string().min(1, 'Turma obrigatoria'),
  disciplinaId: z.string().min(1, 'Disciplina obrigatoria'),
  professorId: z.string().optional().nullable(),
  blocoId: z.string().min(1, 'Bloco de horario obrigatorio'),
  diaSemana: diaSemanaSchema,
  online: z.boolean().optional().default(false),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const turmaId = searchParams.get('turmaId')
  const professorId = searchParams.get('professorId')
  const periodoLetivoId = searchParams.get('periodoLetivoId')
  const diaSemana = searchParams.get('diaSemana')
  const status = searchParams.get('status')

  const alocacoes = await prisma.alocacao.findMany({
    where: {
      ...(turmaId ? { turmaId } : {}),
      ...(professorId ? { professorId } : {}),
      ...(diaSemana ? { diaSemana: diaSemana as DiaSemana } : {}),
      ...(status ? { status: status as 'PENDENTE' | 'CONFIRMADA' | 'CONFLITO' } : {}),
      ...(periodoLetivoId ? { turma: { periodoLetivoId } } : {}),
    },
    include: {
      turma: {
        include: {
          curso: { select: { id: true, codigo: true, nome: true } },
          periodoLetivo: { select: { id: true, descricao: true, status: true } },
        },
      },
      disciplina: true,
      professor: {
        include: {
          usuario: { select: { nome: true, email: true } },
        },
      },
      bloco: true,
    },
    orderBy: [{ diaSemana: 'asc' }, { bloco: { ordem: 'asc' } }],
  })

  return NextResponse.json({ alocacoes })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const perfil = session.user.perfil
  if (perfil !== 'ADMIN' && perfil !== 'COORDENADOR') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = criarAlocacaoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', detalhes: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { turmaId, disciplinaId, professorId, blocoId, diaSemana, online } = parsed.data

  const [turma, disciplina, bloco] = await Promise.all([
    prisma.turma.findUnique({ where: { id: turmaId } }),
    prisma.disciplina.findUnique({ where: { id: disciplinaId } }),
    prisma.blocoHorario.findUnique({ where: { id: blocoId } }),
  ])

  if (!turma) return NextResponse.json({ error: 'Turma nao encontrada' }, { status: 404 })
  if (!disciplina) return NextResponse.json({ error: 'Disciplina nao encontrada' }, { status: 404 })
  if (!bloco) return NextResponse.json({ error: 'Bloco nao encontrado' }, { status: 404 })
  if (!turma.ativo) return NextResponse.json({ error: 'Turma inativa' }, { status: 422 })
  if (!disciplina.ativo) return NextResponse.json({ error: 'Disciplina inativa' }, { status: 422 })
  if (turma.turno !== bloco.turno) {
    return NextResponse.json({ error: 'O bloco selecionado nao pertence ao turno da turma' }, { status: 422 })
  }

  const vinculo = await prisma.cursoDisciplina.findUnique({
    where: { cursoId_disciplinaId: { cursoId: turma.cursoId, disciplinaId } },
  })

  if (!vinculo) {
    return NextResponse.json({ error: 'Disciplina nao pertence ao curso desta turma' }, { status: 422 })
  }

  if (vinculo.periodo !== turma.periodo) {
    return NextResponse.json(
      { error: `Disciplina pertence ao periodo ${vinculo.periodo}, mas a turma e do periodo ${turma.periodo}` },
      { status: 422 }
    )
  }

  const conflitoTurma = await prisma.alocacao.findFirst({
    where: { turmaId, blocoId, diaSemana, status: { not: 'CONFLITO' } },
  })
  if (conflitoTurma) {
    return NextResponse.json({ error: 'Esta turma ja possui aula neste dia e horario' }, { status: 409 })
  }

  if (professorId) {
    const simulacao = await simularAlocacao({
      turmaId,
      disciplinaId,
      professorId,
      blocoId,
      diaSemana: diaSemana as DiaSemana,
    })
    if (!simulacao.valido) {
      return NextResponse.json({ error: simulacao.erros[0], erros: simulacao.erros }, { status: 422 })
    }
  }

  const alocacao = await prisma.alocacao.create({
    data: {
      turmaId,
      disciplinaId,
      professorId: professorId ?? null,
      blocoId,
      diaSemana,
      online,
      status: professorId ? 'CONFIRMADA' : 'PENDENTE',
    },
    include: {
      turma: true,
      disciplina: true,
      professor: { include: { usuario: { select: { nome: true, email: true } } } },
      bloco: true,
    },
  })

  await prisma.logAlteracao.create({
    data: {
      usuarioId: session.user.id,
      entidade: 'Alocacao',
      entidadeId: alocacao.id,
      campo: 'criacao',
      valorDepois: JSON.stringify({ turmaId, disciplinaId, professorId, blocoId, diaSemana }),
    },
  })

  return NextResponse.json({ alocacao }, { status: 201 })
}
