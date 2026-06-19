import { validarDisciplinaLinha } from '../validators/disciplina'
import type {
  ContextoImportacao,
  DicionarioAliases,
  ImportStrategy,
  LinhaMapeada,
  ResultadoValidacaoLinha,
} from '../types'

export class DisciplinaImportStrategy implements ImportStrategy<{
  codigo: string
  nome: string
  cargaHoraria: number
  blocosSemanais?: number | null
  modalidade: string
  cursoId?: string | null
  periodo?: number | null
}> {
  readonly tipo = 'DISCIPLINA'
  readonly aliases: DicionarioAliases = {
    codigo: ['codigo', 'cod', 'código'],
    nome: ['nome', 'nome disciplina', 'disciplina'],
    cargaHoraria: ['carga horaria', 'carga', 'ch'],
    blocosSemanais: ['blocos semanais', 'blocos'],
    modalidade: ['modalidade'],
    cursoId: ['curso', 'curso id', 'codigo curso'],
    periodo: ['periodo', 'período']
  }
  readonly camposObrigatorios = ['codigo', 'nome', 'cargaHoraria']

  validar(
    linhaMapeada: LinhaMapeada,
    numeroLinha: number
  ): ResultadoValidacaoLinha<{
    codigo: string
    nome: string
    cargaHoraria: number
    blocosSemanais?: number | null
    modalidade: string
    cursoId?: string | null
    periodo?: number | null
  }> {
    return validarDisciplinaLinha(linhaMapeada, numeroLinha)
  }

  async salvar(
    dados: {
      codigo: string
      nome: string
      cargaHoraria: number
      blocosSemanais?: number | null
      modalidade: string
      cursoId?: string | null
      periodo?: number | null
    },
    contexto: ContextoImportacao
  ): Promise<{ id: string; status: 'IMPORTADA' | 'ATUALIZADA' }> {
    const resultado = await contexto.repo.upsertDisciplinaPorCodigo({
      ...dados,
      codigo: dados.codigo,
      nome: dados.nome,
      cargaHoraria: dados.cargaHoraria,
      blocosSemanais: dados.blocosSemanais ?? null,
      modalidade: dados.modalidade,
    })

    return {
      id: resultado.id,
      status: resultado.criado ? 'IMPORTADA' : 'ATUALIZADA'
    }
  }
}

export const disciplinaImportStrategy = new DisciplinaImportStrategy()
