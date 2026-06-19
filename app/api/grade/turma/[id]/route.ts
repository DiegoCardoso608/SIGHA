import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

function detectarConflitos(alocacoes: any[], blocosPorId: Map<string, any>) {
  const conflitos: any[] = []
  const porProfessor = new Map<string, any[]>()

  for (const alocacao of alocacoes) {
    if (!porProfessor.has(alocacao.professorId ?? '')) {
      porProfessor.set(alocacao.professorId ?? '', [])
    }
    if (alocacao.professorId) {
      porProfessor.get(alocacao.professorId)!.push(alocacao)
    }
  }

  for (const [, lista] of porProfessor) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i]
        const b = lista[j]
        if (
          a.diaSemana === b.diaSemana &&
          a.blocoId === b.blocoId &&
          a.turmaId !== b.turmaId
        ) {
          const bloco = blocosPorId.get(a.blocoId)
          conflitos.push({
            professorId: a.professorId,
            professorNome: a.professor?.usuario?.nome ?? 'Professor',
            diaSemana: a.diaSemana,
            blocoInicio: bloco?.inicio ?? '',
            blocoFim: bloco?.fim ?? '',
            turma1: a.turma?.nome ?? a.turmaId,
            turma2: b.turma?.nome ?? b.turmaId,
            disciplina1: a.disciplina?.nome ?? a.disciplinaId,
            disciplina2: b.disciplina?.nome ?? b.disciplinaId,
          })
        }
      }
    }
  }

  return conflitos
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const turma = await prisma.turma.findUnique({
    where: { id },
    include: {
      curso: {
        include: {
          disciplinas: {
            include: { disciplina: true },
            orderBy: { periodo: 'asc' },
          },
        },
      },
      periodoLetivo: true,
    },
  })

  if (!turma) {
    return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 })
  }

  const [alocacoes, blocos] = await Promise.all([
    prisma.alocacao.findMany({
      where: { turmaId: id },
      include: {
        disciplina: true,
        professor: { include: { usuario: { select: { nome: true } } } },
        bloco: true,
        turma: true,
      },
      orderBy: [{ diaSemana: 'asc' }, { bloco: { ordem: 'asc' } }],
    }),
    prisma.blocoHorario.findMany(),
  ])

  const blocosPorId = new Map(blocos.map((b) => [b.id, b]))
  const disciplinasDoPeriodo = turma.curso.disciplinas.filter(
    (cd: any) => cd.periodo === turma.periodo && cd.disciplina.ativo
  )
  const alocacoesValidas = alocacoes.filter((a) => a.status !== 'CONFLITO')
  const alocacoesPorDisciplina = new Set(alocacoesValidas.map((a) => a.disciplinaId))

  const pendencias = disciplinasDoPeriodo
    .filter((cd: any) => !alocacoesPorDisciplina.has(cd.disciplinaId))
    .map((cd: any) => ({
      turmaId: turma.id,
      turmaNome: turma.nome,
      disciplinaId: cd.disciplinaId,
      disciplinaNome: cd.disciplina.nome,
      tipoPendencia: 'SEM_PROFESSOR_VINCULADO',
      motivo: 'Disciplina ainda não alocada nesta turma.',
      professoresVinculados: 0,
      professoresDisponiveis: 0,
    }))

  const conflitos = detectarConflitos(alocacoesValidas, blocosPorId)

  return NextResponse.json({
    turma: {
      id: turma.id,
      codigo: turma.codigo,
      nome: turma.nome,
      periodo: turma.periodo,
      turno: turma.turno,
      cursoId: turma.cursoId,
      periodoLetivoId: turma.periodoLetivoId,
    },
    alocacoes: alocacoesValidas,
    pendencias,
    conflitos,
  })
}
