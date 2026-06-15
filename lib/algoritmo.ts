import { prisma } from '@/lib/prisma'
import type { DiaSemana, Turno } from '@prisma/client'

export interface ResultadoAlocacao {
  alocadas: AlocacaoCriada[]
  pendencias: Pendencia[]
  conflitos: string[]
  resumo: {
    total: number
    alocadas: number
    pendentes: number
    taxaSucesso: number
  }
}

interface AlocacaoCriada {
  turmaId: string
  turmaNome: string
  disciplinaId: string
  disciplinaNome: string
  professorId: string
  professorNome: string
  blocoId: string
  blocoInicio: string
  blocoFim: string
  diaSemana: DiaSemana
}

interface Pendencia {
  turmaId: string
  turmaNome: string
  disciplinaId: string
  disciplinaNome: string
  motivo: string
}

interface EstadoAlocacao {
  professorOcupado: Map<string, Set<string>>
  turmaOcupada: Map<string, Set<string>>
  horasAlocadas: Map<string, number>
}

const prioridadeTipo = { TITULAR: 0, SUBSTITUTO: 1, RESERVA: 2 }

function chave(blocoId: string, diaSemana: string) {
  return `${blocoId}|${diaSemana}`
}

function turnoCompativel(turnoTurma: Turno, turnoBloco: Turno) {
  return turnoTurma === turnoBloco
}

export async function gerarGrade(params: {
  periodoLetivoId: string
  turmaIds?: string[]
  substituirExistentes?: boolean
}): Promise<ResultadoAlocacao> {
  const { periodoLetivoId, turmaIds, substituirExistentes = false } = params

  const [turmas, professores, blocos] = await Promise.all([
    prisma.turma.findMany({
      where: {
        periodoLetivoId,
        ativo: true,
        ...(turmaIds?.length ? { id: { in: turmaIds } } : {}),
      },
      include: {
        curso: {
          include: {
            disciplinas: {
              include: { disciplina: true },
              orderBy: { periodo: 'asc' },
            },
          },
        },
      },
      orderBy: [{ periodo: 'asc' }, { codigo: 'asc' }],
    }),
    prisma.professor.findMany({
      where: { ativo: true },
      include: {
        usuario: { select: { nome: true } },
        disciplinas: true,
        disponibilidades: true,
        disponibilidadesBloco: {
          where: { disponivel: true },
          include: { bloco: true },
        },
        alocacoes: {
          where: { status: { not: 'CONFLITO' } },
        },
      },
    }),
    prisma.blocoHorario.findMany({
      orderBy: [{ turno: 'asc' }, { ordem: 'asc' }],
    }),
  ])

  const estado: EstadoAlocacao = {
    professorOcupado: new Map(),
    turmaOcupada: new Map(),
    horasAlocadas: new Map(),
  }

  if (substituirExistentes) {
    await prisma.alocacao.deleteMany({
      where: {
        turma: {
          periodoLetivoId,
          ...(turmaIds?.length ? { id: { in: turmaIds } } : {}),
        },
      },
    })
  } else {
    const alocacoesExistentes = await prisma.alocacao.findMany({
      where: {
        turma: { periodoLetivoId },
        status: { not: 'CONFLITO' },
      },
    })

    for (const alocacao of alocacoesExistentes) {
      const slot = chave(alocacao.blocoId, alocacao.diaSemana)

      if (alocacao.professorId) {
        if (!estado.professorOcupado.has(alocacao.professorId)) {
          estado.professorOcupado.set(alocacao.professorId, new Set())
        }
        estado.professorOcupado.get(alocacao.professorId)?.add(slot)
        estado.horasAlocadas.set(
          alocacao.professorId,
          (estado.horasAlocadas.get(alocacao.professorId) ?? 0) + 1
        )
      }

      if (!estado.turmaOcupada.has(alocacao.turmaId)) {
        estado.turmaOcupada.set(alocacao.turmaId, new Set())
      }
      estado.turmaOcupada.get(alocacao.turmaId)?.add(slot)
    }
  }

  const professoresOrdenados = [...professores].sort((a, b) => {
    const slotsA = a.disponibilidadesBloco.length || a.disponibilidades.length
    const slotsB = b.disponibilidadesBloco.length || b.disponibilidades.length
    if (slotsA !== slotsB) return slotsA - slotsB
    return prioridadeTipo[a.tipo] - prioridadeTipo[b.tipo]
  })

  const resultado: ResultadoAlocacao = {
    alocadas: [],
    pendencias: [],
    conflitos: [],
    resumo: { total: 0, alocadas: 0, pendentes: 0, taxaSucesso: 0 },
  }

  const novasAlocacoes: Array<{
    turmaId: string
    disciplinaId: string
    professorId: string
    blocoId: string
    diaSemana: DiaSemana
    online: boolean
  }> = []

  for (const turma of turmas) {
    const disciplinasDoPeriodo = turma.curso.disciplinas.filter(
      (cursoDisciplina) => cursoDisciplina.periodo === turma.periodo && cursoDisciplina.disciplina.ativo
    )

    if (!estado.turmaOcupada.has(turma.id)) {
      estado.turmaOcupada.set(turma.id, new Set())
    }

    for (const cursoDisciplina of disciplinasDoPeriodo) {
      const disciplina = cursoDisciplina.disciplina
      resultado.resumo.total += 1

      if (!substituirExistentes) {
        const jaAlocada = await prisma.alocacao.findFirst({
          where: {
            turmaId: turma.id,
            disciplinaId: disciplina.id,
            status: { not: 'CONFLITO' },
          },
        })
        if (jaAlocada) {
          resultado.resumo.alocadas += 1
          continue
        }
      }

      const professoresAutorizados = professoresOrdenados.filter((professor) =>
        professor.disciplinas.some((profDisciplina) => profDisciplina.disciplinaId === disciplina.id)
      )

      if (professoresAutorizados.length === 0) {
        resultado.pendencias.push({
          turmaId: turma.id,
          turmaNome: turma.nome,
          disciplinaId: disciplina.id,
          disciplinaNome: disciplina.nome,
          motivo: 'Nenhum professor autorizado para esta disciplina',
        })
        continue
      }

      let alocado = false

      for (const professor of professoresAutorizados) {
        if (alocado) break

        const horasAtuais = professor.alocacoes.length + (estado.horasAlocadas.get(professor.id) ?? 0)
        if (horasAtuais >= professor.cargaHorariaMax) continue

        const slots = professor.disponibilidadesBloco.length
          ? professor.disponibilidadesBloco.map((disponibilidade) => ({
              diaSemana: disponibilidade.diaSemana,
              bloco: disponibilidade.bloco,
            }))
          : professor.disponibilidades.flatMap((disponibilidade) =>
              blocos
                .filter((bloco) => bloco.turno === disponibilidade.turno)
                .map((bloco) => ({ diaSemana: disponibilidade.diaSemana, bloco }))
            )

        for (const slotDisponivel of slots) {
          const { bloco, diaSemana } = slotDisponivel
          const slot = chave(bloco.id, diaSemana)

          if (!turnoCompativel(turma.turno, bloco.turno)) continue
          if (estado.professorOcupado.get(professor.id)?.has(slot)) continue
          if (estado.turmaOcupada.get(turma.id)?.has(slot)) continue

          novasAlocacoes.push({
            turmaId: turma.id,
            disciplinaId: disciplina.id,
            professorId: professor.id,
            blocoId: bloco.id,
            diaSemana,
            online: false,
          })

          if (!estado.professorOcupado.has(professor.id)) {
            estado.professorOcupado.set(professor.id, new Set())
          }
          estado.professorOcupado.get(professor.id)?.add(slot)
          estado.turmaOcupada.get(turma.id)?.add(slot)
          estado.horasAlocadas.set(professor.id, (estado.horasAlocadas.get(professor.id) ?? 0) + 1)

          resultado.alocadas.push({
            turmaId: turma.id,
            turmaNome: turma.nome,
            disciplinaId: disciplina.id,
            disciplinaNome: disciplina.nome,
            professorId: professor.id,
            professorNome: professor.usuario.nome,
            blocoId: bloco.id,
            blocoInicio: bloco.inicio,
            blocoFim: bloco.fim,
            diaSemana,
          })

          alocado = true
          break
        }
      }

      if (!alocado) {
        const todosNoLimite = professoresAutorizados.every((professor) => {
          const horas = professor.alocacoes.length + (estado.horasAlocadas.get(professor.id) ?? 0)
          return horas >= professor.cargaHorariaMax
        })

        resultado.pendencias.push({
          turmaId: turma.id,
          turmaNome: turma.nome,
          disciplinaId: disciplina.id,
          disciplinaNome: disciplina.nome,
          motivo: todosNoLimite
            ? 'Todos os professores autorizados atingiram a carga horaria maxima'
            : 'Nenhum professor autorizado possui disponibilidade compativel com a turma',
        })
      }
    }
  }

  if (novasAlocacoes.length > 0) {
    await prisma.alocacao.createMany({
      data: novasAlocacoes.map((alocacao) => ({ ...alocacao, status: 'CONFIRMADA' })),
    })
  }

  resultado.resumo.alocadas += resultado.alocadas.length
  resultado.resumo.pendentes = resultado.pendencias.length
  resultado.resumo.taxaSucesso =
    resultado.resumo.total > 0 ? Math.round((resultado.resumo.alocadas / resultado.resumo.total) * 100) : 0

  return resultado
}

export async function simularAlocacao(params: {
  alocacaoId?: string
  turmaId: string
  disciplinaId: string
  professorId: string
  blocoId: string
  diaSemana: DiaSemana
}): Promise<{ valido: boolean; erros: string[] }> {
  const { alocacaoId, turmaId, disciplinaId, professorId, blocoId, diaSemana } = params
  const erros: string[] = []

  const [professor, bloco, turma] = await Promise.all([
    prisma.professor.findUnique({
      where: { id: professorId },
      include: {
        usuario: { select: { nome: true } },
        disciplinas: true,
        disponibilidades: true,
        disponibilidadesBloco: { where: { disponivel: true } },
        alocacoes: {
          where: {
            status: { not: 'CONFLITO' },
            ...(alocacaoId ? { id: { not: alocacaoId } } : {}),
          },
        },
      },
    }),
    prisma.blocoHorario.findUnique({ where: { id: blocoId } }),
    prisma.turma.findUnique({ where: { id: turmaId } }),
  ])

  if (!professor) return { valido: false, erros: ['Professor nao encontrado'] }
  if (!bloco) return { valido: false, erros: ['Bloco nao encontrado'] }
  if (!turma) return { valido: false, erros: ['Turma nao encontrada'] }

  if (!professor.disciplinas.some((profDisciplina) => profDisciplina.disciplinaId === disciplinaId)) {
    erros.push(`${professor.usuario.nome} nao esta autorizado para esta disciplina`)
  }

  const temDisponibilidadePorBloco = professor.disponibilidadesBloco.length > 0
  const disponivel = temDisponibilidadePorBloco
    ? professor.disponibilidadesBloco.some(
        (disponibilidade) => disponibilidade.diaSemana === diaSemana && disponibilidade.blocoId === blocoId
      )
    : professor.disponibilidades.some(
        (disponibilidade) => disponibilidade.diaSemana === diaSemana && disponibilidade.turno === bloco.turno
      )

  if (!disponivel) {
    erros.push(`${professor.usuario.nome} nao esta disponivel neste dia e horario`)
  }

  if (!turnoCompativel(turma.turno, bloco.turno)) {
    erros.push('O bloco selecionado nao pertence ao turno da turma')
  }

  const [conflitoProfessor, conflitoTurma] = await Promise.all([
    prisma.alocacao.findFirst({
      where: {
        professorId,
        blocoId,
        diaSemana,
        status: { not: 'CONFLITO' },
        ...(alocacaoId ? { id: { not: alocacaoId } } : {}),
      },
    }),
    prisma.alocacao.findFirst({
      where: {
        turmaId,
        blocoId,
        diaSemana,
        status: { not: 'CONFLITO' },
        ...(alocacaoId ? { id: { not: alocacaoId } } : {}),
      },
    }),
  ])

  if (conflitoProfessor) {
    erros.push(`${professor.usuario.nome} ja esta alocado neste horario`)
  }

  if (conflitoTurma) {
    erros.push('Esta turma ja possui aula neste horario')
  }

  if (professor.alocacoes.length >= professor.cargaHorariaMax) {
    erros.push(`${professor.usuario.nome} atingiu a carga horaria maxima`)
  }

  return { valido: erros.length === 0, erros }
}
