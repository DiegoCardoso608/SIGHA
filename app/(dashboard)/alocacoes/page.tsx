'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGrade, type Alocacao, type ResultadoGeracao } from '@/hooks/useGrade'
import { AulaEditorModal } from '@/components/grade/AulaEditorModal'

const DIAS = [
  { key: 'SEGUNDA', label: 'Segunda' },
  { key: 'TERCA', label: 'Terca' },
  { key: 'QUARTA', label: 'Quarta' },
  { key: 'QUINTA', label: 'Quinta' },
  { key: 'SEXTA', label: 'Sexta' },
  { key: 'SABADO', label: 'Sabado' },
]

interface PeriodoLetivo {
  id: string
  descricao: string
  status: string
}

interface Turma {
  id: string
  codigo: string
  nome: string
  turno: string
  periodo: number
  curso: { nome: string }
  periodoLetivo: { id: string; descricao: string; status: string }
}

interface BlocoHorario {
  id: string
  inicio: string
  fim: string
  turno: string
  ordem: number
}

function ResultadoModal({
  resultado,
  onFechar,
}: {
  resultado: ResultadoGeracao
  onFechar: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Resultado da geracao</h2>
            <p className="mt-1 text-sm text-gray-700">
              {resultado.resumo.alocadas} de {resultado.resumo.total} disciplinas alocadas.
            </p>
          </div>
          <button className="rounded border px-3 py-1 text-sm" onClick={onFechar}>
            Fechar
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-md border border-green-200 bg-green-50 p-3">
            <div className="text-2xl font-bold text-green-800">{resultado.resumo.alocadas}</div>
            <div className="text-xs text-green-900">Alocadas</div>
          </div>
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
            <div className="text-2xl font-bold text-yellow-800">{resultado.resumo.pendentes}</div>
            <div className="text-xs text-yellow-900">Pendentes</div>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="text-2xl font-bold text-gray-800">{resultado.resumo.taxaSucesso}%</div>
            <div className="text-xs text-gray-700">Sucesso</div>
          </div>
        </div>

        {resultado.pendencias.length > 0 && (
          <div className="mt-5 space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">Pendencias</h3>
            {resultado.pendencias.map((pendencia, index) => (
              <div key={`${pendencia.turmaId}-${pendencia.disciplinaId}-${index}`} className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm">
                <div className="font-medium text-gray-900">{pendencia.disciplinaNome}</div>
                <div className="text-xs text-gray-700">{pendencia.turmaNome}</div>
                <div className="mt-1 text-xs text-yellow-800">{pendencia.motivo}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AlocacoesPage() {
  const {
    alocacoes,
    carregando,
    gerando,
    erro,
    buscarAlocacoes,
    gerarGrade,
    removerAlocacao,
    criarAlocacaoManual,
    editarAlocacaoManual,
    fixarAlocacao,
    desfixarAlocacao,
  } = useGrade()

  const [periodos, setPeriodos] = useState<PeriodoLetivo[]>([])
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [blocos, setBlocos] = useState<BlocoHorario[]>([])
  const [periodoSelecionado, setPeriodoSelecionado] = useState('')
  const [turmaSelecionada, setTurmaSelecionada] = useState('')
  const [resultado, setResultado] = useState<ResultadoGeracao | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [editorAberto, setEditorAberto] = useState(false)
  const [editorModo, setEditorModo] = useState<'create' | 'edit'>('create')
  const [editorAlocacao, setEditorAlocacao] = useState<{
    id?: string
    disciplinaId?: string
    professorId?: string | null
    blocoId?: string
    diaSemana?: string
    online?: boolean
    fixa?: boolean
  } | null>(null)

  useEffect(() => {
    const turmaIdInicial = new URLSearchParams(window.location.search).get('turmaId')

    Promise.all([
      fetch('/api/periodos-letivos').then((res) => res.json()),
      fetch('/api/blocos').then((res) => res.json()),
      fetch('/api/professores?ativo=true&porPagina=50').then((res) => res.json()),
      turmaIdInicial
        ? fetch('/api/turmas?ativo=true&limit=500').then((res) => res.json())
        : Promise.resolve({ turmas: [] }),
    ]).then(([periodosData, blocosData, professoresData, turmasData]) => {
      const listaPeriodos = (periodosData.periodos ?? []) as PeriodoLetivo[]
      const listaTurmasUrl = (turmasData.turmas ?? []) as Turma[]
      const turmaUrl = turmaIdInicial
        ? listaTurmasUrl.find((turma) => turma.id === turmaIdInicial)
        : undefined

      setPeriodos(listaPeriodos)
      setBlocos((blocosData.blocos ?? []) as BlocoHorario[])

      const periodoPadrao = listaPeriodos.find((periodo) => periodo.status === 'ATIVO') ?? listaPeriodos[0]
      if (turmaUrl) {
        setPeriodoSelecionado(turmaUrl.periodoLetivo.id)
        setTurmaSelecionada(turmaUrl.id)
      } else if (periodoPadrao) {
        setPeriodoSelecionado(periodoPadrao.id)
      }
    })
  }, [])

  useEffect(() => {
    if (!periodoSelecionado) return

    fetch(`/api/turmas?periodoLetivoId=${periodoSelecionado}&ativo=true&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        const lista = (data.turmas ?? []) as Turma[]
        setTurmas(lista)
        setTurmaSelecionada((atual) => (lista.some((turma) => turma.id === atual) ? atual : lista[0]?.id ?? ''))
      })
  }, [periodoSelecionado])

  useEffect(() => {
    if (!turmaSelecionada) return
    buscarAlocacoes({ turmaId: turmaSelecionada })
  }, [buscarAlocacoes, turmaSelecionada])

  const turmaAtual = useMemo(
    () => turmas.find((turma) => turma.id === turmaSelecionada),
    [turmaSelecionada, turmas]
  )

  const blocosFiltrados = useMemo(
    () => (turmaAtual ? blocos.filter((bloco) => bloco.turno === turmaAtual.turno) : blocos),
    [blocos, turmaAtual]
  )

  const porSlot = useMemo(() => {
    const mapa = new Map<string, Alocacao>()
    for (const alocacao of alocacoes) {
      mapa.set(`${alocacao.blocoId}|${alocacao.diaSemana}`, alocacao)
    }
    return mapa
  }, [alocacoes])

  const gerar = useCallback(
    async (substituirExistentes: boolean) => {
      if (!periodoSelecionado) return
      setMensagem(null)
      const res = await gerarGrade({
        periodoLetivoId: periodoSelecionado,
        turmaIds: turmaSelecionada ? [turmaSelecionada] : undefined,
        substituirExistentes,
      })
      setResultado(res)
      if (turmaSelecionada) await buscarAlocacoes({ turmaId: turmaSelecionada })
    },
    [buscarAlocacoes, gerarGrade, periodoSelecionado, turmaSelecionada]
  )

  const abrirModalCriacao = (diaSemana: string, blocoId: string) => {
    setEditorModo('create')
    setEditorAlocacao({
      disciplinaId: '',
      professorId: null,
      blocoId,
      diaSemana,
      online: false,
      fixa: false,
    })
    setEditorAberto(true)
  }

  const abrirModalEdicao = (alocacao: Alocacao) => {
    setEditorModo('edit')
    setEditorAlocacao({
      id: alocacao.id,
      disciplinaId: alocacao.disciplinaId,
      professorId: alocacao.professorId,
      blocoId: alocacao.blocoId,
      diaSemana: alocacao.diaSemana,
      online: alocacao.online,
      fixa: alocacao.fixa,
    })
    setEditorAberto(true)
  }

  const fecharEditor = async () => {
    setEditorAberto(false)
    setEditorAlocacao(null)
    if (turmaSelecionada) {
      await buscarAlocacoes({ turmaId: turmaSelecionada })
    }
  }

  const pendentes = alocacoes.filter((alocacao) => alocacao.status === 'PENDENTE').length
  const conflitos = alocacoes.filter((alocacao) => alocacao.status === 'CONFLITO').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alocacoes</h1>
          <p className="mt-2 text-gray-700">Gere e ajuste a grade de horarios por turma.</p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-700">Periodo letivo</span>
            <select
              className="w-44 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={periodoSelecionado}
              onChange={(event) => setPeriodoSelecionado(event.target.value)}
            >
              <option value="">Selecione</option>
              {periodos.map((periodo) => (
                <option key={periodo.id} value={periodo.id}>
                  {periodo.descricao}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-700">Turma</span>
            <select
              className="w-56 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={turmaSelecionada}
              onChange={(event) => setTurmaSelecionada(event.target.value)}
            >
              <option value="">Selecione</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.codigo} - {turma.nome}
                </option>
              ))}
            </select>
          </label>

          <button
            className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!periodoSelecionado || gerando}
            onClick={() => gerar(false)}
          >
            {gerando ? 'Gerando...' : 'Gerar grade'}
          </button>
          <button
            className="rounded-md border border-green-700 px-4 py-2 text-sm font-medium text-green-800 disabled:opacity-50"
            disabled={!periodoSelecionado || gerando}
            onClick={() => {
              if (confirm('Remover alocacoes existentes desta selecao e gerar novamente?')) gerar(true)
            }}
          >
            Regenerar
          </button>
        </div>
      </div>

      {(mensagem || erro) && (
        <div className={`rounded-md border p-3 text-sm ${erro ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
          {erro ?? mensagem}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1">{alocacoes.length} alocacoes</span>
        <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-yellow-800">{pendentes} pendentes</span>
        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-800">{conflitos} conflitos</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {carregando ? (
          <div className="p-10 text-center text-sm text-gray-700">Carregando grade...</div>
        ) : !turmaSelecionada ? (
          <div className="p-10 text-center text-sm text-gray-700">Selecione uma turma para visualizar a grade.</div>
        ) : (
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="w-28 border-b border-r border-gray-200 p-3 text-left text-xs font-semibold uppercase text-gray-700">
                  Horario
                </th>
                {DIAS.map((dia) => (
                  <th key={dia.key} className="border-b border-r border-gray-200 p-3 text-center text-xs font-semibold uppercase text-gray-700">
                    {dia.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blocosFiltrados.map((bloco) => (
                <tr key={bloco.id}>
                  <td className="border-r border-t border-gray-200 p-3 align-top text-xs text-gray-700">
                    <div className="font-semibold">{bloco.inicio}</div>
                    <div>{bloco.fim}</div>
                  </td>
                  {DIAS.map((dia) => {
                    const alocacao = porSlot.get(`${bloco.id}|${dia.key}`)
                    const detalhes = alocacao
                      ? (() => {
                          const cor =
                            alocacao.status === 'CONFLITO'
                              ? 'border-red-300 bg-red-50 text-red-900'
                              : alocacao.online
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                                : 'border-blue-300 bg-blue-50 text-blue-950'
                          return { cor }
                        })()
                      : null

                    return (
                      <td key={dia.key} className="h-24 border-r border-t border-gray-100 p-2 align-top">
                        {alocacao ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => abrirModalEdicao(alocacao)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                abrirModalEdicao(alocacao)
                              }
                            }}
                            className={`min-h-20 cursor-pointer rounded-md border p-2 text-xs ${detalhes?.cor}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold leading-tight">{alocacao.disciplina.nome}</div>
                              {alocacao.fixa && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                  Fixa
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-[11px] opacity-80">
                              {alocacao.professor?.usuario.nome ?? 'Sem professor'}
                            </div>
                            <div className="mt-1 flex gap-1">
                              {alocacao.origem === 'MANUAL' && (
                                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
                                  Manual
                                </span>
                              )}
                              {alocacao.origem === 'AUTOMATICA' && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                                  Automática
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => abrirModalCriacao(dia.key, bloco.id)}
                            className="flex h-full min-h-20 w-full items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-500 hover:bg-gray-100"
                          >
                            + Nova aula
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {resultado && <ResultadoModal resultado={resultado} onFechar={() => setResultado(null)} />}
      <AulaEditorModal
        open={editorAberto}
        mode={editorModo}
        turmaId={turmaSelecionada}
        alocacao={editorAlocacao}
        onClose={fecharEditor}
        onCreate={criarAlocacaoManual}
        onEdit={editarAlocacaoManual}
        onDelete={removerAlocacao}
        onFixar={fixarAlocacao}
        onDesfixar={desfixarAlocacao}
      />
    </div>
  )
}
