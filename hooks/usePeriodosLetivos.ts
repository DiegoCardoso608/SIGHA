// hooks/usePeriodosLetivos.ts
'use client'

import { useState, useEffect, useCallback } from 'react'

export type StatusPeriodoLetivo = 'PLANEJAMENTO' | 'ATIVO' | 'FINALIZADO'

export interface PeriodoLetivo {
  id: string
  ano: number
  semestre: number
  descricao: string
  dataInicio: string
  dataFim: string
  status: StatusPeriodoLetivo
  criadoEm: string
  _count?: { turmas: number }
}

interface CreatePeriodoData {
  ano: number
  semestre: number
  dataInicio: string
  dataFim: string
  status?: StatusPeriodoLetivo
}

export function usePeriodosLetivos(filtros?: { status?: string; ano?: string }) {
  const [periodos, setPeriodos] = useState<PeriodoLetivo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPeriodos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filtros?.status) params.set('status', filtros.status)
      if (filtros?.ano) params.set('ano', filtros.ano)

      const res = await fetch(`/api/periodos-letivos?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar períodos letivos')
      const data = await res.json()
      setPeriodos(data.periodos)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filtros?.status, filtros?.ano])

  useEffect(() => {
    fetchPeriodos()
  }, [fetchPeriodos])

  const createPeriodo = async (data: CreatePeriodoData) => {
    const res = await fetch('/api/periodos-letivos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro ao criar período')
    await fetchPeriodos()
    return json.periodo as PeriodoLetivo
  }

  const updatePeriodo = async (id: string, data: Partial<Pick<PeriodoLetivo, 'dataInicio' | 'dataFim' | 'status'>>) => {
    const res = await fetch(`/api/periodos-letivos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar período')
    await fetchPeriodos()
    return json.periodo as PeriodoLetivo
  }

  const deletePeriodo = async (id: string) => {
    const res = await fetch(`/api/periodos-letivos/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro ao excluir período')
    await fetchPeriodos()
  }

  return { periodos, loading, error, refetch: fetchPeriodos, createPeriodo, updatePeriodo, deletePeriodo }
}
