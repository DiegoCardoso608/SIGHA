// app/api/relatorios/grade/route.ts
// Sprint 5.7 E - Exportação da Grade Acadêmica em PDF (padrão CCG-FOR-01)
//
// GET /api/relatorios/grade?cursoId=...&periodoLetivoId=...
//
// Retorna:
//   - application/json  ? dados estruturados da grade (para debug / preview)
//   - application/pdf   ? arquivo binário (quando header Accept: application/pdf)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarBufferPDF } from '@/lib/relatorios/gradeInstitucional'
import type { DiaSemana, Turno } from '@prisma/client'

interface AlocacaoRaw {
  id: string
  disciplinaId: string
  professorId: string | null
  blocoId: string
  diaSemana: DiaSemana
  disciplina: { nome: string }
  professor: { usuario: { nome: string } } | null
  bloco: { inicio: string; fim: string; turno: string }
}

interface TurmaRaw {
  id: string
  codigo: string
  nome: string
  periodo: number
  turno: Turno
  alocacoes: AlocacaoRaw[]
  curso: {
    disciplinas: Array<{
      disciplinaId: string
      periodo: number
      disciplina: { id: string; nome: string; ativo: boolean }
    }>
  }
  sala?: string | null
}

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
        { status: 400 },
      )
    }

    const [curso, periodoLetivo] = await Promise.all([
      prisma.curso.findUnique({ where: { id: cursoId } }),
      prisma.periodoLetivo.findUnique({ where: { id: periodoLetivoId } }),
    ])

    if (!curso || !periodoLetivo) {
      return NextResponse.json(
        { error: 'Curso ou período letivo não encontrado' },
        { status: 404 },
      )
    }

    const turmas = (await prisma.turma.findMany({
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
          orderBy: [{ bloco: { ordem: 'asc' } }, { diaSemana: 'asc' }],
        },
      },
      orderBy: [{ periodo: 'asc' }, { turno: 'asc' }, { codigo: 'asc' }],
    })) as unknown as TurmaRaw[]

    if (turmas.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma turma encontrada para este curso e período' },
        { status: 404 },
      )
    }

    const payload = {
      curso: { id: curso.id, nome: curso.nome },
      periodoLetivo: { id: periodoLetivo.id, descricao: periodoLetivo.descricao },
      turmas: turmas.map((turma) => {
        const disciplinasDoPeriodo = turma.curso.disciplinas.filter(
          (cd) => cd.periodo === turma.periodo && cd.disciplina.ativo,
        )
        const idsAlocadas = new Set(turma.alocacoes.map((a) => a.disciplinaId))

        return {
          turma: {
            id: turma.id,
            codigo: turma.codigo,
            nome: turma.nome,
            periodo: turma.periodo,
            turno: turma.turno,
            sala: (turma as unknown as { sala?: string | null }).sala ?? null,
          },
          alocadas: turma.alocacoes
            .filter((a) => a.bloco)
            .map((a) => ({
              turmaId: turma.id,
              turmaNome: turma.nome,
              disciplinaId: a.disciplinaId,
              disciplinaNome: a.disciplina.nome,
              professorId: a.professorId ?? null,
              professorNome: a.professor?.usuario.nome ?? 'Não informado',
              blocoId: a.blocoId,
              blocoInicio: a.bloco.inicio,
              blocoFim: a.bloco.fim,
              diaSemana: a.diaSemana,
            })),
          pendencias: disciplinasDoPeriodo
            .filter((cd) => !idsAlocadas.has(cd.disciplinaId))
            .map((cd) => ({
              disciplinaId: cd.disciplinaId,
              disciplinaNome: cd.disciplina.nome,
            })),
        }
      }),
    }

    const accept = request.headers.get('accept') ?? ''

    if (accept.includes('application/pdf')) {
      const buffer = await gerarBufferPDF(payload)

      const nomeArquivo = `SIGHA_Grade_${curso.nome.replace(/\s+/g, '_')}_${periodoLetivo.descricao}.pdf`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

      const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)

      return new NextResponse(uint8 as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
          'Content-Length': String(buffer.byteLength),
        },
      })
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    console.error('[GET /api/relatorios/grade]', error)
    return NextResponse.json(
      { error: 'Erro interno ao gerar relatório' },
      { status: 500 },
    )
  }
}
