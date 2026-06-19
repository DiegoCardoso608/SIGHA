import { validarProfessorLinha } from '../validators/professor'
import type {
  ContextoImportacao,
  DicionarioAliases,
  ImportStrategy,
  LinhaMapeada,
  ResultadoValidacaoLinha,
} from '../types'

export class ProfessorImportStrategy implements ImportStrategy<{
  nome: string
  email: string
  matricula?: string | null
  titulacao: string
  cargaHorariaMax: number
  tipo: string
  disciplinaIds?: string[]
}> {
  readonly tipo = 'PROFESSOR'
  readonly aliases: DicionarioAliases = {
    nome: ['nome', 'nome professor', 'professor', 'nome do professor'],
    email: ['email', 'e-mail', 'email professor'],
    matricula: ['matricula', 'matrícula', 'registro'],
    titulacao: ['titulacao', 'titulação', 'titulacao professor'],
    cargaHorariaMax: ['carga horaria max', 'carga horaria maxima', 'carga horaria', 'carga semanal'],
    tipo: ['tipo', 'tipo professor', 'categoria'],
    disciplinaIds: ['disciplinas', 'disciplinas autorizadas', 'disciplinas ids']
  }
  readonly camposObrigatorios = ['nome', 'email', 'titulacao', 'cargaHorariaMax']

  validar(
    linhaMapeada: LinhaMapeada,
    numeroLinha: number
  ): ResultadoValidacaoLinha<{
    nome: string
    email: string
    matricula?: string | null
    titulacao: string
    cargaHorariaMax: number
    tipo: string
    disciplinaIds?: string[]
  }> {
    return validarProfessorLinha(linhaMapeada, numeroLinha)
  }

  async salvar(
    dados: {
      nome: string
      email: string
      matricula?: string | null
      titulacao: string
      cargaHorariaMax: number
      tipo: string
      disciplinaIds?: string[]
    },
    contexto: ContextoImportacao
  ): Promise<{ id: string; status: 'IMPORTADA' | 'ATUALIZADA' }> {
    const resultado = await contexto.repo.upsertProfessorPorEmail({
      ...dados,
      nome: dados.nome,
      email: dados.email,
      matricula: dados.matricula ?? null,
      titulacao: dados.titulacao,
      cargaHorariaMax: dados.cargaHorariaMax,
      tipo: dados.tipo,
    })

    return {
      id: resultado.id,
      status: resultado.criado ? 'IMPORTADA' : 'ATUALIZADA'
    }
  }
}

export const professorImportStrategy = new ProfessorImportStrategy()
