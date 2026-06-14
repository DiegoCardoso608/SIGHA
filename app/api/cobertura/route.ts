import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { DiaSemana, Turno } from '@prisma/client'

const DIAS: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']
const DIAS_UTEIS: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA']
const TURNOS: Turno[] = ['MANHA', 'TARDE', 'NOITE']

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  }

  const periodoLetivoId = request.nextUrl.searchParams.get('periodoLetivoId')
  const cursoId = request.nextUrl.searchParams.get('cursoId')

  const periodoLetivo = periodoLetivoId
    ? await prisma.periodoLetivo.findUnique({ where: { id: periodoLetivoId } })
    : await prisma.periodoLetivo.findFirst({
        where: { status: { in: ['ATIVO', 'PLANEJAMENTO'] } },
        orderBy: [{ ano: 'desc' }, { semestre: 'desc' }],
      })

  if (!periodoLetivo) {
    return NextResponse.json({ error: 'Nenhum periodo letivo encontrado' }, { status: 404 })
  }

  const turmas = await prisma.turma.findMany({
    where: {
      periodoLetivoId: periodoLetivo.id,
      ativo: true,
      ...(cursoId ? { cursoId } : {}),
    },
  })

  const cursoIds = [...new Set(turmas.map((t) => t.cursoId))]
  const cursoDisciplinas = cursoIds.length
    ? await prisma.cursoDisciplina.findMany({ where: { cursoId: { in: cursoIds } } })
    : []

  const qtdDisciplinasPorCursoPeriodo = new Map<string, number>()
  for (const cd of cursoDisciplinas) {
    const chave = `${cd.cursoId}-${cd.periodo}`
    qtdDisciplinasPorCursoPeriodo.set(chave, (qtdDisciplinasPorCursoPeriodo.get(chave) ?? 0) + 1)
  }

  const demandaPorTurno: Record<Turno, number> = { MANHA: 0, TARDE: 0, NOITE: 0 }
  for (const turma of turmas) {
    const qtd = qtdDisciplinasPorCursoPeriodo.get(`${turma.cursoId}-${turma.periodo}`) ?? 0
    demandaPorTurno[turma.turno] += qtd
  }

  const necessarioPorDiaTurno = new Map<string, number>()
  for (const turno of TURNOS) {
    const necessarioDia = Math.ceil(demandaPorTurno[turno] / DIAS_UTEIS.length)
    for (const dia of DIAS) {
      necessarioPorDiaTurno.set(`${dia}-${turno}`, DIAS_UTEIS.includes(dia) ? necessarioDia : 0)
    }
  }

  const disponibilidades = await prisma.disponibilidadeBloco.findMany({
    where: { disponivel: true },
    include: { professor: true, bloco: true },
  })

  const disponiveisPorDiaTurno = new Map<string, { titulares: Set<string>; reserva: Set<string> }>()
  for (const dia of DIAS) {
    for (const turno of TURNOS) {
      disponiveisPorDiaTurno.set(`${dia}-${turno}`, { titulares: new Set(), reserva: new Set() })
    }
  }

  for (const d of disponibilidades) {
    const chave = `${d.diaSemana}-${d.bloco.turno}`
    const grupo = disponiveisPorDiaTurno.get(chave)
    if (!grupo) continue
    if (d.professor.tipo === 'RESERVA') {
      grupo.reserva.add(d.professorId)
    } else {
      grupo.titulares.add(d.professorId)
    }
  }

  const resumo = DIAS.flatMap((diaSemana) =>
    TURNOS.map((turno) => {
      const chave = `${diaSemana}-${turno}`
      const necessario = necessarioPorDiaTurno.get(chave) ?? 0
      const grupo = disponiveisPorDiaTurno.get(chave)!
      const disponivelTitulares = grupo.titulares.size
      const disponivelReserva = grupo.reserva.size
      const cobertura = necessario > 0 ? disponivelTitulares / necessario : 1
      const status = necessario === 0 || cobertura >= 1 ? 'OK' : cobertura < 0.5 ? 'CRITICO' : 'ATENCAO'

      return {
        diaSemana,
        turno,
        necessario,
        disponivelTitulares,
        disponivelReserva,
        cobertura: Math.round(cobertura * 100) / 100,
        status,
      }
    })
  )

  return NextResponse.json({
    periodoLetivo: { id: periodoLetivo.id, descricao: periodoLetivo.descricao },
    aviso:
      'O campo necessario e uma estimativa baseada na matriz curricular distribuida uniformemente entre os dias uteis.',
    resumo,
  })
}
