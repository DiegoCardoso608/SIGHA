export type LinhaBruta = Record<string, unknown>
export type LinhaMapeada = Record<string, unknown>

export type TipoEntidadeImportacao = 'PROFESSOR' | 'DISCIPLINA' | 'TURMA'

export type DicionarioAliases = Record<string, string[]>

export interface MapeamentoColunas {
  colunaParaCampo: Record<string, string>
  colunasIgnoradas: string[]
  camposNaoEncontrados: string[]
}

export interface ErroValidacaoCampo {
  campo: string
  mensagem: string
}

export type ResultadoValidacaoLinha<T = Record<string, unknown>> =
  | { sucesso: true; dados: T; avisos: ErroValidacaoCampo[] }
  | { sucesso: false; erros: ErroValidacaoCampo[] }

export type StatusLinhaImportacao = 'IMPORTADA' | 'IGNORADA' | 'ATUALIZADA'

export interface ResultadoLinha {
  linha: number
  status: StatusLinhaImportacao
  entidadeId?: string
  erros?: ErroValidacaoCampo[]
  avisos?: ErroValidacaoCampo[]
}

export interface RelatorioImportacao {
  tipo: TipoEntidadeImportacao
  arquivo: string
  totalLinhas: number
  totalImportadas: number
  totalAtualizadas: number
  totalIgnoradas: number
  mapeamento: MapeamentoColunas
  resultados: ResultadoLinha[]
  iniciadoEm: Date
  finalizadoEm: Date
  duracaoMs: number
  historicoRegistrado?: boolean
  avisoHistorico?: string
}

export interface ImportStrategy<T = Record<string, unknown>> {
  readonly tipo: TipoEntidadeImportacao
  readonly aliases: DicionarioAliases
  readonly camposObrigatorios: string[]
  validar(linhaMapeada: LinhaMapeada, numeroLinha: number): ResultadoValidacaoLinha<T>
  salvar(
    dados: T,
    contexto: ContextoImportacao
  ): Promise<{ id: string; status: 'IMPORTADA' | 'ATUALIZADA' }>
}

export interface ContextoImportacao {
  repo: ImportRepository
  cache: Map<string, unknown>
}

export interface ImportRepository {
  upsertProfessorPorEmail(input: Record<string, unknown>): Promise<{ id: string; criado: boolean }>
  upsertProfessorPorNome(input: Record<string, unknown>): Promise<{ id: string; criado: boolean }>
  upsertDisciplinaPorCodigo(input: Record<string, unknown>): Promise<{ id: string; criado: boolean }>
  upsertTurmaPorCodigo(input: Record<string, unknown>): Promise<{ id: string; criado: boolean }>
  buscarCursoPorNomeOuCodigo(nomeOuCodigo: string): Promise<{ id: string } | null>
  buscarProfessorPorNomeOuEmail(nomeOuEmail: string): Promise<{ id: string } | null>
  buscarPeriodoLetivoAtivo(): Promise<{ id: string } | null>
  registrarImportacao(registro: {
    tipo: TipoEntidadeImportacao
    arquivo: string
    totalLinhas: number
    importadas: number
    ignoradas: number
    detalhesErros: string
  }): Promise<void>
}

export interface OpcoesImportacao {
  tipo: TipoEntidadeImportacao
  nomeArquivo: string
  apenasSimular?: boolean
}
