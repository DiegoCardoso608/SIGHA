// app/api/grade/consultar/route.ts
// Sprint 5.6 A — Consulta persistente da grade existente (sem gerar nova)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { DiaSemana, Turno } from '@prisma/client'
import type {
  ResultadoGradeCurso,
  ResultadoTurma,
  AlocacaoCriada,
  PendenciaDetalhada,
  ConflitoCruzado,
} from '@/lib/algoritmo'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cursoId = searchParams.get('cursoId')
    const periodoLetivoId = searchParams.get('periodoLetivoId')

    if (!cursoId || !periodoLetivoId) {
      return NextResponse.json(
        { error: 'cursoId e periodoLetivoId são obrigatórios' },
        { status: 400 }
      )
    }

    // Verifica se curso e período existem
    const [curso, periodoLetivo] = await Promise.all([
      prisma.curso.findUnique({ where: { id: cursoId } }),
      prisma.periodoLetivo.findUnique({ where: { id: periodoLetivoId } }),
    ])

    if (!curso || !periodoLetivo) {
      return NextResponse.json(
        { error: 'Curso ou período letivo não encontrado' },
        { status: 404 }
      )
    }

    // Busca turmas do curso+período
    const turmas = await prisma.turma.findMany({
      where: { cursoId, periodoLetivoId, ativo: true },
      include: {
        curso: {
          include: {
            disciplinas: {
              include: { disciplina: true },
              orderBy: { periodo: 'asc' },
            },
          },
        },
        alocacoes: {
          where: { status: { not: 'CONFLITO' } },
          include: {
            disciplina: true,
            professor: { include: { usuario: { select: { nome: true } } } },
            bloco: true,
          },
        },
      },
      orderBy: [{ periodo: 'asc' }, { turno: 'asc' }, { codigo: 'asc' }],
    })

    // Se não houver turmas com alocações, retorna 404 (sem grade gerada)
    const totalAlocacoes = turmas.reduce((acc, t) => acc + t.alocacoes.length, 0)
    if (turmas.length === 0 || totalAlocacoes === 0) {
      return NextResponse.json(
        { error: 'Nenhuma grade encontrada para este curso e período' },
        { status: 404 }
      )
    }

    // Monta ResultadoGradeCurso a partir das alocações persistidas
    const todasAlocadas: AlocacaoCriada[] = []
    const resultadosPorTurma: ResultadoTurma[] = []

    for (const turma of turmas) {
      const disciplinasDoPeriodo = turma.curso.disciplinas.filter(
        (cd) => cd.periodo === turma.periodo && cd.disciplina.ativo
      )

      // IDs de disciplinas já alocadas nesta turma
      const disciplinasAlocadasIds = new Set(turma.alocacoes.map((a) => a.disciplinaId))

      // Monta AlocacaoCriada a partir das alocações do banco
      const alocadasTurma: AlocacaoCriada[] = turma.alocacoes
        .filter((a) => a.bloco)
        .map((a) => ({
          id: a.id,
          turmaId: turma.id,
          turmaNome: turma.nome,
          disciplinaId: a.disciplinaId,
          disciplinaNome: a.disciplina.nome,
          professorId: a.professorId,
          professorNome: a.professor?.usuario?.nome ?? null,
          blocoId: a.blocoId,
          blocoInicio: a.bloco.inicio,
          blocoFim: a.bloco.fim,
          diaSemana: a.diaSemana as DiaSemana,
          origem: a.origem,
          fixa: a.fixa,
        }))

      todasAlocadas.push(...alocadasTurma)

      // Pendências = disciplinas do período que não possuem alocação
      const pendenciasTurma: PendenciaDetalhada[] = disciplinasDoPeriodo
        .filter((cd) => !disciplinasAlocadasIds.has(cd.disciplinaId))
        .map((cd) => ({
          turmaId: turma.id,
          turmaNome: turma.nome,
          disciplinaId: cd.disciplinaId,
          disciplinaNome: cd.disciplina.nome,
          tipoPendencia: 'SEM_PROFESSOR_VINCULADO' as const,
          motivo: 'Disciplina ainda não alocada nesta grade.',
          professoresVinculados: 0,
          professoresDisponiveis: 0,
        }))

      resultadosPorTurma.push({
        turma: {
          id: turma.id,
          codigo: turma.codigo,
          nome: turma.nome,
          periodo: turma.periodo,
          turno: turma.turno as Turno,
        },
        alocadas: alocadasTurma,
        pendencias: pendenciasTurma,
        conflitos: [], // preenchido abaixo
      })
    }

    // Detecção de conflitos cross-turma sobre as alocações carregadas
    const blocos = await prisma.blocoHorario.findMany()
    const mapaBlocos = new Map(blocos.map((b) => [b.id, b]))

    const conflitosGlobais: ConflitoCruzado[] = []
    const porProfessor = new Map<string, AlocacaoCriada[]>()
    for (const a of todasAlocadas) {
      if (!a.professorId || !a.professorNome) continue
      if (!porProfessor.has(a.professorId)) porProfessor.set(a.professorId, [])
      porProfessor.get(a.professorId)!.push(a)
    }

    for (const [, alocsProfessor] of porProfessor) {
      for (let i = 0; i < alocsProfessor.length; i++) {
        for (let j = i + 1; j < alocsProfessor.length; j++) {
          const a = alocsProfessor[i]
          const b = alocsProfessor[j]
          if (
            a.diaSemana === b.diaSemana &&
            a.blocoId === b.blocoId &&
            a.turmaId !== b.turmaId
          ) {
            const bloco = mapaBlocos.get(a.blocoId)
            const professorId = a.professorId!
            const professorNome = a.professorNome!
            conflitosGlobais.push({
              professorId,
              professorNome,
              diaSemana: a.diaSemana,
              blocoInicio: bloco?.inicio ?? '',
              blocoFim: bloco?.fim ?? '',
              turma1: a.turmaNome,
              turma2: b.turmaNome,
              disciplina1: a.disciplinaNome,
              disciplina2: b.disciplinaNome,
            })
          }
        }
      }
    }

    // Distribui conflitos por turma
    for (const rt of resultadosPorTurma) {
      rt.conflitos = conflitosGlobais.filter(
        (c) => c.turma1 === rt.turma.nome || c.turma2 === rt.turma.nome
      )
    }

    const totalAlocadas2 = resultadosPorTurma.reduce((acc, r) => acc + r.alocadas.length, 0)
    const totalPendencias = resultadosPorTurma.reduce((acc, r) => acc + r.pendencias.length, 0)
    const totalDisciplinas = totalAlocadas2 + totalPendencias

    const resposta: ResultadoGradeCurso = {
      curso: { id: curso.id, nome: curso.nome },
      periodoLetivo: { id: periodoLetivo.id, descricao: periodoLetivo.descricao },
      turmas: resultadosPorTurma,
      conflitosGlobais,
      resumo: {
        totalDisciplinas,
        totalAlocadas: totalAlocadas2,
        totalPendencias,
        totalConflitos: conflitosGlobais.length,
        taxaSucesso:
          totalDisciplinas > 0
            ? Math.round((totalAlocadas2 / totalDisciplinas) * 100)
            : 0,
      },
    }

    return NextResponse.json(resposta, { status: 200 })
  } catch (error) {
    console.error('[GET /api/grade/consultar]', error)
    return NextResponse.json(
      { error: 'Erro interno ao consultar grade' },
      { status: 500 }
    )
  }
}
