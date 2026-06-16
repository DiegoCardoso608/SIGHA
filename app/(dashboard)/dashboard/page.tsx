'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export default function DashboardPage() {
  const { session } = useAuth()
  const [professores, setProfessores] = useState<number | null>(null)
  const [disciplinas, setDisciplinas] = useState<number | null>(null)
  const [turmas, setTurmas] = useState<number | null>(null)
  const [alocacoes, setAlocacoes] = useState<number | null>(null)

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [profRes, discRes, turmaRes, alocRes] = await Promise.all([
          fetch('/api/professores?porPagina=1'),
          fetch('/api/disciplinas?limit=1'),
          fetch('/api/turmas?limit=1'),
          fetch('/api/alocacoes'),
        ])

        if (profRes.ok) {
          const p = await profRes.json()
          setProfessores(p.meta?.total ?? p.data?.length ?? null)
        }

        if (discRes.ok) {
          const d = await discRes.json()
          setDisciplinas(d.pagination?.total ?? d.disciplinas?.length ?? null)
        }

        if (turmaRes.ok) {
          const t = await turmaRes.json()
          setTurmas(t.pagination?.total ?? t.turmas?.length ?? null)
        }

        if (alocRes.ok) {
          const a = await alocRes.json()
          setAlocacoes(a.alocacoes?.length ?? null)
        }
      } catch (err) {
        console.error('Erro ao buscar contadores do dashboard', err)
      }
    }

    fetchCounts()
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Bem-vindo, {session?.user?.name}!
        </h1>
        <p className="text-gray-900 mt-2">Sistema de Gestão e Horários Acadêmicos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-700 text-sm font-medium">Professores</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">{professores ?? '—'}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-700 text-sm font-medium">Disciplinas</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">{disciplinas ?? '—'}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-700 text-sm font-medium">Turmas</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">{turmas ?? '—'}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-700 text-sm font-medium">Alocações</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">{alocacoes ?? '—'}</p>
        </div>
      </div>
    </div>
  )
}
