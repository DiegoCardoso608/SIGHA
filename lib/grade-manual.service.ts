import { prisma } from '@/lib/prisma'
import { simularAlocacao } from '@/lib/algoritmo'
import type { DiaSemana, StatusAlocacao } from '@prisma/client'

export interface CriarAlocacaoManualInput {
  turmaId: string
  disciplinaId: string
  professorId?: string | null
  blocoId: string
  diaSemana: DiaSemana
  online?: boolean
  fixa?: boolean
}

export interface EditarAlocacaoInput {
  disciplinaId?: string
  professorId?: string | null
  blocoId?: string
  diaSemana?: DiaSemana
  online?: boolean
  status?: StatusAlocacao
}

export async function criarAlocacaoManual(input: CriarAlocacaoManualInput) {
  const { turmaId, disciplinaId, professorId, blocoId, diaSemana, online = false, fixa = false } = input

  const [turma, disciplina, bloco] = await Promise.all([
    prisma.turma.findUnique({ where: { id: turmaId } }),
    prisma.disciplina.findUnique({ where: { id: disciplinaId } }),
    prisma.blocoHorario.findUnique({ where: { id: blocoId } }),
  ])

  if (!turma) return { sucesso: false, erros: ['Turma não encontrada.'] }
  if (!disciplina) return { sucesso: false, erros: ['Disciplina não encontrada.'] }
  if (!bloco) return { sucesso: false, erros: ['Bloco não encontrado.'] }
  if (!turma.ativo) return { sucesso: false, erros: ['Turma está inativa.'] }
  if (!disciplina.ativo) return { sucesso: false, erros: ['Disciplina está inativa.'] }
  if (turma.turno !== bloco.turno) return { sucesso: false, erros: ['O bloco selecionado não pertence ao turno da turma.'] }

  const vinculo = await prisma.cursoDisciplina.findUnique({
    where: { cursoId_disciplinaId: { cursoId: turma.cursoId, disciplinaId } },
  })
  if (!vinculo) return { sucesso: false, erros: ['Disciplina não pertence ao curso desta turma.'] }
  if (vinculo.periodo !== turma.periodo) {
    return {
      sucesso: false,
      erros: [`Disciplina pertence ao período ${vinculo.periodo}, mas a turma é do período ${turma.periodo}.`],
    }
  }

  const conflitoTurma = await prisma.alocacao.findFirst({
    where: {
      turmaId,
      blocoId,
      diaSemana,
      status: { not: 'CONFLITO' },
    },
  })
  if (conflitoTurma) return { sucesso: false, erros: ['Esta turma já possui aula neste dia e horário.'] }

  if (professorId) {
    const simulacao = await simularAlocacao({
      turmaId,
      disciplinaId,
      professorId,
      blocoId,
      diaSemana,
    })
    if (!simulacao.valido) return { sucesso: false, erros: simulacao.erros }
  }

  const alocacao = await prisma.alocacao.create({
    data: {
      turmaId,
      disciplinaId,
      professorId: professorId ?? null,
      blocoId,
      diaSemana,
      online,
      origem: 'MANUAL',
      fixa,
      status: professorId ? 'CONFIRMADA' : 'PENDENTE',
    },
    include: {
      turma: true,
      disciplina: true,
      professor: { include: { usuario: { select: { nome: true, email: true } } } },
      bloco: true,
    },
  })

  return { sucesso: true, alocacao }
}

export async function editarAlocacao(id: string, input: EditarAlocacaoInput) {
  const atual = await prisma.alocacao.findUnique({
    where: { id },
    include: { turma: true, disciplina: true, bloco: true },
  })
  if (!atual) return { sucesso: false, erros: ['Alocação não encontrada.'] }
  if (atual.fixa) {
    return { sucesso: false, erros: ['Esta alocação está marcada como fixa e não pode ser alterada.'] }
  }

  const novaDisciplinaId = input.disciplinaId ?? atual.disciplinaId
  const novoProfessorId = input.professorId !== undefined ? input.professorId : atual.professorId
  const novoBlocoId = input.blocoId ?? atual.blocoId
  const novoDiaSemana = input.diaSemana ?? atual.diaSemana
  const novoBloco = input.blocoId
    ? await prisma.blocoHorario.findUnique({ where: { id: novoBlocoId } })
    : atual.bloco

  if (!novoBloco) return { sucesso: false, erros: ['Bloco não encontrado.'] }
  if (atual.turma.turno !== novoBloco.turno) {
    return { sucesso: false, erros: ['O bloco selecionado não pertence ao turno da turma.'] }
  }

  const disciplinaNova = await prisma.disciplina.findUnique({ where: { id: novaDisciplinaId } })
  if (!disciplinaNova) return { sucesso: false, erros: ['Disciplina não encontrada.'] }

  const vinculo = await prisma.cursoDisciplina.findUnique({
    where: { cursoId_disciplinaId: { cursoId: atual.turma.cursoId, disciplinaId: novaDisciplinaId } },
  })
  if (!vinculo) return { sucesso: false, erros: ['Disciplina não pertence ao curso desta turma.'] }
  if (vinculo.periodo !== atual.turma.periodo) {
    return {
      sucesso: false,
      erros: [`Disciplina pertence ao período ${vinculo.periodo}, mas a turma é do período ${atual.turma.periodo}.`],
    }
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
  if (conflitoTurma) return { sucesso: false, erros: ['Esta turma já possui aula neste dia e horário.'] }

  if (novoProfessorId) {
    const simulacao = await simularAlocacao({
      alocacaoId: id,
      turmaId: atual.turmaId,
      disciplinaId: novaDisciplinaId,
      professorId: novoProfessorId,
      blocoId: novoBlocoId,
      diaSemana: novoDiaSemana,
    })
    if (!simulacao.valido) return { sucesso: false, erros: simulacao.erros }
  }

  const novoStatus = input.status ?? (novoProfessorId ? 'CONFIRMADA' : 'PENDENTE')

  const alocacao = await prisma.alocacao.update({
    where: { id },
    data: {
      disciplinaId: novaDisciplinaId,
      professorId: novoProfessorId,
      blocoId: novoBlocoId,
      diaSemana: novoDiaSemana,
      online: input.online ?? atual.online,
      status: novoStatus,
      origem: atual.origem === 'AUTOMATICA' ? 'AUTOMATICA' : 'MANUAL',
    },
    include: {
      turma: true,
      disciplina: true,
      professor: { include: { usuario: { select: { nome: true, email: true } } } },
      bloco: true,
    },
  })

  return { sucesso: true, alocacao }
}

export async function removerAlocacao(id: string) {
  const alocacao = await prisma.alocacao.findUnique({ where: { id } })
  if (!alocacao) return { sucesso: false, erros: ['Alocação não encontrada.'] }
  if (alocacao.fixa) {
    return { sucesso: false, erros: ['Aulas fixas não podem ser removidas sem desmarcar a fixação.'] }
  }

  await prisma.alocacao.delete({ where: { id } })
  return { sucesso: true }
}

export async function marcarAulaFixa(id: string) {
  const alocacao = await prisma.alocacao.findUnique({ where: { id } })
  if (!alocacao) return { sucesso: false, erros: ['Alocação não encontrada.'] }

  const atualizada = await prisma.alocacao.update({
    where: { id },
    data: { fixa: true, origem: 'MANUAL' },
  })

  return { sucesso: true, alocacao: atualizada }
}

export async function desmarcarAulaFixa(id: string) {
  const alocacao = await prisma.alocacao.findUnique({ where: { id } })
  if (!alocacao) return { sucesso: false, erros: ['Alocação não encontrada.'] }

  const atualizada = await prisma.alocacao.update({
    where: { id },
    data: { fixa: false },
  })

  return { sucesso: true, alocacao: atualizada }
}

export async function listarAlocacoesTurma(turmaId: string) {
  return prisma.alocacao.findMany({
    where: { turmaId },
    include: {
      turma: true,
      disciplina: true,
      professor: { include: { usuario: { select: { nome: true, email: true } } } },
      bloco: true,
    },
    orderBy: [{ diaSemana: 'asc' }, { bloco: { ordem: 'asc' } }],
  })
}

export async function limparTurma(turmaId: string, preservarFixas = false) {
  const where = preservarFixas
    ? { turmaId, fixa: false }
    : { turmaId }

  await prisma.alocacao.deleteMany({ where })
  return { sucesso: true }
}

export async function limparPeriodo(periodoLetivoId: string) {
  await prisma.alocacao.deleteMany({
    where: { turma: { periodoLetivoId } },
  })
  return { sucesso: true }
}
