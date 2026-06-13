'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useProfessores, type Professor } from '@/hooks/useProfessores'
import { ProfessorModal } from '@/components/professores/ProfessorModal'

const TITULACAO_COR: Record<string, string> = {
  Doutor: 'bg-purple-50 text-purple-800 border-purple-200',
  Mestre: 'bg-blue-50 text-blue-800 border-blue-200',
  Especialista: 'bg-amber-50 text-amber-800 border-amber-200',
  'Pós-Doutor': 'bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]',
}

const DIAS_LABEL: Record<string, string> = {
  SEGUNDA: 'Seg',
  TERCA: 'Ter',
  QUARTA: 'Qua',
  QUINTA: 'Qui',
  SEXTA: 'Sex',
  SABADO: 'Sáb',
}

const TURNOS_LABEL: Record<string, string> = {
  MANHA: 'M',
  TARDE: 'T',
  NOITE: 'N',
}

export default function ProfessoresPage() {
  const { professores, meta, loading, erro, busca, setBusca, pagina, setPagina, criar, atualizar, desativar } =
    useProfessores()

  const [disciplinas, setDisciplinas] = useState<{ id: string; nome: string; codigo: string }[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [professorEditando, setProfessorEditando] = useState<Professor | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)

  useEffect(() => {
    fetch('/api/disciplinas')
      .then((r) => r.json())
      .then((j) => setDisciplinas(j.data || []))
  }, [])

  function abrirNovo() {
    setProfessorEditando(null)
    setModalAberto(true)
  }

  function abrirEditar(prof: Professor) {
    setProfessorEditando(prof)
    setModalAberto(true)
  }

  async function salvar(dados: Parameters<typeof criar>[0]) {
    const result = professorEditando
      ? await atualizar(professorEditando.id, dados)
      : await criar(dados)
    if (result.ok) {
      mostrarFeedback('ok', professorEditando ? 'Professor atualizado.' : 'Professor cadastrado.')
    }
    return result
  }

  async function confirmarDesativacao(id: string) {
    const result = await desativar(id)
    setConfirmandoId(null)
    if (result.ok) mostrarFeedback('ok', 'Professor desativado.')
    else mostrarFeedback('erro', result.erro || 'Erro ao desativar.')
  }

  function mostrarFeedback(tipo: 'ok' | 'erro', msg: string) {
    setFeedback({ tipo, msg })
    setTimeout(() => setFeedback(null), 3500)
  }

  // Resumo de disponibilidade por dia
  function diasAtivos(prof: Professor) {
    const dias = new Set(prof.disponibilidades.map((d) => d.diaSemana))
    return ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'].filter((d) => dias.has(d as any))
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Professores</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta.total} professor{meta.total !== 1 ? 'es' : ''} cadastrado{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="bg-[#2e7d32] text-white px-5 py-2 rounded text-sm font-medium hover:bg-[#1a5c1a] transition"
        >
          + Novo professor
        </button>
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value)
            setPagina(1)
          }}
          placeholder="Buscar por nome, email ou matrícula..."
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white w-full max-w-md"
        />
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={cn(
            'mb-4 px-4 py-3 rounded text-sm border',
            feedback.tipo === 'ok'
              ? 'bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]'
              : 'bg-red-50 text-red-800 border-red-200'
          )}
        >
          {feedback.msg}
        </div>
      )}

      {/* Estado de erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded mb-4">
          {erro}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Carregando...</div>
        ) : professores.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">
              {busca ? 'Nenhum professor encontrado para essa busca.' : 'Nenhum professor cadastrado.'}
            </p>
            {!busca && (
              <button
                onClick={abrirNovo}
                className="mt-3 text-[#2e7d32] text-sm underline hover:no-underline"
              >
                Cadastrar o primeiro professor
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Professor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Titulação
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  C.H. máx.
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Disponibilidade
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Disciplinas
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alocações
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {professores.map((prof) => (
                <tr key={prof.id} className="hover:bg-gray-50 transition-colors">
                  {/* Professor */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-gray-800">{prof.nome}</div>
                    <div className="text-xs text-gray-400">{prof.email}</div>
                    <div className="text-[10px] text-gray-300 font-mono">{prof.matricula}</div>
                  </td>

                  {/* Titulação */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-xs px-2.5 py-0.5 rounded-full border',
                        TITULACAO_COR[prof.titulacao] ?? 'bg-gray-50 text-gray-600 border-gray-200'
                      )}
                    >
                      {prof.titulacao}
                    </span>
                  </td>

                  {/* C.H. */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{prof.cargaHorariaMax}h</span>
                  </td>

                  {/* Disponibilidade */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {diasAtivos(prof).map((dia) => {
                        const turnos = prof.disponibilidades
                          .filter((d) => d.diaSemana === dia)
                          .map((d) => TURNOS_LABEL[d.turno])
                          .join('')
                        return (
                          <span
                            key={dia}
                            className="text-[10px] bg-[#e8f5e9] text-[#1b5e20] border border-[#a5d6a7] rounded px-1.5 py-0.5"
                            title={`${DIAS_LABEL[dia]}: ${turnos}`}
                          >
                            {DIAS_LABEL[dia]}({turnos})
                          </span>
                        )
                      })}
                      {prof.disponibilidades.length === 0 && (
                        <span className="text-xs text-gray-400">Sem disponibilidade</span>
                      )}
                    </div>
                  </td>

                  {/* Disciplinas */}
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {prof.disciplinas.slice(0, 3).map((d) => (
                        <span
                          key={d.disciplina.id}
                          className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5"
                          title={d.disciplina.nome}
                        >
                          {d.disciplina.codigo}
                        </span>
                      ))}
                      {prof.disciplinas.length > 3 && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                          +{prof.disciplinas.length - 3}
                        </span>
                      )}
                      {prof.disciplinas.length === 0 && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </td>

                  {/* Alocações */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{prof._count?.alocacoes ?? 0}</span>
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-3">
                    {confirmandoId === prof.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => confirmarDesativacao(prof.id)}
                          className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmandoId(null)}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => abrirEditar(prof)}
                          className="text-xs text-[#2e7d32] hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmandoId(prof.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Desativar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {meta.totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            Mostrando {(pagina - 1) * meta.limite + 1}–{Math.min(pagina * meta.limite, meta.total)} de{' '}
            {meta.total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPagina(pagina - 1)}
              disabled={pagina === 1}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPagina(pagina + 1)}
              disabled={pagina === meta.totalPaginas}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      <ProfessorModal
        aberto={modalAberto}
        professor={professorEditando}
        disciplinasDisponiveis={disciplinas}
        onFechar={() => setModalAberto(false)}
        onSalvar={salvar}
      />
    </div>
  )
}
