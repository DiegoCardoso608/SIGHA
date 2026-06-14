'use client'

import { useEffect, useState } from 'react'
import { CoberturaPanel } from '@/components/disponibilidades/CoberturaPanel'
import { DisponibilidadeModal } from '@/components/disponibilidades/DisponibilidadeModal'
import type { ProfessorResumoDTO } from '@/types/disponibilidades'

type ProfessorListItem = {
  id: string
  titulacao: ProfessorResumoDTO['titulacao']
  tipo: ProfessorResumoDTO['tipo']
  cargaHorariaMax: number
  ativo: boolean
  usuario: { nome: string; email: string; matricula?: string | null }
  disponibilidadesBloco?: unknown[]
}

const TIPO_LABEL = {
  TITULAR: 'Titular',
  SUBSTITUTO: 'Substituto',
  RESERVA: 'Reserva',
}

export default function DisponibilidadesPage() {
  const [professores, setProfessores] = useState<ProfessorListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [professorSelecionado, setProfessorSelecionado] = useState<ProfessorResumoDTO | null>(null)

  async function carregar() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ porPagina: '50', ativo: 'true' })
      if (busca) params.set('busca', busca)
      const res = await fetch(`/api/professores?${params}`)
      const json = await res.json()
      if (res.ok) setProfessores(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(carregar, 300)
    return () => clearTimeout(timeout)
  }, [busca])

  function toResumo(professor: ProfessorListItem): ProfessorResumoDTO {
    return {
      id: professor.id,
      nome: professor.usuario.nome,
      titulacao: professor.titulacao,
      tipo: professor.tipo,
      cargaHorariaMax: professor.cargaHorariaMax,
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <p className="mb-1 text-sm text-gray-500">
          Dashboard <span className="mx-1 text-gray-400">&gt;</span>
          <span className="text-gray-800">Disponibilidades</span>
        </p>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Disponibilidades</h1>
            <p className="mt-1 text-sm text-gray-500">Grade por bloco e cobertura institucional</p>
          </div>
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar professor..."
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#2e7d32] focus:outline-none sm:w-72"
          />
        </div>

        <div className="mb-6">
          <CoberturaPanel />
        </div>

        <div className="rounded-lg border border-[#ddd] bg-white">
          <div className="flex items-center justify-between border-b border-[#ddd] px-5 py-3">
            <span className="text-xs font-medium uppercase tracking-widest text-gray-500">
              {loading ? 'Carregando...' : `${professores.length} professor(es)`}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Carregando professores...</div>
          ) : professores.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">Nenhum professor encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#ddd] bg-gray-50">
                    {['Professor', 'Tipo', 'Titulacao', 'CH max.', 'Status', ''].map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-gray-500">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {professores.map((professor) => (
                    <tr key={professor.id} className="border-b border-[#eee] hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#333]">{professor.usuario.nome}</p>
                        <p className="text-xs text-gray-500">{professor.usuario.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{TIPO_LABEL[professor.tipo]}</td>
                      <td className="px-4 py-3 text-gray-700">{professor.titulacao}</td>
                      <td className="px-4 py-3 text-gray-700">{professor.cargaHorariaMax}h</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-[#a5d6a7] bg-[#e8f5e9] px-3 py-0.5 text-xs text-[#1b5e20]">
                          Ativo
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setProfessorSelecionado(toResumo(professor))}
                          className="rounded border border-[#2e7d32] px-3 py-1.5 text-xs font-medium text-[#2e7d32] transition hover:bg-[#e8f5e9]"
                        >
                          Editar grade
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DisponibilidadeModal
        open={!!professorSelecionado}
        professor={professorSelecionado}
        onClose={() => setProfessorSelecionado(null)}
        onSaved={carregar}
      />
    </div>
  )
}
