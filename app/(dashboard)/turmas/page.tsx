// app/(dashboard)/turmas/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTurmas, type Turma, type Turno } from '@/hooks/useTurmas'
import { usePeriodosLetivos, type PeriodoLetivo } from '@/hooks/usePeriodosLetivos'
import { TurmaModal } from '@/components/turmas/TurmaModal'
import { DesativarTurmaModal } from '@/components/turmas/DesativarTurmaModal'
import { PeriodoLetivoModal } from '@/components/periodos-letivos/PeriodoLetivoModal'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Curso { id: string; nome: string; codigo: string; totalPeriodos: number }

// ─── Utilitários ──────────────────────────────────────────────────────────────

const TURNO_LABELS: Record<Turno, string> = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite' }

const STATUS_PERIODO = {
  PLANEJAMENTO: { label: 'Planejamento', cls: 'bg-yellow-50 text-yellow-900 border border-yellow-200' },
  ATIVO: { label: 'Ativo', cls: 'bg-[#e8f5e9] text-[#1b5e20] border border-[#a5d6a7]' },
  FINALIZADO: { label: 'Finalizado', cls: 'bg-gray-100 text-gray-700 border border-gray-300' },
}

function Badge({ status }: { status: keyof typeof STATUS_PERIODO }) {
  const s = STATUS_PERIODO[status] ?? STATUS_PERIODO.PLANEJAMENTO
  return (
    <span className={`text-xs px-3 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
  )
}

function Pagination({
  page, totalPages, onChange,
}: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }
  return (
    <div className="flex items-center gap-1 justify-center mt-6">
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        className="px-3 py-1.5 text-sm rounded border border-[#ddd] text-gray-700 hover:bg-gray-50 disabled:opacity-40">
        ←
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-2 text-gray-700">…</span>
        ) : (
          <button key={p} onClick={() => onChange(Number(p))}
            className={`px-3 py-1.5 text-sm rounded border ${p === page ? 'bg-[#2e7d32] text-white border-[#2e7d32]' : 'border-[#ddd] text-gray-700 hover:bg-gray-50'}`}>
            {p}
          </button>
        )
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
        className="px-3 py-1.5 text-sm rounded border border-[#ddd] text-gray-700 hover:bg-gray-50 disabled:opacity-40">
        →
      </button>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function TurmasPage() {
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [filtroCurso, setFiltroCurso] = useState('')
  const [filtroPeriodoLetivo, setFiltroPeriodoLetivo] = useState('')
  const [filtroTurno, setFiltroTurno] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState('')
  const [page, setPage] = useState(1)

  const [cursos, setCursos] = useState<Curso[]>([])
  const [modalTurma, setModalTurma] = useState(false)
  const [modalDesativar, setModalDesativar] = useState(false)
  const [modalPeriodo, setModalPeriodo] = useState(false)
  const [turmaSelecionada, setTurmaSelecionada] = useState<Turma | null>(null)
  const [periodoSelecionado, setPeriodoSelecionado] = useState<PeriodoLetivo | null>(null)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [aba, setAba] = useState<'turmas' | 'periodos'>('turmas')

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => { setBuscaDebounced(busca); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [busca])

  const { turmas, total, totalPages, loading, createTurma, updateTurma, deleteTurma } = useTurmas({
    busca: buscaDebounced,
    cursoId: filtroCurso,
    periodoLetivoId: filtroPeriodoLetivo,
    turno: filtroTurno,
    periodo: filtroPeriodo,
    ativo: filtroAtivo,
    page,
  })

  const { periodos, loading: loadingPeriodos, createPeriodo, updatePeriodo, deletePeriodo } = usePeriodosLetivos()

  // Carrega cursos para os selects
  useEffect(() => {
    fetch('/api/cursos').then(r => r.json()).then(d => setCursos(d.cursos ?? []))
  }, [])

  const mostrarFeedback = useCallback((tipo: 'ok' | 'erro', msg: string) => {
    setFeedback({ tipo, msg })
    setTimeout(() => setFeedback(null), 3500)
  }, [])

  // ── Handlers Turmas ────────────────────────────────────────────────────────

  const handleNovaOuEditarTurma = () => {
    setTurmaSelecionada(null)
    setModalTurma(true)
  }

  const handleEditarTurma = (turma: Turma) => {
    setTurmaSelecionada(turma)
    setModalTurma(true)
  }

  const handleSalvarTurma = async (data: any) => {
    try {
      if (turmaSelecionada) {
        await updateTurma(turmaSelecionada.id, { nome: data.nome, turno: data.turno })
        mostrarFeedback('ok', 'Turma atualizada com sucesso.')
      } else {
        await createTurma(data)
        mostrarFeedback('ok', 'Turma criada com sucesso.')
      }
    } catch (e: any) {
      mostrarFeedback('erro', e.message)
      throw e
    }
  }

  const handleDesativar = (turma: Turma) => {
    setTurmaSelecionada(turma)
    setModalDesativar(true)
  }

  const handleConfirmarDesativar = async (id: string, motivo: string) => {
    try {
      await updateTurma(id, { ativo: false, motivo })
      mostrarFeedback('ok', 'Turma desativada.')
    } catch (e: any) {
      mostrarFeedback('erro', e.message)
      throw e
    }
  }

  const handleReativar = async (turma: Turma) => {
    try {
      await updateTurma(turma.id, { ativo: true })
      mostrarFeedback('ok', 'Turma reativada.')
    } catch (e: any) {
      mostrarFeedback('erro', e.message)
    }
  }

  // ── Handlers Períodos Letivos ──────────────────────────────────────────────

  const handleNovoPeriodo = () => {
    setPeriodoSelecionado(null)
    setModalPeriodo(true)
  }

  const handleEditarPeriodo = (p: PeriodoLetivo) => {
    setPeriodoSelecionado(p)
    setModalPeriodo(true)
  }

  const handleSalvarPeriodo = async (data: any) => {
    try {
      if (periodoSelecionado) {
        await updatePeriodo(periodoSelecionado.id, data)
        mostrarFeedback('ok', 'Período atualizado.')
      } else {
        await createPeriodo(data)
        mostrarFeedback('ok', 'Período letivo criado.')
      }
    } catch (e: any) {
      mostrarFeedback('erro', e.message)
      throw e
    }
  }

  const handleExcluirPeriodo = async (p: PeriodoLetivo) => {
    if (!confirm(`Excluir o período ${p.descricao}?`)) return
    try {
      await deletePeriodo(p.id)
      mostrarFeedback('ok', 'Período excluído.')
    } catch (e: any) {
      mostrarFeedback('erro', e.message)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Breadcrumb */}
        <p className="mb-1 text-sm text-gray-700">
          Dashboard <span className="text-gray-700 mx-1">›</span>
          <span className="text-gray-800">Turmas</span>
        </p>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Turmas</h1>
          <div className="flex gap-2">
            <button onClick={handleNovoPeriodo}
              className="bg-white text-[#2e7d32] border border-[#2e7d32] px-4 py-2 rounded text-sm font-medium hover:bg-[#e8f5e9] transition">
              + Período Letivo
            </button>
            <button onClick={handleNovaOuEditarTurma}
              className="bg-[#2e7d32] text-white px-5 py-2 rounded text-sm font-medium hover:bg-[#1a5c1a] transition">
              + Nova Turma
            </button>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`mb-4 px-4 py-2.5 rounded text-sm border ${feedback.tipo === 'ok' ? 'bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]' : 'bg-red-50 text-red-800 border-red-200'}`}>
            {feedback.msg}
          </div>
        )}

        {/* Abas */}
        <div className="flex gap-0 mb-6 border-b border-[#ddd]">
          {(['turmas', 'periodos'] as const).map(a => (
            <button key={a} onClick={() => setAba(a)}
              className={`px-5 py-2.5 text-xs font-medium tracking-wider uppercase border-b-2 transition ${aba === a ? 'text-[#2e7d32] border-[#2e7d32]' : 'text-gray-700 border-transparent hover:text-gray-900'}`}>
              {a === 'turmas' ? 'Turmas' : 'Períodos Letivos'}
            </button>
          ))}
        </div>

        {/* ── ABA: TURMAS ─────────────────────────────────────────────────── */}
        {aba === 'turmas' && (
          <>
            {/* Filtros */}
            <div className="bg-white border border-[#ddd] rounded-lg p-4 mb-4 flex flex-wrap gap-3">
              <input
                value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por código ou nome..."
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] flex-1 min-w-[200px]"
              />
              <select value={filtroPeriodoLetivo} onChange={e => { setFiltroPeriodoLetivo(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white">
                <option value="">Todos os períodos</option>
                {periodos.map(p => <option key={p.id} value={p.id}>{p.descricao}</option>)}
              </select>
              <select value={filtroCurso} onChange={e => { setFiltroCurso(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white">
                <option value="">Todos os cursos</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <select value={filtroTurno} onChange={e => { setFiltroTurno(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white">
                <option value="">Todos os turnos</option>
                {(Object.keys(TURNO_LABELS) as Turno[]).map(t => <option key={t} value={t}>{TURNO_LABELS[t]}</option>)}
              </select>
              <select value={filtroPeriodo} onChange={e => { setFiltroPeriodo(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white">
                <option value="">Todos os períodos matriz</option>
                {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>{p}º Período</option>)}
              </select>
              <select value={filtroAtivo} onChange={e => { setFiltroAtivo(e.target.value); setPage(1) }}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white">
                <option value="">Todos os status</option>
                <option value="true">Ativas</option>
                <option value="false">Inativas</option>
              </select>
            </div>

            {/* Tabela */}
            <div className="bg-white border border-[#ddd] rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#ddd] flex items-center justify-between">
                    <span className="text-xs font-medium tracking-widest text-gray-700 uppercase">
                      {loading ? 'Carregando...' : `${total} turma(s) encontrada(s)`}
                    </span>
                  </div>

              {loading ? (
                <div className="text-center py-16 text-sm text-gray-700">Carregando turmas...</div>
              ) : turmas.length === 0 ? (
                <div className="text-center py-16 text-sm text-gray-700">Nenhuma turma encontrada.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#ddd] bg-gray-50">
                      {['Código', 'Nome', 'Curso', 'Período Letivo', 'Matriz', 'Turno', 'Alocações', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium tracking-widest text-gray-700 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {turmas.map((turma, i) => (
                      <tr key={turma.id} className={`border-b border-[#ddd] hover:bg-gray-50 ${!turma.ativo ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-900">{turma.codigo}</td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{turma.nome}</td>
                        <td className="px-4 py-3 text-gray-900">{turma.curso.nome}</td>
                        <td className="px-4 py-3">
                          <Badge status={turma.periodoLetivo.status as any} />
                          <span className="ml-2 text-xs text-gray-900">{turma.periodoLetivo.descricao}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900">{turma.periodo}º</td>
                        <td className="px-4 py-3 text-gray-900">{TURNO_LABELS[turma.turno]}</td>
                        <td className="px-4 py-3 text-center text-gray-900">{turma._count?.alocacoes ?? 0}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-3 py-0.5 rounded-full border ${turma.ativo ? 'bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]' : 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                            {turma.ativo ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => handleEditarTurma(turma)}
                              className="text-xs text-[#2e7d32] hover:underline">
                              Editar
                            </button>
                            {turma.ativo ? (
                              <button onClick={() => handleDesativar(turma)}
                                className="text-xs text-[#e53935] hover:underline">
                                Desativar
                              </button>
                            ) : (
                              <button onClick={() => handleReativar(turma)}
                                className="text-xs text-gray-700 hover:underline">
                                Reativar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}

        {/* ── ABA: PERÍODOS LETIVOS ────────────────────────────────────────── */}
        {aba === 'periodos' && (
          <div className="bg-white border border-[#ddd] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[#ddd]">
              <span className="text-xs font-medium tracking-widest text-gray-700 uppercase">
                {loadingPeriodos ? 'Carregando...' : `${periodos.length} período(s) cadastrado(s)`}
              </span>
            </div>

            {periodos.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-700">
                Nenhum período letivo cadastrado. Clique em "+ Período Letivo" para começar.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#ddd] bg-gray-50">
                    {['Período', 'Início', 'Fim', 'Turmas', 'Status', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium tracking-widest text-gray-700 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodos.map(p => (
                    <tr key={p.id} className="border-b border-[#ddd] hover:bg-gray-50">
                      <td className="px-4 py-3 font-bold text-[#333] text-base">{p.descricao}</td>
                      <td className="px-4 py-3 text-gray-900">{new Date(p.dataInicio).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 text-gray-900">{new Date(p.dataFim).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 text-center text-gray-900">{p._count?.turmas ?? '—'}</td>
                      <td className="px-4 py-3"><Badge status={p.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => handleEditarPeriodo(p)} className="text-xs text-[#2e7d32] hover:underline">Editar</button>
                          {p.status === 'PLANEJAMENTO' && (
                            <button onClick={() => handleExcluirPeriodo(p)} className="text-xs text-[#e53935] hover:underline">Excluir</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>

      {/* Modais */}
      <TurmaModal
        open={modalTurma}
        onClose={() => setModalTurma(false)}
        onSubmit={handleSalvarTurma}
        turma={turmaSelecionada}
        cursos={cursos}
        periodosLetivos={periodos}
      />

      <DesativarTurmaModal
        open={modalDesativar}
        turma={turmaSelecionada}
        onClose={() => setModalDesativar(false)}
        onConfirm={handleConfirmarDesativar}
      />

      <PeriodoLetivoModal
        open={modalPeriodo}
        onClose={() => setModalPeriodo(false)}
        onSubmit={handleSalvarPeriodo}
        periodo={periodoSelecionado}
      />
    </div>
  )
}
