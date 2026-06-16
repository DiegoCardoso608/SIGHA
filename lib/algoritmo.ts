import { prisma } from './prisma'
import type { DiaSemana, Turno } from '@prisma/client'

// Sprint 6.1 - Algoritmo de alocação

export type TipoPendencia =
  | 'SEM_PROFESSOR_VINCULADO'
  | 'SEM_DISPONIBILIDADE_COMPATIVEL'
  | 'CARGA_HORARIA_ESGOTADA'
  | 'CONFLITO_DE_HORARIO'

export interface AlocacaoCriada {
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

export interface PendenciaDetalhada {
  turmaId: string
  turmaNome: string
  disciplinaId: string
  disciplinaNome: string
  tipoPendencia: TipoPendencia
  motivo: string
  professoresVinculados: number
  professoresDisponiveis: number
}

export interface ConflitoCruzado {
  professorId: string
  professorNome: string
  diaSemana: DiaSemana
  blocoInicio: string
  blocoFim: string
  turma1: string
  turma2: string
  disciplina1: string
  disciplina2: string
}

export interface ResultadoTurma {
  turma: { id: string; codigo: string; nome: string; periodo: number; turno: Turno }
  alocadas: AlocacaoCriada[]
  pendencias: PendenciaDetalhada[]
  conflitos: ConflitoCruzado[]
}

export interface ResultadoAlocacao {
  alocadas: AlocacaoCriada[]
  pendencias: PendenciaDetalhada[]
  conflitos: string[]
  resumo: { total: number; alocadas: number; pendentes: number; taxaSucesso: number }
}

export interface ResultadoGradeCurso {
  curso: { id: string; nome: string }
  periodoLetivo: { id: string; descricao: string }
  turmas: ResultadoTurma[]
  conflitosGlobais: ConflitoCruzado[]
  resumo: {
    totalDisciplinas: number
    totalAlocadas: number
    totalPendencias: number
    totalConflitos: number
    taxaSucesso: number
  }
}

// Internals
interface EstadoAlocacao {
  professorOcupado: Map<string, Set<string>>
  turmaOcupada: Map<string, Set<string>>
  horasAlocadas: Map<string, number>
  diasTurma: Map<string, Map<DiaSemana, number>>
  diasGlobal: Map<DiaSemana, number>
  cargaProfessorDia: Map<string, Map<DiaSemana, number>>
  encontrosDisciplinaTurma: Map<string, Map<DiaSemana, number>>
}

interface SlotCandidato {
  diaSemana: DiaSemana
  bloco: { id: string; inicio: string; fim: string; turno: Turno; ordem: number }
  professor: any
  pontuacao: number
}

const DIAS_SEMANA: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']

const PESO_DIA_TURMA = 30
const PESO_DIA_GLOBAL = 15
const PESO_PROF_DIA = 15
const PESO_PROF_CARGA = 10
const PESO_BLOCO_POSICAO = 20
const PESO_DISCIPLINA_DIA = 40

const SEMANAS_LETIVAS_PADRAO = 20
const prioridadeTipo: Record<string, number> = { TITULAR: 0, SUBSTITUTO: 1, RESERVA: 2 }

function chave(blocoId: string, diaSemana: string) {
  return `${blocoId}|${diaSemana}`
}

function chaveDisciplinaTurma(disciplinaId: string, turmaId: string) {
  return `${disciplinaId}|${turmaId}`
}

function turnoCompativel(turnoTurma: Turno, turnoBloco: Turno) {
  return turnoTurma === turnoBloco
}

function calcularNecessidadeSemanal(cargaHoraria: number, semanasLetivas = SEMANAS_LETIVAS_PADRAO) {
  const necessidade = Math.ceil(cargaHoraria / semanasLetivas)
  return Math.max(1, Math.min(5, necessidade))
}

function calcularSemanasLetivas(dataInicio: Date, dataFim: Date) {
  const msEmUmaSemana = 7 * 24 * 60 * 60 * 1000
  const diffMs = dataFim.getTime() - dataInicio.getTime()
  const semanas = Math.floor(diffMs / msEmUmaSemana)
  return Math.max(10, Math.min(26, semanas))
}

function classificarPendencia({ professoresVinculados, todosNoLimite, semDisponibilidade }: any): { tipoPendencia: TipoPendencia; motivo: string } {
  if (professoresVinculados === 0) return { tipoPendencia: 'SEM_PROFESSOR_VINCULADO', motivo: 'Nenhum professor está vinculado a esta disciplina.' }
  if (todosNoLimite) return { tipoPendencia: 'CARGA_HORARIA_ESGOTADA', motivo: 'Todos os professores autorizados atingiram o limite de carga horária.' }
  if (semDisponibilidade) return { tipoPendencia: 'SEM_DISPONIBILIDADE_COMPATIVEL', motivo: 'Professores vinculados encontrados, porém nenhum possui disponibilidade compatível com a turma.' }
  return { tipoPendencia: 'CONFLITO_DE_HORARIO', motivo: 'Os professores autorizados já estão alocados nos horários disponíveis para esta turma.' }
}

function pontuar({ diaSemana, blocoOrdem, turmaId, professorId, disciplinaId, totalBlocosNoTurno, estado }: any) {
  let pontos = 100
  const alocacoesDiaTurma = estado.diasTurma.get(turmaId)?.get(diaSemana) ?? 0
  pontos -= alocacoesDiaTurma * PESO_DIA_TURMA
  const maxGlobal = Math.max(...DIAS_SEMANA.map((d) => estado.diasGlobal.get(d) ?? 0), 1)
  const proporcaoGlobal = (estado.diasGlobal.get(diaSemana) ?? 0) / maxGlobal
  pontos -= proporcaoGlobal * PESO_DIA_GLOBAL
  const alocacoesProfDia = estado.cargaProfessorDia.get(professorId)?.get(diaSemana) ?? 0
  pontos -= alocacoesProfDia * PESO_PROF_DIA
  const cargaAtual = estado.horasAlocadas.get(professorId) ?? 0
  pontos -= cargaAtual * PESO_PROF_CARGA
  if (totalBlocosNoTurno > 1) {
    const proporcaoInicial = 1 - (blocoOrdem - 1) / (totalBlocosNoTurno - 1)
    pontos += proporcaoInicial * PESO_BLOCO_POSICAO
  }
  const chaveDisc = chaveDisciplinaTurma(disciplinaId, turmaId)
  const encontrosDia = estado.encontrosDisciplinaTurma.get(chaveDisc)?.get(diaSemana) ?? 0
  if (encontrosDia > 0) pontos -= encontrosDia * PESO_DISCIPLINA_DIA
  return pontos
}

function registrarNoEstado({ turmaId, professorId, blocoId, diaSemana, disciplinaId, estado }: any) {
  const slot = chave(blocoId, diaSemana)
  if (!estado.professorOcupado.has(professorId)) estado.professorOcupado.set(professorId, new Set())
  estado.professorOcupado.get(professorId)!.add(slot)
  if (!estado.turmaOcupada.has(turmaId)) estado.turmaOcupada.set(turmaId, new Set())
  estado.turmaOcupada.get(turmaId)!.add(slot)
  estado.horasAlocadas.set(professorId, (estado.horasAlocadas.get(professorId) ?? 0) + 1)
  if (!estado.diasTurma.has(turmaId)) estado.diasTurma.set(turmaId, new Map())
  const diasTurma = estado.diasTurma.get(turmaId)!
  diasTurma.set(diaSemana, (diasTurma.get(diaSemana) ?? 0) + 1)
  estado.diasGlobal.set(diaSemana, (estado.diasGlobal.get(diaSemana) ?? 0) + 1)
  if (!estado.cargaProfessorDia.has(professorId)) estado.cargaProfessorDia.set(professorId, new Map())
  const cargaDia = estado.cargaProfessorDia.get(professorId)!
  cargaDia.set(diaSemana, (cargaDia.get(diaSemana) ?? 0) + 1)
  const chaveDisc = chaveDisciplinaTurma(disciplinaId, turmaId)
  if (!estado.encontrosDisciplinaTurma.has(chaveDisc)) estado.encontrosDisciplinaTurma.set(chaveDisc, new Map())
  const encDia = estado.encontrosDisciplinaTurma.get(chaveDisc)!
  encDia.set(diaSemana, (encDia.get(diaSemana) ?? 0) + 1)
}

function detectarConflitosCruzados(alocadas: AlocacaoCriada[], blocos: Array<{ id: string; inicio: string; fim: string }>) {
  const conflitos: ConflitoCruzado[] = []
  const mapaBlocos = new Map(blocos.map((b) => [b.id, b]))
  const porProfessor = new Map<string, AlocacaoCriada[]>()
  for (const a of alocadas) {
    if (!porProfessor.has(a.professorId)) porProfessor.set(a.professorId, [])
    porProfessor.get(a.professorId)!.push(a)
  }
  for (const [, alocacoesProfessor] of porProfessor) {
    for (let i = 0; i < alocacoesProfessor.length; i++) {
      for (let j = i + 1; j < alocacoesProfessor.length; j++) {
        const a = alocacoesProfessor[i]
        const b = alocacoesProfessor[j]
        if (a.diaSemana === b.diaSemana && a.blocoId === b.blocoId && a.turmaId !== b.turmaId) {
          const bloco = mapaBlocos.get(a.blocoId)
          conflitos.push({
            professorId: a.professorId,
            professorNome: a.professorNome,
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
  return conflitos
}

function selecionarMelhorSlot({ turma, disciplinaId, professoresAutorizados, blocos, estado }: any): SlotCandidato | null {
  const blocosPorTurno = new Map<Turno, number>()
  for (const b of blocos) blocosPorTurno.set(b.turno, (blocosPorTurno.get(b.turno) ?? 0) + 1)
  let melhor: SlotCandidato | null = null
  for (const professor of professoresAutorizados) {
    const horasAtuais = professor.alocacoes.length + (estado.horasAlocadas.get(professor.id) ?? 0)
    if (horasAtuais >= professor.cargaHorariaMax) continue
    const slotsProf = professor.disponibilidadesBloco.length
      ? professor.disponibilidadesBloco.filter((db: any) => db.disponivel).map((db: any) => ({ diaSemana: db.diaSemana, bloco: db.bloco }))
      : professor.disponibilidades.flatMap((d: any) => blocos.filter((b: any) => b.turno === d.turno).map((b: any) => ({ diaSemana: d.diaSemana, bloco: b })))
    const slotsCompativeis = slotsProf.filter((s: any) => turnoCompativel(turma.turno, s.bloco.turno))
    for (const { diaSemana, bloco } of slotsCompativeis) {
      const slot = chave(bloco.id, diaSemana)
      if (estado.professorOcupado.get(professor.id)?.has(slot)) continue
      if (estado.turmaOcupada.get(turma.id)?.has(slot)) continue
      const totalBlocosNoTurno = blocosPorTurno.get(bloco.turno) ?? 1
      const pontuacao = pontuar({ diaSemana, blocoOrdem: bloco.ordem, turmaId: turma.id, professorId: professor.id, disciplinaId, totalBlocosNoTurno, estado })
      if (melhor === null || pontuacao > melhor.pontuacao) melhor = { diaSemana, bloco, professor, pontuacao }
    }
  }
  return melhor
}

function ordenarProfessores(professores: any[], estado: EstadoAlocacao) {
  return [...professores].sort((a, b) => {
    const tipoDiff = prioridadeTipo[a.tipo] - prioridadeTipo[b.tipo]
    if (tipoDiff !== 0) return tipoDiff
    const cargaA = a.alocacoes.length + (estado.horasAlocadas.get(a.id) ?? 0)
    const cargaB = b.alocacoes.length + (estado.horasAlocadas.get(b.id) ?? 0)
    if (cargaA !== cargaB) return cargaA - cargaB
    const slotsA = a.disponibilidadesBloco.length || a.disponibilidades.length
    const slotsB = b.disponibilidadesBloco.length || b.disponibilidades.length
    return slotsA - slotsB
  })
}

function criarEstadoVazio(): EstadoAlocacao {
  return { professorOcupado: new Map(), turmaOcupada: new Map(), horasAlocadas: new Map(), diasTurma: new Map(), diasGlobal: new Map(), cargaProfessorDia: new Map(), encontrosDisciplinaTurma: new Map() }
}

function preCarregarEstado(alocacoesExistentes: any[], estado: EstadoAlocacao) {
  for (const alocacao of alocacoesExistentes) {
    registrarNoEstado({ turmaId: alocacao.turmaId, professorId: alocacao.professorId ?? '__sem_professor__', blocoId: alocacao.blocoId, diaSemana: alocacao.diaSemana, disciplinaId: alocacao.disciplinaId, estado })
  }
}

function alocarDisciplinaCompleta({ turma, disciplina, professoresAutorizados, blocos, semanasLetivas, estado }: any) {
  const necessidade = calcularNecessidadeSemanal(disciplina.cargaHoraria, semanasLetivas)
  const alocadas: AlocacaoCriada[] = []
  const registros: any[] = []
  let encontrosRealizados = 0
  for (let encontro = 0; encontro < necessidade; encontro++) {
    const ordenados = ordenarProfessores(professoresAutorizados, estado)
    const melhor = selecionarMelhorSlot({ turma, disciplinaId: disciplina.id, professoresAutorizados: ordenados, blocos, estado })
    if (!melhor) break
    const { professor, bloco, diaSemana } = melhor
    alocadas.push({ turmaId: turma.id, turmaNome: turma.nome, disciplinaId: disciplina.id, disciplinaNome: disciplina.nome, professorId: professor.id, professorNome: professor.usuario.nome, blocoId: bloco.id, blocoInicio: bloco.inicio, blocoFim: bloco.fim, diaSemana })
    registros.push({ turmaId: turma.id, disciplinaId: disciplina.id, professorId: professor.id, blocoId: bloco.id, diaSemana, online: false, status: 'CONFIRMADA' })
    registrarNoEstado({ turmaId: turma.id, professorId: professor.id, blocoId: bloco.id, diaSemana, disciplinaId: disciplina.id, estado })
    encontrosRealizados++
  }
  const pendencias: PendenciaDetalhada[] = []
  if (encontrosRealizados < necessidade) {
    const professoresComDisponibilidade = professoresAutorizados.filter((p: any) => {
      const slots = p.disponibilidadesBloco.length ? p.disponibilidadesBloco.filter((db: any) => db.disponivel).map((db: any) => db.bloco) : blocos.filter((b: any) => p.disponibilidades.some((d: any) => d.turno === b.turno))
      return slots.some((b: any) => turnoCompativel(turma.turno, b.turno))
    }).length
    const todosNoLimite = professoresAutorizados.every((p: any) => p.alocacoes.length + (estado.horasAlocadas.get(p.id) ?? 0) >= p.cargaHorariaMax)
    const faltantes = necessidade - encontrosRealizados
    for (let i = 0; i < faltantes; i++) {
      pendencias.push({ turmaId: turma.id, turmaNome: turma.nome, disciplinaId: disciplina.id, disciplinaNome: disciplina.nome, ...classificarPendencia({ professoresVinculados: professoresAutorizados.length, professoresDisponiveis: professoresComDisponibilidade, todosNoLimite, semDisponibilidade: professoresComDisponibilidade === 0 }), professoresVinculados: professoresAutorizados.length, professoresDisponiveis: professoresComDisponibilidade })
    }
  }
  return { alocadas, pendencias, registros }
}

export async function gerarGrade({ periodoLetivoId, turmaIds, substituirExistentes = false }: any): Promise<ResultadoAlocacao> {
  const [periodoLetivo, turmas, professores, blocos] = await Promise.all([
    prisma.periodoLetivo.findUnique({ where: { id: periodoLetivoId } }),
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
        disponibilidadesBloco: { where: { disponivel: true }, include: { bloco: true } },
        alocacoes: { where: { status: { not: 'CONFLITO' } } },
      },
    }),
    prisma.blocoHorario.findMany({ orderBy: [{ turno: 'asc' }, { ordem: 'asc' }] }),
  ])
  const semanasLetivas = periodoLetivo ? calcularSemanasLetivas(periodoLetivo.dataInicio, periodoLetivo.dataFim) : SEMANAS_LETIVAS_PADRAO
  const estado = criarEstadoVazio()
  if (substituirExistentes) {
    await prisma.alocacao.deleteMany({ where: { turma: { periodoLetivoId, ...(turmaIds?.length ? { id: { in: turmaIds } } : {}) } } })
  } else {
    const alocacoesExistentes = await prisma.alocacao.findMany({ where: { turma: { periodoLetivoId }, status: { not: 'CONFLITO' } }, select: { professorId: true, turmaId: true, blocoId: true, diaSemana: true, disciplinaId: true } })
    preCarregarEstado(alocacoesExistentes, estado)
  }
  const resultado: ResultadoAlocacao = { alocadas: [], pendencias: [], conflitos: [], resumo: { total: 0, alocadas: 0, pendentes: 0, taxaSucesso: 0 } }
  const novasAlocacoes: any[] = []
  for (const turma of turmas) {
    const disciplinasDoPeriodo = turma.curso.disciplinas.filter((cd: any) => cd.periodo === turma.periodo && cd.disciplina.ativo)
    if (!estado.turmaOcupada.has(turma.id)) estado.turmaOcupada.set(turma.id, new Set())
    for (const cursoDisciplina of disciplinasDoPeriodo) {
      const disciplina = cursoDisciplina.disciplina
      const necessidade = calcularNecessidadeSemanal(disciplina.cargaHoraria, semanasLetivas)
      resultado.resumo.total += necessidade
      if (!substituirExistentes) {
        const encontrosExistentes = await prisma.alocacao.count({ where: { turmaId: turma.id, disciplinaId: disciplina.id, status: { not: 'CONFLITO' } } })
        if (encontrosExistentes >= necessidade) { resultado.resumo.alocadas += encontrosExistentes; continue }
      }
      const professoresAutorizados = professores.filter((p: any) => p.disciplinas.some((pd: any) => pd.disciplinaId === disciplina.id))
      if (professoresAutorizados.length === 0) {
        for (let i = 0; i < necessidade; i++) resultado.pendencias.push({ turmaId: turma.id, turmaNome: turma.nome, disciplinaId: disciplina.id, disciplinaNome: disciplina.nome, ...classificarPendencia({ professoresVinculados: 0, professoresDisponiveis: 0, todosNoLimite: false, semDisponibilidade: false }), professoresVinculados: 0, professoresDisponiveis: 0 })
        continue
      }
      const saida = alocarDisciplinaCompleta({ turma: { id: turma.id, nome: turma.nome, turno: turma.turno }, disciplina: { id: disciplina.id, nome: disciplina.nome, cargaHoraria: disciplina.cargaHoraria }, professoresAutorizados, blocos, semanasLetivas, estado })
      resultado.alocadas.push(...saida.alocadas)
      resultado.pendencias.push(...saida.pendencias)
      novasAlocacoes.push(...saida.registros)
    }
  }
  if (novasAlocacoes.length > 0) await prisma.alocacao.createMany({ data: novasAlocacoes })
  resultado.resumo.alocadas += resultado.alocadas.length
  resultado.resumo.pendentes = resultado.pendencias.length
  resultado.resumo.taxaSucesso = resultado.resumo.total > 0 ? Math.round((resultado.resumo.alocadas / resultado.resumo.total) * 100) : 0
  return resultado
}

export async function gerarGradeCurso({ cursoId, periodoLetivoId, substituirExistentes = false }: any): Promise<ResultadoGradeCurso> {
  const [curso, periodoLetivo, turmas, professores, blocos] = await Promise.all([
    prisma.curso.findUnique({ where: { id: cursoId } }),
    prisma.periodoLetivo.findUnique({ where: { id: periodoLetivoId } }),
    prisma.turma.findMany({
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
      },
      orderBy: [{ periodo: 'asc' }, { turno: 'asc' }, { codigo: 'asc' }],
    }),
    prisma.professor.findMany({
      where: { ativo: true },
      include: {
        usuario: { select: { nome: true } },
        disciplinas: true,
        disponibilidades: true,
        disponibilidadesBloco: { where: { disponivel: true }, include: { bloco: true } },
        alocacoes: { where: { status: { not: 'CONFLITO' } } },
      },
    }),
    prisma.blocoHorario.findMany({ orderBy: [{ turno: 'asc' }, { ordem: 'asc' }] }),
  ])
  if (!curso || !periodoLetivo) throw new Error('Curso ou período letivo não encontrado.')
  const semanasLetivas = calcularSemanasLetivas(periodoLetivo.dataInicio, periodoLetivo.dataFim)
  if (substituirExistentes) await prisma.alocacao.deleteMany({ where: { turma: { cursoId, periodoLetivoId } } })
  const estado = criarEstadoVazio()
  if (!substituirExistentes) {
    const alocacoesExistentes = await prisma.alocacao.findMany({ where: { turma: { cursoId, periodoLetivoId }, status: { not: 'CONFLITO' } }, select: { professorId: true, turmaId: true, blocoId: true, diaSemana: true, disciplinaId: true } })
    preCarregarEstado(alocacoesExistentes, estado)
  }
  const resultadosPorTurma: ResultadoTurma[] = []
  const todasAlocadasGlobal: AlocacaoCriada[] = []
  const novasAlocacoes: any[] = []
  for (const turma of turmas) {
    const disciplinasDoPeriodo = turma.curso.disciplinas.filter((cd: any) => cd.periodo === turma.periodo && cd.disciplina.ativo)
    if (!estado.turmaOcupada.has(turma.id)) estado.turmaOcupada.set(turma.id, new Set())
    const alocadasTurma: AlocacaoCriada[] = []
    const pendenciasTurma: PendenciaDetalhada[] = []
    for (const cursoDisciplina of disciplinasDoPeriodo) {
      const disciplina = cursoDisciplina.disciplina
      if (!substituirExistentes) {
        const necessidade = calcularNecessidadeSemanal(disciplina.cargaHoraria, semanasLetivas)
        const encontrosExistentes = await prisma.alocacao.count({ where: { turmaId: turma.id, disciplinaId: disciplina.id, status: { not: 'CONFLITO' } } })
        if (encontrosExistentes >= necessidade) continue
      }
      const professoresAutorizados = professorsFilter(professores, disciplina.id)
      if (professoresAutorizados.length === 0) {
        const necessidade = calcularNecessidadeSemanal(disciplina.cargaHoraria, semanasLetivas)
        for (let i = 0; i < necessidade; i++) pendenciasTurma.push({ turmaId: turma.id, turmaNome: turma.nome, disciplinaId: disciplina.id, disciplinaNome: disciplina.nome, ...classificarPendencia({ professoresVinculados: 0, professoresDisponiveis: 0, todosNoLimite: false, semDisponibilidade: false }), professoresVinculados: 0, professoresDisponiveis: 0 })
        continue
      }
      const saida = alocarDisciplinaCompleta({ turma: { id: turma.id, nome: turma.nome, turno: turma.turno }, disciplina: { id: disciplina.id, nome: disciplina.nome, cargaHoraria: disciplina.cargaHoraria }, professoresAutorizados, blocos, semanasLetivas, estado })
      alocadasTurma.push(...saida.alocadas)
      pendenciasTurma.push(...saida.pendencias)
      novasAlocacoes.push(...saida.registros)
      todasAlocadasGlobal.push(...saida.alocadas)
    }
    resultadosPorTurma.push({ turma: { id: turma.id, codigo: turma.codigo, nome: turma.nome, periodo: turma.periodo, turno: turma.turno }, alocadas: alocadasTurma, pendencias: pendenciasTurma, conflitos: [] })
  }
  if (novasAlocacoes.length > 0) await prisma.alocacao.createMany({ data: novasAlocacoes })
  const conflitosGlobais = detectarConflitosCruzados(todasAlocadasGlobal, blocos)
  if (conflitosGlobais.length > 0) {
    for (const conflito of conflitosGlobais) {
      await prisma.alocacao.updateMany({ where: { professorId: conflito.professorId, diaSemana: conflito.diaSemana, blocoId: novasAlocacoes.find((a) => a.diaSemana === conflito.diaSemana)?.blocoId, status: 'CONFIRMADA' }, data: { status: 'CONFLITO' } })
    }
    for (const resultadoTurma of resultadosPorTurma) resultadoTurma.conflitos = conflitosGlobais.filter((c) => c.turma1 === resultadoTurma.turma.nome || c.turma2 === resultadoTurma.turma.nome)
  }
  const totalAlocadas = resultadosPorTurma.reduce((acc, r) => acc + r.alocadas.length, 0)
  const totalPendencias = resultadosPorTurma.reduce((acc, r) => acc + r.pendencias.length, 0)
  const totalDisciplinas = totalAlocadas + totalPendencias
  return { curso: { id: curso.id, nome: curso.nome }, periodoLetivo: { id: periodoLetivo.id, descricao: periodoLetivo.descricao }, turmas: resultadosPorTurma, conflitosGlobais, resumo: { totalDisciplinas, totalAlocadas, totalPendencias, totalConflitos: conflitosGlobais.length, taxaSucesso: totalDisciplinas > 0 ? Math.round((totalAlocadas / totalDisciplinas) * 100) : 0 } }
}

// Helper to filter professors (kept small to avoid repeated inline code)
function professorsFilter(professores: any[], disciplinaId: string) {
  return professores.filter((p: any) => p.disciplinas.some((pd: any) => pd.disciplinaId === disciplinaId))
}

export async function simularAlocacao({ alocacaoId, turmaId, disciplinaId, professorId, blocoId, diaSemana }: any): Promise<{ valido: boolean; erros: string[] }> {
  const erros: string[] = []
  const [professor, bloco, turma] = await Promise.all([
    prisma.professor.findUnique({ where: { id: professorId }, include: { usuario: { select: { nome: true } }, disciplinas: true, disponibilidades: true, disponibilidadesBloco: { where: { disponivel: true } }, alocacoes: { where: { status: { not: 'CONFLITO' }, ...(alocacaoId ? { id: { not: alocacaoId } } : {}) } } } }),
    prisma.blocoHorario.findUnique({ where: { id: blocoId } }),
    prisma.turma.findUnique({ where: { id: turmaId } }),
  ])
  if (!professor) return { valido: false, erros: ['Professor nao encontrado'] }
  if (!bloco) return { valido: false, erros: ['Bloco nao encontrado'] }
  if (!turma) return { valido: false, erros: ['Turma nao encontrada'] }
  if (!professor.disciplinas.some((pd: any) => pd.disciplinaId === disciplinaId)) erros.push(`${professor.usuario.nome} nao esta autorizado para esta disciplina`)
  const temDisponibilidadePorBloco = professor.disponibilidadesBloco.length > 0
  const disponivel = temDisponibilidadePorBloco ? professor.disponibilidadesBloco.some((db: any) => db.diaSemana === diaSemana && db.blocoId === blocoId) : professor.disponibilidades.some((d: any) => d.diaSemana === diaSemana && d.turno === bloco.turno)
  if (!disponivel) erros.push(`${professor.usuario.nome} nao esta disponivel neste dia e horario`)
  if (!turnoCompativel(turma.turno, bloco.turno)) erros.push('O bloco selecionado nao pertence ao turno da turma')
  const [conflitoProfessor, conflitoTurma] = await Promise.all([
    prisma.alocacao.findFirst({ where: { professorId, blocoId, diaSemana, status: { not: 'CONFLITO' }, ...(alocacaoId ? { id: { not: alocacaoId } } : {}) } }),
    prisma.alocacao.findFirst({ where: { turmaId, blocoId, diaSemana, status: { not: 'CONFLITO' }, ...(alocacaoId ? { id: { not: alocacaoId } } : {}) } }),
  ])
  if (conflitoProfessor) erros.push(`${professor.usuario.nome} ja esta alocado neste horario`)
  if (conflitoTurma) erros.push('Esta turma ja possui aula neste horario')
  if (professor.alocacoes.length >= professor.cargaHorariaMax) erros.push(`${professor.usuario.nome} atingiu a carga horaria maxima`)
  return { valido: erros.length === 0, erros }
}
