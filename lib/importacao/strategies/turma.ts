import { validarTurmaLinha } from '../validators/turma'
import type {
  ContextoImportacao,
  DicionarioAliases,
  ImportStrategy,
  LinhaMapeada,
  ResultadoValidacaoLinha,
} from '../types'

export class TurmaImportStrategy implements ImportStrategy<{
  codigo: string
  nome: string
  cursoId?: string | null
  periodoLetivoId?: string | null
  periodo: number
  turno: string
}> {
  readonly tipo = 'TURMA'
  readonly aliases: DicionarioAliases = {
    codigo: ['codigo', 'cod', 'código', 'turma'],
    nome: ['nome', 'nome turma', 'descricao', 'descrição'],
    cursoId: ['curso', 'curso id', 'codigo curso', 'curso codigo'],
    periodoLetivoId: ['periodo letivo', 'periodo letivo id', 'semestre'],
    periodo: ['periodo', 'período'],
    turno: ['turno']
  }
  readonly camposObrigatorios = ['codigo', 'nome', 'periodo', 'turno']

  validar(
    linhaMapeada: LinhaMapeada,
    numeroLinha: number
  ): ResultadoValidacaoLinha<{
    codigo: string
    nome: string
    cursoId?: string | null
    periodoLetivoId?: string | null
    periodo: number
    turno: string
  }> {
    return validarTurmaLinha(linhaMapeada, numeroLinha)
  }

  async salvar(
    dados: {
      codigo: string
      nome: string
      cursoId?: string | null
      periodoLetivoId?: string | null
      periodo: number
      turno: string
    },
    contexto: ContextoImportacao
  ): Promise<{ id: string; status: 'IMPORTADA' | 'ATUALIZADA' }> {
    const resultado = await contexto.repo.upsertTurmaPorCodigo({
      ...dados,
      codigo: dados.codigo,
      nome: dados.nome,
      cursoId: dados.cursoId ?? null,
      periodoLetivoId: dados.periodoLetivoId ?? null,
      periodo: dados.periodo,
      turno: dados.turno,
    })

    return {
      id: resultado.id,
      status: resultado.criado ? 'IMPORTADA' : 'ATUALIZADA'
    }
  }
}

export const turmaImportStrategy = new TurmaImportStrategy()
