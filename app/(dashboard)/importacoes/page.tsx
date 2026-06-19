'use client'

import { useEffect, useMemo, useState } from 'react'

const TIPOS_IMPORTACAO = [
  { value: 'PROFESSOR', label: 'Professores' },
  { value: 'DISCIPLINA', label: 'Disciplinas' },
  { value: 'TURMA', label: 'Turmas' },
] as const

type TipoImportacao = (typeof TIPOS_IMPORTACAO)[number]['value']

type ErroLinha = {
  campo?: string
  mensagem: string
}

type ResultadoLinha = {
  linha: number
  status: string
  erros?: ErroLinha[]
  avisos?: string[]
  entidadeId?: string
}

type RelatorioImportacao = {
  tipo: string
  arquivo: string
  totalLinhas: number
  totalImportadas: number
  totalAtualizadas: number
  totalIgnoradas: number
  mapeamento: Record<string, string>
  resultados: ResultadoLinha[]
  avisoHistorico?: string
}

type HistoricoImportacao = {
  id: string
  tipo: string
  arquivo: string
  totalLinhas: number
  importadas: number
  ignoradas: number
  detalhesErros: string
  criadoEm: string
}

const EXEMPLOS_IMPORTACAO: Record<
  TipoImportacao,
  {
    titulo: string
    descricao: string
    colunas: Array<{ campo: string; obrigatorio: boolean; descricao: string }>
    linhas: string[][]
  }
> = {
  PROFESSOR: {
    titulo: 'Modelo para professores',
    descricao: 'Campos obrigatórios: nome, email, titulacao e cargaHorariaMax.',
    colunas: [
      { campo: 'nome', obrigatorio: true, descricao: 'Nome completo' },
      { campo: 'email', obrigatorio: true, descricao: 'E-mail institucional' },
      { campo: 'matricula', obrigatorio: false, descricao: 'Matrícula (opcional)' },
      { campo: 'titulacao', obrigatorio: true, descricao: 'Graduação, Especialista, Mestre...' },
      { campo: 'cargaHorariaMax', obrigatorio: true, descricao: 'Carga horária máxima' },
      { campo: 'tipo', obrigatorio: false, descricao: 'TITULAR, SUBSTITUTO ou RESERVA' },
      { campo: 'disciplinas', obrigatorio: false, descricao: 'IDs ou nomes das disciplinas autorizadas' },
    ],
    linhas: [
      ['João Silva', 'joao@instituicao.edu.br', '20240101', 'MESTRE', '20', 'TITULAR', 'MATEMATICA, FISICA'],
    ],
  },
  DISCIPLINA: {
    titulo: 'Modelo para disciplinas',
    descricao: 'Campos obrigatórios: codigo, nome e cargaHoraria.',
    colunas: [
      { campo: 'codigo', obrigatorio: true, descricao: 'Código da disciplina' },
      { campo: 'nome', obrigatorio: true, descricao: 'Nome da disciplina' },
      { campo: 'cargaHoraria', obrigatorio: true, descricao: 'Carga horária em horas' },
      { campo: 'blocosSemanais', obrigatorio: false, descricao: 'Blocos semanais' },
      { campo: 'modalidade', obrigatorio: false, descricao: 'PRESENCIAL ou ONLINE' },
      { campo: 'cursoId', obrigatorio: false, descricao: 'Identificador do curso' },
      { campo: 'periodo', obrigatorio: false, descricao: 'Período da disciplina' },
    ],
    linhas: [
      ['MAT101', 'Matemática I', '60', '4', 'PRESENCIAL', 'curso_1', '1'],
    ],
  },
  TURMA: {
    titulo: 'Modelo para turmas',
    descricao: 'Campos obrigatórios: codigo, nome, periodo e turno.',
    colunas: [
      { campo: 'codigo', obrigatorio: true, descricao: 'Código da turma' },
      { campo: 'nome', obrigatorio: true, descricao: 'Nome da turma' },
      { campo: 'cursoId', obrigatorio: false, descricao: 'Identificador do curso' },
      { campo: 'periodoLetivoId', obrigatorio: false, descricao: 'Identificador do período letivo' },
      { campo: 'periodo', obrigatorio: true, descricao: 'Período da turma' },
      { campo: 'turno', obrigatorio: true, descricao: 'MANHA, TARDE ou NOITE' },
    ],
    linhas: [
      ['TURMA-2026-1A', 'Turma 1A', 'curso_1', 'periodo_2026_1', '1', 'MANHA'],
    ],
  },
}

function formatarTipo(tipo: string) {
  return TIPOS_IMPORTACAO.find((item) => item.value === tipo)?.label ?? tipo
}

function formatarData(data: string) {
  return new Date(data).toLocaleString('pt-BR')
}

export default function ImportacoesPage() {
  const [tipo, setTipo] = useState<TipoImportacao>('PROFESSOR')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null)
  const [historico, setHistorico] = useState<HistoricoImportacao[]>([])
  const [historicoError, setHistoricoError] = useState('')
  const [mostrarExemplo, setMostrarExemplo] = useState(false)
  const [resetando, setResetando] = useState(false)
  const [resetMessage, setResetMessage] = useState('')

  const extensaoPermitida = useMemo(() => {
    return arquivo?.name.toLowerCase().endsWith('.xlsx') || arquivo?.name.toLowerCase().endsWith('.xls')
  }, [arquivo])

  const exemploAtual = EXEMPLOS_IMPORTACAO[tipo]

  async function lerRespostaServidor(response: Response) {
    const texto = await response.text()

    if (!texto) {
      return { data: null as Record<string, unknown> | null, mensagem: 'Resposta vazia do servidor.' }
    }

    try {
      return { data: JSON.parse(texto), mensagem: '' }
    } catch {
      return { data: null, mensagem: texto }
    }
  }

  async function carregarHistorico() {
    setHistoricoError('')

    try {
      const response = await fetch('/api/importacoes?limit=5', { cache: 'no-store' })
      const { data, mensagem } = await lerRespostaServidor(response)

      if (!response.ok) {
        throw new Error(
          (data && typeof data.error === 'string' && data.error) ||
            (data && typeof data.message === 'string' && data.message) ||
            mensagem ||
            'Não foi possível carregar o histórico.'
        )
      }

      if (!data || !Array.isArray((data as any).data)) {
        throw new Error('Resposta inválida ao carregar histórico.')
      }

      setHistorico((data as any).data)
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Não foi possível carregar o histórico.'
      setHistoricoError(mensagem)
    }
  }

  useEffect(() => {
    carregarHistorico()
  }, [])

  function confirmarReset(alvo: 'PROFESSOR' | 'DISCIPLINA' | 'TURMA' | 'TODOS') {
    const rotulos = {
      PROFESSOR: 'professores',
      DISCIPLINA: 'disciplinas',
      TURMA: 'turmas',
      TODOS: 'todos os dados de importação',
    }

    const confirmado = window.confirm(
      `Tem certeza que deseja apagar ${rotulos[alvo]}? Esta ação é irreversível.`
    )

    if (confirmado) {
      resetarDados(alvo)
    }
  }

  async function resetarDados(alvo: 'PROFESSOR' | 'DISCIPLINA' | 'TURMA' | 'TODOS') {
    setResetando(true)
    setResetMessage('')

    try {
      const response = await fetch('/api/importacoes/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alvo }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Não foi possível resetar os dados.')
      }

      setResetMessage(data.message ?? 'Dados resetados com sucesso.')
      await carregarHistorico()
    } catch (err) {
      setResetMessage(err instanceof Error ? err.message : 'Erro ao resetar dados.')
    } finally {
      setResetando(false)
    }
  }

  async function enviarImportacao(confirmar: boolean) {
    if (!arquivo) {
      setError('Selecione um arquivo Excel para continuar.')
      return
    }

    if (!extensaoPermitida) {
      setError('Apenas arquivos .xlsx ou .xls são aceitos.')
      return
    }

    setLoading(true)
    setError('')
    setRelatorio(null)

    try {
      const formData = new FormData()
      formData.append('arquivo', arquivo)
      formData.append('confirmar', String(confirmar))

      const response = await fetch(`/api/importacoes/${tipo}`, {
        method: 'POST',
        body: formData,
      })

      const { data, mensagem } = await lerRespostaServidor(response)

      if (!response.ok) {
        throw new Error(
          (data && typeof data.error === 'string' && data.error) ||
            (data && typeof data.message === 'string' && data.message) ||
            mensagem ||
            'Falha ao processar importação.'
        )
      }

      if (!data || typeof data !== 'object') {
        throw new Error('Resposta inválida do servidor ao importar o arquivo.')
      }

      setRelatorio(data as RelatorioImportacao)
      await carregarHistorico()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600 mb-1">Coordenação › Importações</p>
        <h1 className="text-2xl font-semibold text-gray-900">Importar planilhas Excel</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[220px_1fr_auto_auto] md:items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoImportacao)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
            >
              {TIPOS_IMPORTACAO.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo Excel</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-green-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-100"
            />
          </div>

          <button
            type="button"
            onClick={() => setMostrarExemplo((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {mostrarExemplo ? 'Ocultar exemplo' : 'Como preencher?'}
          </button>

          <button
            onClick={() => enviarImportacao(false)}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Simular'}
          </button>

          <button
            onClick={() => enviarImportacao(true)}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Importar'}
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          O sistema tenta detectar automaticamente os cabeçalhos da planilha e aplicar regras de validação por linha.
        </p>

        {mostrarExemplo && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-blue-900">{exemploAtual.titulo}</h3>
                <p className="mt-1 text-xs text-blue-800">{exemploAtual.descricao}</p>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    {exemploAtual.colunas.map((coluna) => (
                      <th key={coluna.campo} className="border border-blue-200 bg-white px-2 py-1 text-left font-medium text-gray-700">
                        {coluna.campo}
                        {coluna.obrigatorio && <span className="ml-1 text-red-500">*</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {exemploAtual.linhas[0].map((valor, index) => (
                      <td key={`${exemploAtual.titulo}-${index}`} className="border border-blue-200 bg-white px-2 py-1 text-gray-700">
                        {valor}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {exemploAtual.colunas.map((coluna) => (
                <span
                  key={coluna.campo}
                  className={`rounded-full px-2 py-1 text-[11px] ${
                    coluna.obrigatorio
                      ? 'bg-red-50 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {coluna.campo} {coluna.obrigatorio ? '(obrigatório)' : '(opcional)'}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-yellow-900">Reset rápido (teste):</span>
            <button
              type="button"
              onClick={() => confirmarReset('PROFESSOR')}
              disabled={resetando}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-yellow-900 border border-yellow-300 hover:bg-yellow-100"
            >
              Zerar professores
            </button>
            <button
              type="button"
              onClick={() => confirmarReset('DISCIPLINA')}
              disabled={resetando}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-yellow-900 border border-yellow-300 hover:bg-yellow-100"
            >
              Zerar disciplinas
            </button>
            <button
              type="button"
              onClick={() => confirmarReset('TURMA')}
              disabled={resetando}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-yellow-900 border border-yellow-300 hover:bg-yellow-100"
            >
              Zerar turmas
            </button>
            <button
              type="button"
              onClick={() => confirmarReset('TODOS')}
              disabled={resetando}
              className="rounded-md bg-yellow-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-800"
            >
              Zerar tudo
            </button>
          </div>

          {resetMessage && (
            <p className="mt-2 text-xs text-yellow-900">{resetMessage}</p>
          )}
        </div>
      </div>

      {relatorio && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Arquivo</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{relatorio.arquivo}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Linhas lidas</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{relatorio.totalLinhas}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Importadas</p>
              <p className="mt-1 text-sm font-semibold text-green-700">{relatorio.totalImportadas}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Ignoradas</p>
              <p className="mt-1 text-sm font-semibold text-red-700">{relatorio.totalIgnoradas}</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Mapeamento detectado</h2>
            <div className="mt-2 space-y-2">
              {Object.entries(relatorio.mapeamento).map(([chave, valor]) => {
                if (Array.isArray(valor)) {
                  return (
                    <div key={chave} className="text-xs text-gray-700">
                      <span className="font-medium">{chave}:</span>{' '}
                      {valor.join(', ')}
                    </div>
                  )
                }

                if (valor && typeof valor === 'object') {
                  return (
                    <div key={chave} className="text-xs text-gray-700">
                      <span className="font-medium">{chave}:</span>{' '}
                      {Object.entries(valor)
                        .map(([innerKey, innerValue]) => `${innerKey}=${String(innerValue)}`)
                        .join(', ')}
                    </div>
                  )
                }

                return (
                  <div key={chave} className="text-xs text-gray-700">
                    <span className="font-medium">{chave}:</span>{' '}
                    {String(valor)}
                  </div>
                )
              })}
            </div>
          </div>

          {relatorio.avisoHistorico && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              {relatorio.avisoHistorico}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Linha</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.resultados.map((item) => (
                    <tr key={`${item.linha}-${item.status}`} className="border-t border-gray-200">
                      <td className="px-3 py-2">{item.linha}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            item.status === 'IMPORTADA' || item.status === 'ATUALIZADA'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {item.erros?.length ? (
                          <ul className="list-disc pl-4">
                            {item.erros.map((erro, index) => (
                              <li key={`${item.linha}-${index}`}>{erro.mensagem}</li>
                            ))}
                          </ul>
                        ) : item.avisos?.length ? (
                          <span>{item.avisos.map((aviso) => String(aviso)).join(' • ')}</span>
                        ) : (
                          <span>Sem observações</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Últimas importações</h2>
        </div>

        {historicoError && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {historicoError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Arquivo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Tipo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Linhas</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Importadas</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Ignoradas</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Data</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((item) => (
                <tr key={item.id} className="border-t border-gray-200">
                  <td className="px-3 py-2">{item.arquivo}</td>
                  <td className="px-3 py-2">{formatarTipo(item.tipo)}</td>
                  <td className="px-3 py-2">{item.totalLinhas}</td>
                  <td className="px-3 py-2 text-green-700">{item.importadas}</td>
                  <td className="px-3 py-2 text-red-700">{item.ignoradas}</td>
                  <td className="px-3 py-2">{formatarData(item.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
