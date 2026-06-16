'use client'

// app/(dashboard)/grade/page.tsx
// Sprint 5.5 — Página de Gestão da Grade do Curso

import { useState, useEffect } from 'react'
import { QuadroHorarios } from '@/components/grade/QuadroHorarios'
import { useGrade } from '@/hooks/useGrade'
import { ExportarGradePDF } from '@/components/relatorios/ExportarGradePDF'

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

interface Curso {
  id: string
  codigo: string
  nome: string
}

interface PeriodoLetivo {
  id: string
  descricao: string
  status: string
}

const LABEL_TURNO: Record<string, string> = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function GradePage() {
  const {
    gerando,
    erro: erroHook,
    resultado,
    turmasExpandidas,
    gerarGradeCurso,
    carregarGrade,
    toggleTurma,
    expandirTodas,
    limparGrade,
  } = useGrade()

  const [cursos, setCursos] = useState<Curso[]>([])
  const [periodosLetivos, setPeriodosLetivos] = useState<PeriodoLetivo[]>([])
  const [cursoId, setCursoId] = useState('')
  const [periodoLetivoId, setPeriodoLetivoId] = useState('')
  const [substituirExistentes, setSubstituirExistentes] = useState(false)
  const [carregandoFiltros, setCarregandoFiltros] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Carrega cursos e períodos letivos
  useEffect(() => {
    async function carregarFiltros() {
      try {
        const [resCursos, resPeriodos] = await Promise.all([
          fetch('/api/cursos'),
          fetch('/api/periodos-letivos'),
        ])
        const dataCursos = await resCursos.json()
        const dataPeriodos = await resPeriodos.json()
        setCursos(dataCursos.cursos ?? [])
        setPeriodosLetivos(Array.isArray(dataPeriodos) ? dataPeriodos : dataPeriodos.periodos ?? [])
      } catch (error) {
        console.error('Erro ao carregar filtros:', error)
        setCarregandoFiltros(false)
      } finally {
        setCarregandoFiltros(false)
      }
    }
    carregarFiltros()
  }, [])

  async function handleGerar() {
    if (!cursoId || !periodoLetivoId) return
    setErro(null)
    try {
      await gerarGradeCurso({ cursoId, periodoLetivoId, substituirExistentes })
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao gerar grade')
    }
  }

  async function handleCarregar() {
    if (!cursoId || !periodoLetivoId) return
    setErro(null)
    const data = await carregarGrade(cursoId, periodoLetivoId)
    if (!data) {
      setErro('Nenhuma grade encontrada para este curso e periodo letivo.')
    }
  }

  // Ordena turmas: período crescente → Manhã → Tarde → Noite
  const ordemTurno = { MANHA: 0, TARDE: 1, NOITE: 2 }
  const turmasOrdenadas = resultado
    ? [...resultado.turmas].sort(
        (a, b) =>
          a.turma.periodo - b.turma.periodo ||
          (ordemTurno[a.turma.turno as keyof typeof ordemTurno] ?? 3) -
            (ordemTurno[b.turma.turno as keyof typeof ordemTurno] ?? 3)
      )
    : []

  // Agrupa por período para exibir cabeçalhos
  const turmasPorPeriodo = turmasOrdenadas.reduce<Record<number, typeof turmasOrdenadas>>(
    (acc, rt) => {
      if (!acc[rt.turma.periodo]) acc[rt.turma.periodo] = []
      acc[rt.turma.periodo].push(rt)
      return acc
    },
    {}
  )

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">
        {/* Cabeçalho com descrição */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerador de Grade Acadêmica</h1>
          <p className="text-sm text-gray-700 mt-2">
            Gere a grade completa do curso para todas as turmas de um período letivo.
            <br/>
            <strong>Use esta função para:</strong> Alocar disciplinas em massa por curso.
            <br/>
            <strong>Para ajustes individuais:</strong> Acesse <a href="/alocacoes" className="text-blue-600 hover:underline">Alocações</a>
          </p>
        </div>

        {/* Painel de controle */}
        <div className="bg-white rounded-lg border border-[#dddddd] p-5">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            {/* Seletor de curso */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium tracking-widest text-gray-700 uppercase mb-1.5">
                Curso
              </label>
              <select
                value={cursoId}
                onChange={(e) => {
                  setCursoId(e.target.value)
                  limparGrade()
                  setErro(null)
                }}
                disabled={carregandoFiltros}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white disabled:opacity-50"
              >
                <option value="">Selecione um curso...</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Seletor de período letivo */}
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium tracking-widest text-gray-700 uppercase mb-1.5">
                Período Letivo
              </label>
              <select
                value={periodoLetivoId}
                onChange={(e) => {
                  setPeriodoLetivoId(e.target.value)
                  limparGrade()
                  setErro(null)
                }}
                disabled={carregandoFiltros}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white disabled:opacity-50"
              >
                <option value="">Selecione um período...</option>
                {periodosLetivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.descricao}
                  </option>
                ))}
              </select>
            </div>

            {/* Checkbox substituir */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={substituirExistentes}
                  onChange={(e) => setSubstituirExistentes(e.target.checked)}
                  className="w-4 h-4"
                />
                Substituir existentes
              </label>
            </div>

            {/* Botão gerar */}
            <button
              onClick={handleCarregar}
              disabled={!cursoId || !periodoLetivoId || gerando}
              className="px-4 py-2 border border-[#2e7d32] text-[#2e7d32] rounded font-medium text-sm hover:bg-[#e8f5e9] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {gerando ? 'Carregando...' : 'Carregar Grade'}
            </button>

            <button
              onClick={handleGerar}
              disabled={!cursoId || !periodoLetivoId || gerando}
              className="px-4 py-2 bg-[#2e7d32] text-white rounded font-medium text-sm hover:bg-[#1b5e20] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {gerando ? 'Gerando...' : 'Gerar Grade'}
            </button>

            {/* Exportar PDF institucional — visível apenas com curso e período selecionados */}
            {cursoId && periodoLetivoId && (
              <ExportarGradePDF
                cursoId={cursoId}
                periodoLetivoId={periodoLetivoId}
                cursoNome={cursos.find((c) => c.id === cursoId)?.nome ?? 'Grade'}
                periodoDescricao={periodosLetivos.find((p) => p.id === periodoLetivoId)?.descricao ?? ''}
              />
            )}
          </div>
        </div>

        {/* Mensagens de erro */}
        {(erro || erroHook) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{erro || erroHook}</p>
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div className="space-y-6">
            {/* Resumo geral */}
            <div className="bg-white rounded-lg border border-[#dddddd] p-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-gray-700 uppercase font-medium">Total de Disciplinas</p>
                  <p className="text-2xl font-bold text-[#333333]">{resultado.resumo.totalDisciplinas}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-700 uppercase font-medium">Alocadas</p>
                  <p className="text-2xl font-bold text-[#2e7d32]">{resultado.resumo.totalAlocadas}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-700 uppercase font-medium">Pendentes</p>
                  <p className="text-2xl font-bold text-[#f9a825]">{resultado.resumo.totalPendencias}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-700 uppercase font-medium">Conflitos</p>
                  <p className="text-2xl font-bold text-[#d32f2f]">{resultado.resumo.totalConflitos}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-700 uppercase font-medium">Taxa de Sucesso</p>
                  <p className="text-2xl font-bold text-[#1976d2]">{resultado.resumo.taxaSucesso}%</p>
                </div>
              </div>
            </div>

            {/* Turmas por período */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => expandirTodas(true)}
                className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Expandir todas
              </button>
              <button
                type="button"
                onClick={() => expandirTodas(false)}
                className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Recolher todas
              </button>
            </div>

            {Object.entries(turmasPorPeriodo)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([periodo, turmas]) => (
                <div key={periodo}>
                  <h2 className="text-lg font-semibold text-[#333333] mb-3">
                    Período {periodo}
                  </h2>
                  <div className="space-y-3">
                    {turmas.map((resultadoTurma) => (
                      <QuadroHorarios
                        key={resultadoTurma.turma.id}
                        turma={resultadoTurma.turma}
                        alocadas={resultadoTurma.alocadas}
                        pendencias={resultadoTurma.pendencias}
                        conflitos={resultadoTurma.conflitos}
                        expandido={turmasExpandidas[resultadoTurma.turma.id] ?? true}
                        onToggle={() => toggleTurma(resultadoTurma.turma.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Estado vazio */}
        {!resultado && !gerando && (
          <div className="bg-white rounded-lg border border-[#dddddd] p-8 text-center">
            <p className="text-gray-700">Selecione um curso e período letivo para gerar a grade.</p>
          </div>
        )}
      </div>
    </div>
  )
}
