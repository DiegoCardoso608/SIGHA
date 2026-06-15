import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import type { DiaSemana } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { simularAlocacao } from '@/lib/algoritmo'

const atualizarAlocacaoSchema = z.object({
  professorId: z.string().nullable().optional(),
  blocoId: z.string().optional(),
  diaSemana: z.enum(['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']).optional(),
  online: z.boolean().optional(),
  status: z.enum(['PENDENTE', 'CONFIRMADA', 'CONFLITO']).optional(),
  motivo: z.string().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const { id } = await params
  const alocacao = await prisma.alocacao.findUnique({
    where: { id },
    include: {
      turma: {
        include: {
          curso: true,
          periodoLetivo: true,
        },
      },
      disciplina: true,
      professor: {
        include: {
          usuario: { select: { nome: true, email: true } },
          disciplinas: { include: { disciplina: true } },
        },
      },
      bloco: true,
    },
  })

  if (!alocacao) {
    return NextResponse.json({ error: 'Alocacao nao encontrada' }, { status: 404 })
  }

  return NextResponse.json({ alocacao })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const perfil = session.user.perfil
  if (perfil !== 'ADMIN' && perfil !== 'COORDENADOR') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = atualizarAlocacaoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', detalhes: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  const { professorId, blocoId, diaSemana, online, status, motivo } = parsed.data

  const atual = await prisma.alocacao.findUnique({
    where: { id },
    include: { bloco: true, turma: true, disciplina: true },
  })
  if (!atual) return NextResponse.json({ error: 'Alocacao nao encontrada' }, { status: 404 })

  const novoBlocoId = blocoId ?? atual.blocoId
  const novoDiaSemana = (diaSemana ?? atual.diaSemana) as DiaSemana
  const novoProfessorId = professorId !== undefined ? professorId : atual.professorId
  const novoBloco = blocoId ? await prisma.blocoHorario.findUnique({ where: { id: novoBlocoId } }) : atual.bloco

  if (!novoBloco) return NextResponse.json({ error: 'Bloco nao encontrado' }, { status: 404 })
  if (atual.turma.turno !== novoBloco.turno) {
    return NextResponse.json({ error: 'O bloco selecionado nao pertence ao turno da turma' }, { status: 422 })
  }

  const conflitoTurma = await prisma.alocacao.findFirst({
    where: {
      id: { not: id },
      turmaId: atual.turmaId,
      blocoId: novoBlocoId,
      diaSemana: novoDiaSemana,
      status: { not: 'CONFLITO' },
    },
  })
  if (conflitoTurma) {
    return NextResponse.json({ error: 'Esta turma ja possui aula neste dia e horario' }, { status: 409 })
  }

  if (novoProfessorId) {
    const simulacao = await simularAlocacao({
      alocacaoId: id,
      turmaId: atual.turmaId,
      disciplinaId: atual.disciplinaId,
      professorId: novoProfessorId,
      blocoId: novoBlocoId,
      diaSemana: novoDiaSemana,
    })
    if (!simulacao.valido) {
      return NextResponse.json({ error: simulacao.erros[0], erros: simulacao.erros }, { status: 422 })
    }
  }

  const novoStatus = status ?? (novoProfessorId ? 'CONFIRMADA' : 'PENDENTE')

  const alocacao = await prisma.alocacao.update({
    where: { id },
    data: {
      professorId: novoProfessorId,
      blocoId: novoBlocoId,
      diaSemana: novoDiaSemana,
      online: online ?? atual.online,
      status: novoStatus,
    },
    include: {
      turma: {
        include: {
          curso: { select: { id: true, codigo: true, nome: true } },
          periodoLetivo: { select: { id: true, descricao: true, status: true } },
        },
      },
      disciplina: true,
      professor: { include: { usuario: { select: { nome: true, email: true } } } },
      bloco: true,
    },
  })

  await prisma.logAlteracao.create({
    data: {
      usuarioId: session.user.id,
      entidade: 'Alocacao',
      entidadeId: id,
      campo: 'atualizacao',
      valorAntes: JSON.stringify({
        professorId: atual.professorId,
        blocoId: atual.blocoId,
        diaSemana: atual.diaSemana,
        status: atual.status,
      }),
      valorDepois: JSON.stringify({ professorId: novoProfessorId, blocoId: novoBlocoId, diaSemana: novoDiaSemana, status: novoStatus }),
      motivo: motivo ?? null,
    },
  })

  return NextResponse.json({ alocacao })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const perfil = session.user.perfil
  if (perfil !== 'ADMIN' && perfil !== 'COORDENADOR') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  const { id } = await params
  let motivo: string | null = null

  try {
    const body = (await req.json()) as { motivo?: string }
    motivo = body.motivo ?? null
  } catch {
    motivo = null
  }

  const alocacao = await prisma.alocacao.findUnique({ where: { id } })
  if (!alocacao) {
    return NextResponse.json({ error: 'Alocacao nao encontrada' }, { status: 404 })
  }

  await prisma.$transaction([
    prisma.alocacao.delete({ where: { id } }),
    prisma.logAlteracao.create({
      data: {
        usuarioId: session.user.id,
        entidade: 'Alocacao',
        entidadeId: id,
        campo: 'exclusao',
        valorAntes: JSON.stringify(alocacao),
        motivo,
      },
    }),
  ])

  return NextResponse.json({ mensagem: 'Alocacao removida com sucesso' })
}
