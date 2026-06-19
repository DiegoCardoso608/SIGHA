import { prisma } from './prisma'
import type { DiaSemana, Turno } from '@prisma/client'

/**
 * Motor principal de alocação acadêmica.
 *
 * Este módulo recebe turmas, disciplinas, professores e blocos horários,
 * calcula a necessidade semanal de cada disciplina e tenta montar uma grade
 * compatível com disponibilidade, turno e carga horária.
 *
 * O resultado final é composto por alocações confirmadas, pendências e
 * conflitos identificados para posterior revisão manual.
 */

// Sprint 8 + 8.1 — Alocação por Dia Acadêmico + Política EAD/Online

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type TipoPendencia =
  | 'SEM_PROFESSOR_VINCULADO'
  | 'SEM_DISPONIBILIDADE_COMPATIVEL'
  | 'CARGA_HORARIA_ESGOTADA'
  | 'CONFLITO_DE_HORARIO'

export interface AlocacaoCriada {
  id?: string
  turmaId: string
  turmaNome: string
  disciplinaId: string
  disciplinaNome: string
  professorId: string | null
  professorNome: string | null
  blocoId: string
  blocoInicio: string
  blocoFim: string
  diaSemana: DiaSemana
  origem?: 'AUTOMATICA' | 'MANUAL'
  fixa?: boolean
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

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface BlocoHorario {
  id: string
  inicio: string
  fim: string
  turno: Turno
  ordem: number
}

interface GrupoCandidato {
  professorId: string
  professorNome: string
  professor: any
  diaSemana: DiaSemana
  blocos: BlocoHorario[]
  pontuacao: number
  hasUltimo?: boolean
}

interface EstadoAlocacao {
  // chave: `${blocoId}|${diaSemana}` → professorId ocupado
  professorOcupado: Map<string, Set<string>>
  turmaOcupada: Map<string, Set<string>>
  horasAlocadas: Map<string, number>
  // quantas aulas a turma tem naquele dia
  diasTurma: Map<string, Map<DiaSemana, number>>
  diasGlobal: Map<DiaSemana, number>
  // dias em que o professor comparece
  diasProfessor: Map<string, Set<DiaSemana>>
  cargaProfessorDia: Map<string, Map<DiaSemana, number>>
  // último bloco alocado na turma naquele dia (para verificar consecutividade)
  ultimoBlocoTurmaDia: Map<string, Map<DiaSemana, number>>
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIAS_SEMANA: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']
const DIAS_UTEIS: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA']

// Bônus
const BONUS_CONSECUTIVO = 60      // blocos em sequência sem buracos
const BONUS_MESMO_DIA = 40        // disciplina já tem aula naquele dia (concentrar)
const BONUS_CONTINUIDADE_DOCENTE = 25 // professor já está presente naquele dia
const BONUS_PRIMEIRO_BLOCO = 20   // blocos iniciais do turno são preferidos

// Sprint 8.2 additions
const PENALIDADE_EAD_HORARIO_NOBRE = 120
const PENALIDADE_FRAGMENTACAO_BASE = 30
const BONUS_OCUPACAO_VERTICAL = 25
// Penalidades
const PENALIDADE_DIA_CHEIO_TURMA = 35   // turma já tem muitas aulas no dia
const PENALIDADE_DISPERSAO_PROFESSOR = 20 // professor comparece em dia novo
const PENALIDADE_DIA_GLOBAL = 12        // dia já concentra muitas aulas no geral
const PENALIDADE_CARGA_PROFESSOR = 8    // professor mais carregado perde prioridade

// EAD: prioridade de dias
const DIAS_PRIORIDADE_ONLINE: DiaSemana[] = ['SABADO', 'SEXTA', 'QUINTA', 'QUARTA', 'TERCA', 'SEGUNDA']

const SEMANAS_LETIVAS_PADRAO = 20
const prioridadeTipo: Record<string, number> = { TITULAR: 0, SUBSTITUTO: 1, RESERVA: 2 }

// Sprint 8.3: configuração institucional — permitir presencial no sábado
const PERMITIR_PRESENCIAL_SABADO = false

// ─── Helpers básicos ──────────────────────────────────────────────────────────

function chaveSlot(blocoId: string, diaSemana: DiaSemana): string {
  return `${blocoId}|${diaSemana}`
}

function turnoCompativel(turnoTurma: Turno, turnoBloco: Turno): boolean {
  return turnoTurma === turnoBloco
}

function calcularBlocosSemanais(disciplina: { cargaHoraria: number; blocosSemanais?: number | null }): number {
  return Math.max(1, disciplina.blocosSemanais ?? 1)
}

function calcularSemanasLetivas(dataInicio: Date, dataFim: Date): number {
  const msEmUmaSemana = 7 * 24 * 60 * 60 * 1000
  const diffMs = dataFim.getTime() - dataInicio.getTime()
  const semanas = Math.floor(diffMs / msEmUmaSemana)
  return Math.max(10, Math.min(26, semanas))
}

function classificarPendencia({
  professoresVinculados,
  todosNoLimite,
  semDisponibilidade,
}: {
  professoresVinculados: number
  todosNoLimite: boolean
  semDisponibilidade: boolean
}): { tipoPendencia: TipoPendencia; motivo: string } {
  if (professoresVinculados === 0)
    return { tipoPendencia: 'SEM_PROFESSOR_VINCULADO', motivo: 'Nenhum professor está vinculado a esta disciplina.' }
  if (todosNoLimite)
    return { tipoPendencia: 'CARGA_HORARIA_ESGOTADA', motivo: 'Todos os professores autorizados atingiram o limite de carga horária.' }
  if (semDisponibilidade)
    return { tipoPendencia: 'SEM_DISPONIBILIDADE_COMPATIVEL', motivo: 'Professores vinculados encontrados, porém nenhum possui disponibilidade compatível com a turma.' }
  return { tipoPendencia: 'CONFLITO_DE_HORARIO', motivo: 'Os professores autorizados já estão alocados nos horários disponíveis para esta turma.' }
}

function professorsFilter(professores: any[], disciplinaId: string): any[] {
  return professores.filter((p: any) => p.disciplinas.some((pd: any) => pd.disciplinaId === disciplinaId))
}

// ─── Estado vazio e pré-carregamento ──────────────────────────────────────────

function criarEstadoVazio(): EstadoAlocacao {
  return {
    professorOcupado: new Map(),
    turmaOcupada: new Map(),
    horasAlocadas: new Map(),
    diasTurma: new Map(),
    diasGlobal: new Map(),
    diasProfessor: new Map(),
    cargaProfessorDia: new Map(),
    ultimoBlocoTurmaDia: new Map(),
  }
}

function registrarNoEstado({
  turmaId,
  professorId,
  blocoId,
  blocoOrdem,
  diaSemana,
  estado,
}: {
  turmaId: string
  professorId: string
  blocoId: string
  blocoOrdem: number
  diaSemana: DiaSemana
  estado: EstadoAlocacao
}) {
  const slot = chaveSlot(blocoId, diaSemana)

  if (!estado.professorOcupado.has(professorId)) estado.professorOcupado.set(professorId, new Set())
  estado.professorOcupado.get(professorId)!.add(slot)

  if (!estado.turmaOcupada.has(turmaId)) estado.turmaOcupada.set(turmaId, new Set())
  estado.turmaOcupada.get(turmaId)!.add(slot)

  estado.horasAlocadas.set(professorId, (estado.horasAlocadas.get(professorId) ?? 0) + 1)

  if (!estado.diasTurma.has(turmaId)) estado.diasTurma.set(turmaId, new Map())
  const dt = estado.diasTurma.get(turmaId)!
  dt.set(diaSemana, (dt.get(diaSemana) ?? 0) + 1)

  estado.diasGlobal.set(diaSemana, (estado.diasGlobal.get(diaSemana) ?? 0) + 1)

  if (!estado.diasProfessor.has(professorId)) estado.diasProfessor.set(professorId, new Set())
  estado.diasProfessor.get(professorId)!.add(diaSemana)

  if (!estado.cargaProfessorDia.has(professorId)) estado.cargaProfessorDia.set(professorId, new Map())
  const cpd = estado.cargaProfessorDia.get(professorId)!
  cpd.set(diaSemana, (cpd.get(diaSemana) ?? 0) + 1)

  // rastrear último bloco da turma naquele dia (para consecutividade)
  const chaveUlt = turmaId
  if (!estado.ultimoBlocoTurmaDia.has(chaveUlt)) estado.ultimoBlocoTurmaDia.set(chaveUlt, new Map())
  const ubd = estado.ultimoBlocoTurmaDia.get(chaveUlt)!
  const atual = ubd.get(diaSemana) ?? -1
  if (blocoOrdem > atual) ubd.set(diaSemana, blocoOrdem)
}

function preCarregarEstado(alocacoesExistentes: any[], blocosPorId: Map<string, BlocoHorario>, estado: EstadoAlocacao) {
  for (const a of alocacoesExistentes) {
    const bloco = blocosPorId.get(a.blocoId)
    registrarNoEstado({
      turmaId: a.turmaId,
      professorId: a.professorId ?? '__sem_professor__',
      blocoId: a.blocoId,
      blocoOrdem: bloco?.ordem ?? 0,
      diaSemana: a.diaSemana,
      estado,
    })
  }
}

// ─── Slots disponíveis do professor ──────────────────────────────────────────

function slotsDisponivelsProfessor(professor: any, blocos: BlocoHorario[]): Array<{ diaSemana: DiaSemana; bloco: BlocoHorario }> {
  if (professor.disponibilidadesBloco?.length > 0) {
    return professor.disponibilidadesBloco
      .filter((db: any) => db.disponivel)
      .map((db: any) => ({ diaSemana: db.diaSemana as DiaSemana, bloco: db.bloco as BlocoHorario }))
  }
  // fallback: disponibilidade por turno
  return professor.disponibilidades.flatMap((d: any) =>
    blocos.filter((b) => b.turno === d.turno).map((b) => ({ diaSemana: d.diaSemana as DiaSemana, bloco: b }))
  )
}

// ─── Sistema de pontuação por grupo ──────────────────────────────────────────

function pontuarGrupo({
  turmaId,
  professorId,
  diaSemana,
  blocos,
  estado,
  isOnline,
}: {
  turmaId: string
  professorId: string
  diaSemana: DiaSemana
  blocos: BlocoHorario[]
  estado: EstadoAlocacao
  isOnline: boolean
}): number {
  let pontos = 100

  // Bônus: consecutividade — verifica se os blocos formam sequência sem buracos
  const ordens = blocos.map((b) => b.ordem).sort((a, b) => a - b)
  let consecutivo = true
  for (let i = 1; i < ordens.length; i++) {
    if (ordens[i] !== ordens[i - 1] + 1) { consecutivo = false; break }
  }
  if (consecutivo && blocos.length > 1) pontos += BONUS_CONSECUTIVO

  // Bônus: disciplina/turma já tem aula nesse dia (concentrar encontros)
  const aulasNoDia = estado.diasTurma.get(turmaId)?.get(diaSemana) ?? 0
  if (aulasNoDia > 0 && aulasNoDia < 4) pontos += BONUS_MESMO_DIA

  // Bônus: professor já está presente nesse dia
  if (estado.diasProfessor.get(professorId)?.has(diaSemana)) pontos += BONUS_CONTINUIDADE_DOCENTE

  // Bônus: blocos iniciais do turno (primeiros são melhores)
  const menorOrdem = Math.min(...blocos.map((b) => b.ordem))
  pontos += Math.max(0, BONUS_PRIMEIRO_BLOCO - menorOrdem * 3)

  // Penalidade: turma já sobrecarregada nesse dia
  if (aulasNoDia >= 4) pontos -= PENALIDADE_DIA_CHEIO_TURMA * (aulasNoDia - 3)

  // Penalidade: dia global muito cheio
  const maxGlobal = Math.max(...DIAS_SEMANA.map((d) => estado.diasGlobal.get(d) ?? 0), 1)
  const proporcaoGlobal = (estado.diasGlobal.get(diaSemana) ?? 0) / maxGlobal
  pontos -= proporcaoGlobal * PENALIDADE_DIA_GLOBAL

  // Penalidade: professor comparece em dia novo (dispersão)
  if (!estado.diasProfessor.get(professorId)?.has(diaSemana)) pontos -= PENALIDADE_DISPERSAO_PROFESSOR

  // Penalidade: carga acumulada do professor
  const cargaAtual = estado.horasAlocadas.get(professorId) ?? 0
  pontos -= cargaAtual * PENALIDADE_CARGA_PROFESSOR

  // Disciplinas online: preferem SABADO (penalizar dias úteis principais)
  if (isOnline) {
    const indicePrioridade = DIAS_PRIORIDADE_ONLINE.indexOf(diaSemana)
    pontos += (DIAS_PRIORIDADE_ONLINE.length - indicePrioridade) * 15
  }

  // Penalizar EAD em horarios nobres (blocos centrais)
  if (isOnline) {
    const menorOrdem = Math.min(...blocos.map((b) => b.ordem))
    const maiorOrdem = Math.max(...blocos.map((b) => b.ordem))
    const media = (menorOrdem + maiorOrdem) / 2
    // blocos centrais aproximados -> aplicar penalidade
    pontos -= PENALIDADE_EAD_HORARIO_NOBRE * (blocos.length > 0 ? 1 : 0)
    // less penalty if bloco is late in turno (prefer last blocks)
    const ultimaOrdem = Math.max(...blocos.map((b) => b.ordem))
    pontos += Math.max(0, (BONUS_PRIMEIRO_BLOCO - ultimaOrdem)) * -1
  }

  return pontos
}

// ─── Busca de grupos de blocos consecutivos ───────────────────────────────────

/**
 * Tenta encontrar `qtd` blocos consecutivos disponíveis para a turma+professor
 * em um dado dia, preferindo os primeiros blocos do turno.
 */
function buscarBlocosConsecutivos({
  turmaId,
  professorId,
  diaSemana,
  qtd,
  blocosTurno,
  estado,
}: {
  turmaId: string
  professorId: string
  diaSemana: DiaSemana
  qtd: number
  blocosTurno: BlocoHorario[]
  estado: EstadoAlocacao
}): BlocoHorario[] | null {
  const ordenados = [...blocosTurno].sort((a, b) => a.ordem - b.ordem)

  for (let inicio = 0; inicio <= ordenados.length - qtd; inicio++) {
    const candidatos = ordenados.slice(inicio, inicio + qtd)

    // Verificar consecutividade real
    let consecutive = true
    for (let i = 1; i < candidatos.length; i++) {
      if (candidatos[i].ordem !== candidatos[i - 1].ordem + 1) { consecutive = false; break }
    }
    if (!consecutive) continue

    // Verificar disponibilidade de cada slot
    const todosLivres = candidatos.every((b) => {
      const slot = chaveSlot(b.id, diaSemana)
      return !estado.professorOcupado.get(professorId)?.has(slot)
        && !estado.turmaOcupada.get(turmaId)?.has(slot)
    })
    if (todosLivres) return candidatos
  }
  return null
}

// Gera todos os candidatos (grupos) possíveis para uma disciplina
function gerarCandidatosParaDisciplina({
  turma,
  disciplina,
  professoresAutorizados,
  blocos,
  semanasLetivas,
  estado,
}: {
  turma: { id: string; nome: string; turno: Turno }
  disciplina: { id: string; nome: string; cargaHoraria: number; blocosSemanais?: number | null; modalidade?: string }
  professoresAutorizados: any[]
  blocos: BlocoHorario[]
  semanasLetivas: number
  estado: EstadoAlocacao
}) {
  const isOnline = disciplina.modalidade === 'ONLINE'
  const necessidade = calcularBlocosSemanais(disciplina)
  const candidatosPorProfessorDia: Map<string, GrupoCandidato[]> = new Map()

  const blocosTurno = blocos.filter((b) => turnoCompativel(turma.turno, b.turno))

  for (const professor of professoresAutorizados) {
    const slotsProf = slotsDisponivelsProfessor(professor, blocos)
    const diasCandidatos = isOnline
      ? DIAS_PRIORIDADE_ONLINE
      : PERMITIR_PRESENCIAL_SABADO
      ? [...DIAS_UTEIS, 'SABADO' as DiaSemana]
      : [...DIAS_UTEIS]
    for (const dia of diasCandidatos) {
      const blocosProfDia = slotsProf.filter((s) => s.diaSemana === dia && turnoCompativel(turma.turno, s.bloco.turno)).map((s) => s.bloco)
      if (blocosProfDia.length === 0) continue
      // tentar grupos de 1..necessidade
      for (let qtd = Math.min(necessidade, blocosProfDia.length); qtd >= 1; qtd--) {
        const grupo = buscarBlocosConsecutivos({ turmaId: turma.id, professorId: professor.id, diaSemana: dia, qtd, blocosTurno: blocosProfDia, estado })
        if (!grupo) continue
        const pontuacao = pontuarGrupo({ turmaId: turma.id, professorId: professor.id, diaSemana: dia, blocos: grupo, estado, isOnline })
        const key = `${professor.id}|${dia}`
        // sinalizar se o grupo usa o ultimo bloco do turno
        const ordemMax = Math.max(...blocosTurno.map((b) => b.ordem))
        const hasUltimo = grupo.some((b) => b.ordem === ordemMax)
        if (!candidatosPorProfessorDia.has(key)) candidatosPorProfessorDia.set(key, [])
        candidatosPorProfessorDia.get(key)!.push({ professorId: professor.id, professorNome: professor.usuario.nome, professor, diaSemana: dia, blocos: grupo, pontuacao, hasUltimo })
      }
    }
  }

  return { necessidade, candidatosPorProfessorDia }
}

// Combina candidatos (grupos) para formar um plano completo cobrindo a necessidade
function escolherMelhorPlano({ necessidade, candidatosPorProfessorDia, estado, turmaId, isOnline }: { necessidade: number; candidatosPorProfessorDia: Map<string, GrupoCandidato[]>; estado: EstadoAlocacao; turmaId: string; isOnline: boolean }) {
  const allCandidates = Array.from(candidatosPorProfessorDia.values()).flat()
  let melhorPlano: GrupoCandidato[] = []
  let melhorScore = -Infinity

  function trySearch(candidatosList: GrupoCandidato[]) {
    function backtrack(start: number, chosen: GrupoCandidato[], chosenSlots: Set<string>) {
      const totalAulas = chosen.reduce((acc, g) => acc + g.blocos.length, 0)
      if (totalAulas === necessidade) {
        // pontuar plano com penalidades adicionais (fragmentação, compactacao docente, ocupacao vertical)
        let score = chosen.reduce((acc, g) => acc + g.pontuacao, 0)
        // fragmentação: penalizar número de dias usados
        const diasUsados = new Set(chosen.map((g) => g.diaSemana)).size
        score -= (diasUsados - 1) * PENALIDADE_FRAGMENTACAO_BASE
        // compactacao docente: penalizar número de dias distintos por professor
        const profDias = new Map<string, Set<DiaSemana>>() as any
        for (const g of chosen) {
          if (!profDias.has(g.professorId)) profDias.set(g.professorId, new Set())
          profDias.get(g.professorId).add(g.diaSemana)
        }
        for (const [_, ds] of profDias) score -= (ds.size - 1) * 10
        // ocupacao vertical: bonus se usar dias já presentes no estado.diasTurma
        for (const d of new Set(chosen.map((g) => g.diaSemana))) {
          if ((estado.diasTurma.get(turmaId)?.get(d) ?? 0) > 0) score += BONUS_OCUPACAO_VERTICAL
        }

        if (score > melhorScore) {
          melhorScore = score
          melhorPlano = [...chosen]
        }
        return
      }
      if (totalAulas > necessidade) return

      for (let i = start; i < candidatosList.length; i++) {
        const c = candidatosList[i]
        const overlap = c.blocos.some((b) => chosenSlots.has(chaveSlot(b.id, c.diaSemana)))
        if (overlap) continue
        const addedSlots = c.blocos.map((b) => chaveSlot(b.id, c.diaSemana))
        for (const s of addedSlots) chosenSlots.add(s)
        chosen.push(c)
        backtrack(i + 1, chosen, chosenSlots)
        chosen.pop()
        for (const s of addedSlots) chosenSlots.delete(s)
      }
    }

    backtrack(0, [], new Set())
  }

  // If EAD, first try plans restricted to Saturday and last-block candidates
  if (isOnline) {
    const preferenciais = allCandidates.filter((c) => c.diaSemana === 'SABADO' || c.hasUltimo)
    if (preferenciais.length > 0) trySearch(preferenciais)
    // if no valid plan found among preferenciais, fall back to all candidates
    if (melhorScore === -Infinity) trySearch(allCandidates)
  } else {
    // presencial: just search all candidates (Saturday excluded by generation)
    trySearch(allCandidates)
  }

  return { melhorPlano, melhorScore }
}

// ─── Ordenar professores ──────────────────────────────────────────────────────

function ordenarProfessores(professores: any[], estado: EstadoAlocacao): any[] {
  return [...professores].sort((a, b) => {
    // 1. Tipo: TITULAR > SUBSTITUTO > RESERVA
    const tipoDiff = prioridadeTipo[a.tipo ?? 'TITULAR'] - prioridadeTipo[b.tipo ?? 'TITULAR']
    if (tipoDiff !== 0) return tipoDiff
    // 2. Menor carga acumulada primeiro
    const cargaA = a.alocacoes.length + (estado.horasAlocadas.get(a.id) ?? 0)
    const cargaB = b.alocacoes.length + (estado.horasAlocadas.get(b.id) ?? 0)
    if (cargaA !== cargaB) return cargaA - cargaB
    // 3. Mais slots disponíveis primeiro
    const slotsA = a.disponibilidadesBloco?.length || a.disponibilidades?.length || 0
    const slotsB = b.disponibilidadesBloco?.length || b.disponibilidades?.length || 0
    return slotsA - slotsB
  })
}

// ─── Núcleo de alocação por Dia Acadêmico ────────────────────────────────────

interface OpcaoAloc {
  turma: { id: string; nome: string; turno: Turno }
  disciplina: { id: string; nome: string; cargaHoraria: number; blocosSemanais?: number | null; modalidade?: string }
  professoresAutorizados: any[]
  blocos: BlocoHorario[]
  semanasLetivas: number
  estado: EstadoAlocacao
}

interface SaidaAloc {
  alocadas: AlocacaoCriada[]
  pendencias: PendenciaDetalhada[]
  registros: any[]
}

function alocarDisciplinaCompleta(opcao: OpcaoAloc): SaidaAloc {
  const { turma, disciplina, professoresAutorizados, blocos, semanasLetivas, estado } = opcao
  const isOnline = disciplina.modalidade === 'ONLINE'
  const { necessidade, candidatosPorProfessorDia } = gerarCandidatosParaDisciplina({ turma, disciplina, professoresAutorizados, blocos, semanasLetivas, estado })

  const alocadas: AlocacaoCriada[] = []
  const registros: any[] = []

  if (candidatosPorProfessorDia.size === 0) {
    // Sem candidatos -> pendencias
    const professoresComDisponibilidade = 0
    const todosNoLimite = professoresAutorizados.every(
      (p: any) => p.alocacoes.length + (estado.horasAlocadas.get(p.id) ?? 0) >= p.cargaHorariaMax
    )
    const classPendencia = classificarPendencia({ professoresVinculados: professoresAutorizados.length, todosNoLimite, semDisponibilidade: true })
    const pendencias: PendenciaDetalhada[] = []
    for (let i = 0; i < necessidade; i++) {
      pendencias.push({ turmaId: turma.id, turmaNome: turma.nome, disciplinaId: disciplina.id, disciplinaNome: disciplina.nome, ...classPendencia, professoresVinculados: professoresAutorizados.length, professoresDisponiveis: 0 })
    }
    return { alocadas: [], pendencias, registros: [] }
  }

  const { melhorPlano } = escolherMelhorPlano({ necessidade, candidatosPorProfessorDia, estado, turmaId: turma.id, isOnline })

  // Aplicar melhorPlano ao estado e gerar registros
  for (const g of melhorPlano) {
    for (const bloco of g.blocos) {
      alocadas.push({ turmaId: turma.id, turmaNome: turma.nome, disciplinaId: disciplina.id, disciplinaNome: disciplina.nome, professorId: g.professorId, professorNome: g.professorNome, blocoId: bloco.id, blocoInicio: bloco.inicio, blocoFim: bloco.fim, diaSemana: g.diaSemana })
      registros.push({
        turmaId: turma.id,
        disciplinaId: disciplina.id,
        professorId: g.professorId,
        blocoId: bloco.id,
        diaSemana: g.diaSemana,
        online: isOnline,
        status: 'CONFIRMADA',
        origem: 'AUTOMATICA',
        fixa: false,
      })
      registrarNoEstado({ turmaId: turma.id, professorId: g.professorId, blocoId: bloco.id, blocoOrdem: bloco.ordem, diaSemana: g.diaSemana, estado })
    }
  }

  // construir pendencias caso não tenha sido possível completar
  const encontrosRealizados = alocadas.length
  const pendencias: PendenciaDetalhada[] = []
  if (encontrosRealizados < necessidade) {
    const professoresComDisponibilidade = professoresAutorizados.filter((p: any) => {
      const slots = slotsDisponivelsProfessor(p, blocos)
      return slots.some((s) => turnoCompativel(turma.turno, s.bloco.turno))
    }).length
    const todosNoLimite = professoresAutorizados.every(
      (p: any) => p.alocacoes.length + (estado.horasAlocadas.get(p.id) ?? 0) >= p.cargaHorariaMax
    )
    const classPendencia = classificarPendencia({ professoresVinculados: professoresAutorizados.length, todosNoLimite, semDisponibilidade: professoresComDisponibilidade === 0 })
    const faltantes = necessidade - encontrosRealizados
    for (let i = 0; i < faltantes; i++) {
      pendencias.push({ turmaId: turma.id, turmaNome: turma.nome, disciplinaId: disciplina.id, disciplinaNome: disciplina.nome, ...classPendencia, professoresVinculados: professoresAutorizados.length, professoresDisponiveis: professoresComDisponibilidade })
    }
  }

  return { alocadas, pendencias, registros }
}

// ─── Detecção de conflitos cruzados ──────────────────────────────────────────

function detectarConflitosCruzados(
  alocadas: AlocacaoCriada[],
  blocosPorId: Map<string, BlocoHorario>
): ConflitoCruzado[] {
  const conflitos: ConflitoCruzado[] = []
  const porProfessor = new Map<string, AlocacaoCriada[]>()

  for (const a of alocadas) {
    if (!a.professorId || !a.professorNome) continue
    if (!porProfessor.has(a.professorId)) porProfessor.set(a.professorId, [])
    porProfessor.get(a.professorId)!.push(a)
  }

  for (const [, lista] of porProfessor) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i]
        const b = lista[j]
        if (a.diaSemana === b.diaSemana && a.blocoId === b.blocoId && a.turmaId !== b.turmaId) {
          const bloco = blocosPorId.get(a.blocoId)
          const professorId = a.professorId!
          const professorNome = a.professorNome!
          conflitos.push({
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

  return conflitos
}

// ─── Separar disciplinas em online e presenciais (Sprint 8.1) ────────────────

function separarDisciplinas(disciplinas: any[]): { online: any[]; presenciais: any[] } {
  const online: any[] = []
  const presenciais: any[] = []
  for (const cd of disciplinas) {
    if (cd.disciplina.modalidade === 'ONLINE') {
      online.push(cd)
    } else {
      presenciais.push(cd)
    }
  }
  return { online, presenciais }
}

// ─── Função pública: gerarGrade (por período letivo / turmas) ────────────────

/**
 * Gera alocações automáticas para uma lista de turmas dentro de um período letivo.
 *
 * Se `substituirExistentes` for verdadeiro, as alocações automáticas anteriores
 * são removidas antes da nova tentativa de geração.
 */
export async function gerarGrade({
  periodoLetivoId,
  turmaIds,
  substituirExistentes = false,
}: {
  periodoLetivoId: string
  turmaIds?: string[]
  substituirExistentes?: boolean
}): Promise<ResultadoAlocacao> {
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

  const semanasLetivas = periodoLetivo
    ? calcularSemanasLetivas(periodoLetivo.dataInicio, periodoLetivo.dataFim)
    : SEMANAS_LETIVAS_PADRAO

  const blocosPorId = new Map(blocos.map((b) => [b.id, b as BlocoHorario]))
  const estado = criarEstadoVazio()

  if (substituirExistentes) {
    await prisma.alocacao.deleteMany({
      where: {
        turma: { periodoLetivoId, ...(turmaIds?.length ? { id: { in: turmaIds } } : {}) },
        origem: 'AUTOMATICA',
      },
    })
  }

  const existentes = await prisma.alocacao.findMany({
    where: {
      turma: { periodoLetivoId, ...(turmaIds?.length ? { id: { in: turmaIds } } : {}) },
      status: { not: 'CONFLITO' },
    },
    select: {
      professorId: true,
      turmaId: true,
      blocoId: true,
      diaSemana: true,
      disciplinaId: true,
      origem: true,
      fixa: true,
    },
  })
  preCarregarEstado(existentes, blocosPorId, estado)

  const resultado: ResultadoAlocacao = {
    alocadas: [],
    pendencias: [],
    conflitos: [],
    resumo: { total: 0, alocadas: 0, pendentes: 0, taxaSucesso: 0 },
  }
  const novasAlocacoes: any[] = []

  for (const turma of turmas) {
    const todasDisciplinas = turma.curso.disciplinas.filter(
      (cd: any) => cd.periodo === turma.periodo && cd.disciplina.ativo
    )
    if (!estado.turmaOcupada.has(turma.id)) estado.turmaOcupada.set(turma.id, new Set())

    // Sprint 8.1: online primeiro
    const { online, presenciais } = separarDisciplinas(todasDisciplinas)

    for (const cursoDisciplina of [...online, ...presenciais]) {
      const disciplina = cursoDisciplina.disciplina
      const necessidade = calcularBlocosSemanais(disciplina)
      resultado.resumo.total += necessidade

      if (!substituirExistentes) {
        const encontrosExistentes = await prisma.alocacao.count({
          where: { turmaId: turma.id, disciplinaId: disciplina.id, status: { not: 'CONFLITO' } },
        })
        if (encontrosExistentes >= necessidade) {
          resultado.resumo.alocadas += encontrosExistentes
          continue
        }
      }

      const professoresAutorizados = professorsFilter(professores, disciplina.id)
      if (professoresAutorizados.length === 0) {
        for (let i = 0; i < necessidade; i++) {
          resultado.pendencias.push({
            turmaId: turma.id,
            turmaNome: turma.nome,
            disciplinaId: disciplina.id,
            disciplinaNome: disciplina.nome,
            ...classificarPendencia({ professoresVinculados: 0, todosNoLimite: false, semDisponibilidade: false }),
            professoresVinculados: 0,
            professoresDisponiveis: 0,
          })
        }
        continue
      }

      const saida = alocarDisciplinaCompleta({
        turma: { id: turma.id, nome: turma.nome, turno: turma.turno },
        disciplina: { id: disciplina.id, nome: disciplina.nome, cargaHoraria: disciplina.cargaHoraria, blocosSemanais: disciplina.blocosSemanais, modalidade: disciplina.modalidade },
        professoresAutorizados,
        blocos: blocos as BlocoHorario[],
        semanasLetivas,
        estado,
      })

      resultado.alocadas.push(...saida.alocadas)
      resultado.pendencias.push(...saida.pendencias)
      novasAlocacoes.push(...saida.registros)
    }
  }

  if (novasAlocacoes.length > 0) await prisma.alocacao.createMany({ data: novasAlocacoes })

  resultado.resumo.alocadas += resultado.alocadas.length
  resultado.resumo.pendentes = resultado.pendencias.length
  resultado.resumo.taxaSucesso =
    resultado.resumo.total > 0
      ? Math.round((resultado.resumo.alocadas / resultado.resumo.total) * 100)
      : 0

  return resultado
}

// ─── Função pública: gerarGradeCurso ─────────────────────────────────────────

/**
 * Gera a grade completa de um curso para um período letivo.
 *
 * O resultado inclui, por turma, a lista de alocações geradas e as pendências
 * encontradas quando a grade não consegue cobrir totalmente a necessidade.
 */
export async function gerarGradeCurso({
  cursoId,
  periodoLetivoId,
  substituirExistentes = false,
}: {
  cursoId: string
  periodoLetivoId: string
  substituirExistentes?: boolean
}): Promise<ResultadoGradeCurso> {
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
  const blocosPorId = new Map(blocos.map((b) => [b.id, b as BlocoHorario]))

  if (substituirExistentes) {
    await prisma.alocacao.deleteMany({
      where: {
        turma: { cursoId, periodoLetivoId },
        origem: 'AUTOMATICA',
      },
    })
  }

  const estado = criarEstadoVazio()
  const existentes = await prisma.alocacao.findMany({
    where: { turma: { cursoId, periodoLetivoId }, status: { not: 'CONFLITO' } },
    select: {
      professorId: true,
      turmaId: true,
      blocoId: true,
      diaSemana: true,
      disciplinaId: true,
      origem: true,
      fixa: true,
    },
  })
  preCarregarEstado(existentes, blocosPorId, estado)

  const resultadosPorTurma: ResultadoTurma[] = []
  const todasAlocadasGlobal: AlocacaoCriada[] = []
  const novasAlocacoes: any[] = []

  for (const turma of turmas) {
    const todasDisciplinas = turma.curso.disciplinas.filter(
      (cd: any) => cd.periodo === turma.periodo && cd.disciplina.ativo
    )
    if (!estado.turmaOcupada.has(turma.id)) estado.turmaOcupada.set(turma.id, new Set())

    const alocadasTurma: AlocacaoCriada[] = []
    const pendenciasTurma: PendenciaDetalhada[] = []

    // Sprint 8.1: processar disciplinas online primeiro
    const { online, presenciais } = separarDisciplinas(todasDisciplinas)

    for (const cursoDisciplina of [...online, ...presenciais]) {
      const disciplina = cursoDisciplina.disciplina

      if (!substituirExistentes) {
        const necessidade = calcularBlocosSemanais(disciplina)
        const encontrosExistentes = await prisma.alocacao.count({
          where: { turmaId: turma.id, disciplinaId: disciplina.id, status: { not: 'CONFLITO' } },
        })
        if (encontrosExistentes >= necessidade) continue
      }

      const professoresAutorizados = professorsFilter(professores, disciplina.id)
      if (professoresAutorizados.length === 0) {
        const necessidade = calcularBlocosSemanais(disciplina)
        for (let i = 0; i < necessidade; i++) {
          pendenciasTurma.push({
            turmaId: turma.id,
            turmaNome: turma.nome,
            disciplinaId: disciplina.id,
            disciplinaNome: disciplina.nome,
            ...classificarPendencia({ professoresVinculados: 0, todosNoLimite: false, semDisponibilidade: false }),
            professoresVinculados: 0,
            professoresDisponiveis: 0,
          })
        }
        continue
      }

      const saida = alocarDisciplinaCompleta({
        turma: { id: turma.id, nome: turma.nome, turno: turma.turno },
        disciplina: {
          id: disciplina.id,
          nome: disciplina.nome,
          cargaHoraria: disciplina.cargaHoraria,
          blocosSemanais: disciplina.blocosSemanais,
          modalidade: disciplina.modalidade,
        },
        professoresAutorizados,
        blocos: blocos as BlocoHorario[],
        semanasLetivas,
        estado,
      })

      alocadasTurma.push(...saida.alocadas)
      pendenciasTurma.push(...saida.pendencias)
      novasAlocacoes.push(...saida.registros)
      todasAlocadasGlobal.push(...saida.alocadas)
    }

    resultadosPorTurma.push({
      turma: { id: turma.id, codigo: turma.codigo, nome: turma.nome, periodo: turma.periodo, turno: turma.turno },
      alocadas: alocadasTurma,
      pendencias: pendenciasTurma,
      conflitos: [],
    })
  }

  if (novasAlocacoes.length > 0) await prisma.alocacao.createMany({ data: novasAlocacoes })

  // Detectar e marcar conflitos cruzados
  const conflitosGlobais = detectarConflitosCruzados(todasAlocadasGlobal, blocosPorId)
  if (conflitosGlobais.length > 0) {
    for (const conflito of conflitosGlobais) {
      const blocoConflito = novasAlocacoes.find(
        (a) => a.diaSemana === conflito.diaSemana && a.professorId === conflito.professorId
      )?.blocoId
      if (blocoConflito) {
        await prisma.alocacao.updateMany({
          where: {
            professorId: conflito.professorId,
            diaSemana: conflito.diaSemana,
            blocoId: blocoConflito,
            status: 'CONFIRMADA',
          },
          data: { status: 'CONFLITO' },
        })
      }
    }
    for (const rt of resultadosPorTurma) {
      rt.conflitos = conflitosGlobais.filter(
        (c) => c.turma1 === rt.turma.nome || c.turma2 === rt.turma.nome
      )
    }
  }

  const totalAlocadas = resultadosPorTurma.reduce((acc, r) => acc + r.alocadas.length, 0)
  const totalPendencias = resultadosPorTurma.reduce((acc, r) => acc + r.pendencias.length, 0)
  const totalDisciplinas = totalAlocadas + totalPendencias

  return {
    curso: { id: curso.id, nome: curso.nome },
    periodoLetivo: { id: periodoLetivo.id, descricao: periodoLetivo.descricao },
    turmas: resultadosPorTurma,
    conflitosGlobais,
    resumo: {
      totalDisciplinas,
      totalAlocadas,
      totalPendencias,
      totalConflitos: conflitosGlobais.length,
      taxaSucesso: totalDisciplinas > 0 ? Math.round((totalAlocadas / totalDisciplinas) * 100) : 0,
    },
  }
}

// ─── Função pública: simularAlocacao ─────────────────────────────────────────

/**
 * Valida se uma alocação manual pode ser criada ou ajustada.
 *
 * A simulação verifica autorização do professor, disponibilidade, compatibilidade
 * de turno, carga horária e conflitos com outros horários já confirmados.
 */
export async function simularAlocacao({
  alocacaoId,
  turmaId,
  disciplinaId,
  professorId,
  blocoId,
  diaSemana,
}: {
  alocacaoId?: string
  turmaId: string
  disciplinaId: string
  professorId: string
  blocoId: string
  diaSemana: DiaSemana
}): Promise<{ valido: boolean; erros: string[] }> {
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

  if (!professor.disciplinas.some((pd: any) => pd.disciplinaId === disciplinaId))
    erros.push(`${professor.usuario.nome} nao esta autorizado para esta disciplina`)

  const temDisponibilidadePorBloco = professor.disponibilidadesBloco.length > 0
  const disponivel = temDisponibilidadePorBloco
    ? professor.disponibilidadesBloco.some((db: any) => db.diaSemana === diaSemana && db.blocoId === blocoId)
    : professor.disponibilidades.some((d: any) => d.diaSemana === diaSemana && d.turno === bloco.turno)
  if (!disponivel) erros.push(`${professor.usuario.nome} nao esta disponivel neste dia e horario`)

  if (!turnoCompativel(turma.turno as Turno, bloco.turno as Turno))
    erros.push('O bloco selecionado nao pertence ao turno da turma')

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

  if (conflitoProfessor) erros.push(`${professor.usuario.nome} ja esta alocado neste horario`)
  if (conflitoTurma) erros.push('Esta turma ja possui aula neste horario')
  if (professor.alocacoes.length >= professor.cargaHorariaMax)
    erros.push(`${professor.usuario.nome} atingiu a carga horaria maxima`)

  return { valido: erros.length === 0, erros }
}
