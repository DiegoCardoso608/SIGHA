import bcrypt from 'bcryptjs'
import type { ModalidadeDisciplina, Titulacao, TipoProfessor, Turno } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { ImportRepository, TipoEntidadeImportacao } from './types'

const TITULACOES = new Set([
  'GRADUADO',
  'ESPECIALISTA',
  'MESTRE',
  'DOUTOR',
  'DOUTORA',
  'POS_DOUTOR',
])

const TIPOS_PROFESSOR = new Set(['TITULAR', 'SUBSTITUTO', 'RESERVA'])

export class PrismaImportRepository implements ImportRepository {
  async upsertProfessorPorEmail(input: Record<string, unknown>) {
    const email = String(input.email ?? '').trim()
    const nome = String(input.nome ?? '').trim()
    const matricula = input.matricula ? String(input.matricula).trim() || null : null
    const titulacao = normalizeTitulacao(String(input.titulacao ?? 'GRADUADO'))
    const cargaHorariaMax = Number(input.cargaHorariaMax ?? 0)
    const tipo = normalizeTipoProfessor(String(input.tipo ?? 'TITULAR'))

    if (!email || !nome) {
      throw new Error('E-mail e nome do professor são obrigatórios para importação.')
    }

    const senhaHash = await bcrypt.hash(`sigha-${email}`, 12)

    const resultado = await prisma.$transaction(async (tx) => {
      const usuarioExistente = await tx.usuario.findUnique({ where: { email } })

      const usuario = usuarioExistente
        ? await tx.usuario.update({
            where: { email },
            data: {
              nome,
              matricula,
            },
          })
        : await tx.usuario.create({
            data: {
              nome,
              email,
              matricula,
              senhaHash,
              perfil: 'PROFESSOR',
              ativo: true,
            },
          })

      const professorExistente = await tx.professor.findUnique({
        where: { usuarioId: usuario.id },
      })

      const professor = professorExistente
        ? await tx.professor.update({
            where: { usuarioId: usuario.id },
            data: {
              titulacao,
              cargaHorariaMax,
              tipo,
            },
          })
        : await tx.professor.create({
            data: {
              usuarioId: usuario.id,
              titulacao,
              cargaHorariaMax,
              tipo,
              ativo: true,
            },
          })

      if (Array.isArray(input.disciplinaIds) && input.disciplinaIds.length > 0) {
        const disciplinaIds = input.disciplinaIds
          .map((id) => String(id).trim())
          .filter(Boolean)

        await tx.professorDisciplina.createMany({
          data: disciplinaIds.map((disciplinaId) => ({
            professorId: professor.id,
            disciplinaId,
          })),
          skipDuplicates: true,
        })
      }

      return { id: professor.id, criado: !professorExistente }
    })

    return resultado
  }

  async upsertProfessorPorNome(input: Record<string, unknown>) {
    const nome = String(input.nome ?? '').trim()
    if (!nome) {
      throw new Error('Nome do professor é obrigatório para importação.')
    }

    const professorExistente = await prisma.professor.findFirst({
      where: {
        usuario: { nome },
      },
      select: { id: true },
    })

    if (professorExistente) {
      return { id: professorExistente.id, criado: false }
    }

    const email = `${slugify(nome)}@importacao.local`
    return this.upsertProfessorPorEmail({
      ...input,
      nome,
      email,
    })
  }

  async upsertDisciplinaPorCodigo(input: Record<string, unknown>) {
    const codigo = String(input.codigo ?? '').trim()
    const nome = String(input.nome ?? '').trim()
    const cargaHoraria = Number(input.cargaHoraria ?? 0)
    const blocosSemanais =
      input.blocosSemanais === null || input.blocosSemanais === undefined || input.blocosSemanais === ''
        ? Math.max(1, Math.ceil(cargaHoraria / 20))
        : Number(input.blocosSemanais)
    const modalidade = normalizeModalidade(String(input.modalidade ?? 'PRESENCIAL'))

    if (!codigo || !nome || !Number.isFinite(cargaHoraria) || cargaHoraria <= 0) {
      throw new Error('Código, nome e carga horária são obrigatórios para importação de disciplinas.')
    }

    const existente = await prisma.disciplina.findUnique({ where: { codigo } })

    if (existente) {
      const atualizada = await prisma.disciplina.update({
        where: { codigo },
        data: {
          nome,
          cargaHoraria,
          blocosSemanais,
          modalidade,
        },
      })

      return { id: atualizada.id, criado: false }
    }

    const criada = await prisma.disciplina.create({
      data: {
        codigo,
        nome,
        cargaHoraria,
        blocosSemanais,
        modalidade,
      },
    })

    return { id: criada.id, criado: true }
  }

  async upsertTurmaPorCodigo(input: Record<string, unknown>) {
    const codigo = String(input.codigo ?? '').trim()
    const nome = String(input.nome ?? '').trim()
    const periodo = Number(input.periodo ?? 0)
    const turno = normalizeTurno(String(input.turno ?? 'MANHA'))

    const periodoLetivoSelecionado =
      input.periodoLetivoId && String(input.periodoLetivoId).trim()
        ? await prisma.periodoLetivo.findUnique({
            where: { id: String(input.periodoLetivoId).trim() },
            select: { id: true },
          })
        : null

    const periodoLetivoId =
      periodoLetivoSelecionado?.id ??
      (await this.buscarPeriodoLetivoAtivo())?.id ??
      null

    if (!periodoLetivoId) {
      throw new Error('Não foi possível determinar um período letivo ativo para importação de turmas.')
    }

    if (!codigo || !nome || !Number.isFinite(periodo) || periodo <= 0) {
      throw new Error('Código, nome e período são obrigatórios para importação de turmas.')
    }

    const cursoId = input.cursoId && String(input.cursoId).trim() ? String(input.cursoId) : null
    if (!cursoId) {
      const curso = await this.buscarCursoPorNomeOuCodigo(String(input.cursoId ?? ''))
      if (!curso) {
        throw new Error('Curso não encontrado para a turma informada.')
      }
      input.cursoId = curso.id
    }

    const existente = await prisma.turma.findUnique({
      where: {
        codigo_periodoLetivoId: {
          codigo,
          periodoLetivoId,
        },
      },
      select: { id: true },
    })

    if (existente) {
      const atualizada = await prisma.turma.update({
        where: { id: existente.id },
        data: {
          nome,
          cursoId: String(input.cursoId),
          periodoLetivoId,
          periodo,
          turno,
        },
      })
      return { id: atualizada.id, criado: false }
    }

    const criada = await prisma.turma.create({
      data: {
        codigo,
        nome,
        cursoId: String(input.cursoId),
        periodoLetivoId,
        periodo,
        turno,
      },
    })

    return { id: criada.id, criado: true }
  }

  async buscarCursoPorNomeOuCodigo(nomeOuCodigo: string) {
    const valor = nomeOuCodigo.trim()
    if (!valor) return null
    const curso = await prisma.curso.findFirst({
      where: {
        OR: [{ codigo: valor }, { nome: { equals: valor, mode: 'insensitive' } }],
      },
      select: { id: true },
    })
    return curso ? { id: curso.id } : null
  }

  async buscarProfessorPorNomeOuEmail(nomeOuEmail: string) {
    const valor = nomeOuEmail.trim()
    if (!valor) return null
    const professor = await prisma.professor.findFirst({
      where: {
        OR: [
          { usuario: { email: { equals: valor, mode: 'insensitive' } } },
          { usuario: { nome: { equals: valor, mode: 'insensitive' } } },
        ],
      },
      select: { id: true },
    })
    return professor ? { id: professor.id } : null
  }

  async buscarPeriodoLetivoAtivo() {
    const periodo = await prisma.periodoLetivo.findFirst({
      where: { status: 'ATIVO' },
      select: { id: true },
      orderBy: { dataInicio: 'asc' },
    })
    return periodo ? { id: periodo.id } : null
  }

  async registrarImportacao(registro: {
    tipo: TipoEntidadeImportacao
    arquivo: string
    totalLinhas: number
    importadas: number
    ignoradas: number
    detalhesErros: string
  }) {
    await prisma.importacao.create({
      data: {
        tipo: registro.tipo,
        arquivo: registro.arquivo,
        totalLinhas: registro.totalLinhas,
        importadas: registro.importadas,
        ignoradas: registro.ignoradas,
        detalhesErros: registro.detalhesErros,
      },
    })
  }
}

function normalizeTitulacao(valor: string): Titulacao {
  const normalizado = valor.toUpperCase()
  return (TITULACOES.has(normalizado) ? normalizado : 'GRADUADO') as Titulacao
}

function normalizeTipoProfessor(valor: string): TipoProfessor {
  const normalizado = valor.toUpperCase()
  return (TIPOS_PROFESSOR.has(normalizado) ? normalizado : 'TITULAR') as TipoProfessor
}

function normalizeModalidade(valor: string): ModalidadeDisciplina {
  const normalizado = valor.toUpperCase()
  return (normalizado === 'ONLINE' ? 'ONLINE' : 'PRESENCIAL') as ModalidadeDisciplina
}

function normalizeTurno(valor: string): Turno {
  const normalizado = valor.toUpperCase()
  return (normalizado === 'TARDE' || normalizado === 'NOITE' ? normalizado : 'MANHA') as Turno
}

function slugify(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
