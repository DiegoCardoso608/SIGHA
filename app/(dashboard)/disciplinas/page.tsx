'use client'

// app/(dashboard)/disciplinas/page.tsx
// Sprint 2 — Página principal de gerenciamento de disciplinas

import { useState } from 'react'
import { useDisciplinas, type Disciplina } from '@/hooks/useDisciplinas'
import DisciplinaModal from '@/components/disciplinas/DisciplinaModal'
import DesativarDisciplinaModal from '@/components/disciplinas/DesativarDisciplinaModal'

// ─── Componente de paginação (reutilizável) ───────────────────────────────────

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const getPages = () => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('...')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i)
      }
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ‹
      </button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-700">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={`px-3 py-1.5 text-sm rounded border transition ${
              p === page
                ? 'bg-[#2e7d32] text-white border-[#2e7d32]'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ›
      </button>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DisciplinasPage() {
  // Filtros
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [page, setPage] = useState(1)

  // Modais
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDisciplina, setEditingDisciplina] = useState<Disciplina | null>(null)
  const [desativarDisciplina, setDesativarDisciplina] = useState<Disciplina | null>(null)

  const { disciplinas, pagination, loading, error, refresh } = useDisciplinas({
    search,
    status,
    page,
    limit: 15,
  })

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleStatusChange(value: 'todos' | 'ativo' | 'inativo') {
    setStatus(value)
    setPage(1)
  }

  function handleNovaDisciplina() {
    setEditingDisciplina(null)
    setModalOpen(true)
  }

  function handleEditar(d: Disciplina) {
    setEditingDisciplina(d)
    setModalOpen(true)
  }

  async function handleReativar(d: Disciplina) {
    try {
      const res = await fetch(`/api/disciplinas/${d.id}`, { method: 'DELETE' })
      if (res.ok) refresh()
    } catch {
      // erro silencioso — usuário pode tentar de novo
    }
  }

  function handleSaved() {
    setModalOpen(false)
    setEditingDisciplina(null)
    refresh()
  }

  function handleDesativada() {
    setDesativarDisciplina(null)
    refresh()
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] p-6">
      {/* Breadcrumb */}
      <p className="text-sm text-gray-700 mb-1">
        Coordenação <span className="text-gray-700 mx-1">›</span>{' '}
        <span className="text-gray-800">Disciplinas</span>
      </p>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Disciplinas</h1>
        <button
          onClick={handleNovaDisciplina}
          className="bg-[#2e7d32] text-white px-5 py-2 rounded text-sm font-medium hover:bg-[#1a5c1a] transition"
        >
          + Nova Disciplina
        </button>
      </div>

      {/* Card de listagem */}
      <div className="bg-white rounded-lg border border-[#ddd] overflow-hidden">
        {/* Filtros */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#ddd]">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome ou código..."
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white w-72"
          />

          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as 'todos' | 'ativo' | 'inativo')}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white"
          >
            <option value="todos">Todos os status</option>
            <option value="ativo">Apenas ativos</option>
            <option value="inativo">Apenas inativos</option>
          </select>

          {pagination.total > 0 && (
            <span className="text-sm text-gray-700 ml-auto">
              {pagination.total} disciplina{pagination.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Tabela */}
        {error ? (
          <div className="px-4 py-8 text-center text-red-600 text-sm">{error}</div>
        ) : loading ? (
          <div className="px-4 py-12 text-center text-gray-700 text-sm">Carregando...</div>
        ) : disciplinas.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-700 text-sm">
            {search ? 'Nenhuma disciplina encontrada para esta busca.' : 'Nenhuma disciplina cadastrada.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ddd] bg-[#f5f5f5]">
                <th className="text-left px-4 py-3 text-xs font-medium tracking-widest text-gray-700 uppercase">
                  Código
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium tracking-widest text-gray-700 uppercase">
                  Nome
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium tracking-widest text-gray-700 uppercase">
                  C.H.
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium tracking-widest text-gray-700 uppercase">
                  Cursos
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium tracking-widest text-gray-700 uppercase">
                  Professores
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium tracking-widest text-gray-700 uppercase">
                  Modalidade
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium tracking-widest text-gray-700 uppercase">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {disciplinas.map((d, i) => (
                <tr
                  key={d.id}
                  className={`border-b border-[#f0f0f0] hover:bg-[#fafafa] transition ${
                    !d.ativo ? 'opacity-60' : ''
                  } ${i % 2 === 0 ? '' : 'bg-[#fafafa]'}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-900 whitespace-nowrap">
                    {d.codigo}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{d.nome}</td>
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                    {d.cargaHoraria}h
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {d.cursos.length === 0 ? (
                        <span className="text-gray-700 text-xs italic">—</span>
                      ) : (
                        d.cursos.map((cd) => (
                          <span
                            key={cd.cursoId}
                            className="text-xs bg-[#e8f5e9] text-[#1b5e20] border border-[#a5d6a7] px-2 py-0.5 rounded-full"
                            title={`${cd.curso.nome} — ${cd.periodo}º período`}
                          >
                            {cd.curso.codigo} P{cd.periodo}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                      {d.professores.length === 0 ? (
                        <span className="text-xs text-gray-700 italic">Sem professores</span>
                      ) : (
                        <span className="text-xs text-gray-900">
                          {d.professores.length} prof.
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">                    <span
                      className={`text-xs px-3 py-0.5 rounded-full border ${
                        d.modalidade === 'ONLINE'
                          ? 'bg-[#e3f2fd] text-[#0d47a1] border-[#90caf9]'
                          : 'bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]'
                      }`}
                    >
                      {d.modalidade === 'ONLINE' ? 'Online' : 'Presencial'}
                    </span>
                  </td>
                  <td className="px-4 py-3">                    {d.ativo ? (
                      <span className="bg-[#e8f5e9] text-[#1b5e20] border border-[#a5d6a7] text-xs px-3 py-0.5 rounded-full">
                        Ativo
                      </span>
                    ) : (
                      <span className="bg-[#f5f5f5] text-gray-700 border border-[#ddd] text-xs px-3 py-0.5 rounded-full">
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleEditar(d)}
                        className="text-xs text-[#2e7d32] hover:text-[#1a5c1a] font-medium"
                      >
                        Editar
                      </button>
                      {d.ativo ? (
                        <button
                          onClick={() => setDesativarDisciplina(d)}
                          className="text-xs text-[#e53935] hover:text-red-700 font-medium"
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReativar(d)}
                          className="text-xs text-gray-700 hover:text-[#2e7d32] font-medium"
                        >
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

        {/* Paginação */}
        {!loading && pagination.totalPages > 1 && (
          <div className="px-4 py-4 border-t border-[#f0f0f0]">
            <PaginationControls
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Modais */}
      {modalOpen && (
        <DisciplinaModal
          disciplina={editingDisciplina}
          onClose={() => {
            setModalOpen(false)
            setEditingDisciplina(null)
          }}
          onSaved={handleSaved}
        />
      )}

      {desativarDisciplina && (
        <DesativarDisciplinaModal
          disciplina={desativarDisciplina}
          onClose={() => setDesativarDisciplina(null)}
          onDesativada={handleDesativada}
        />
      )}
    </div>
  )
}
