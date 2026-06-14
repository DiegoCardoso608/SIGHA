// hooks/useTurmas.ts
'use client'

import { useState, useEffect, useCallback } from 'react'

export type Turno = 'MANHA' | 'TARDE' | 'NOITE'

export interface Turma {
  id: string
  codigo: string
  nome: string
  cursoId: string
  periodoLetivoId: string
  periodo: number
  turno: Turno
  ativo: boolean
  curso: { id: string; nome: string; codigo: string }
  periodoLetivo: { id: string; descricao: string; status: string }
  _count?: { alocacoes: number }
}

export interface TurmaFiltros {
  busca?: string
  cursoId?: string
  periodoLetivoId?: string
  turno?: string
  periodo?: string
  ativo?: string
  page?: number
}

interface CreateTurmaData {
  codigo: string
  nome: string
  cursoId: string
  periodoLetivoId: string
  periodo: number
  turno: Turno
}

export function useTurmas(filtros: TurmaFiltros = {}) {
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTurmas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros.busca) params.set('busca', filtros.busca)
      if (filtros.cursoId) params.set('cursoId', filtros.cursoId)
      if (filtros.periodoLetivoId) params.set('periodoLetivoId', filtros.periodoLetivoId)
      if (filtros.turno) params.set('turno', filtros.turno)
      if (filtros.periodo) params.set('periodo', filtros.periodo)
      if (filtros.ativo !== undefined) params.set('ativo', filtros.ativo)
      if (filtros.page) params.set('page', String(filtros.page))

      const res = await fetch(`/api/turmas?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar turmas')
      const data = await res.json()
      setTurmas(data.turmas)
      setTotal(data.pagination.total)
      setTotalPages(data.pagination.totalPages)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filtros)])

  useEffect(() => {
    fetchTurmas()
  }, [fetchTurmas])

  const createTurma = async (data: CreateTurmaData) => {
    const res = await fetch('/api/turmas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro ao criar turma')
    await fetchTurmas()
    return json.turma as Turma
  }

  const updateTurma = async (id: string, data: { nome?: string; turno?: Turno; ativo?: boolean; motivo?: string }) => {
    const res = await fetch(`/api/turmas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar turma')
    await fetchTurmas()
    return json.turma as Turma
  }

  const deleteTurma = async (id: string) => {
    const res = await fetch(`/api/turmas/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro ao excluir turma')
    await fetchTurmas()
  }

  return { turmas, total, totalPages, loading, error, refetch: fetchTurmas, createTurma, updateTurma, deleteTurma }
}
