'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  AtualizarDisponibilidadeBody,
  AtualizarDisponibilidadeResponse,
  CoberturaResponseDTO,
  ProfessorDisponibilidadeDTO,
} from '@/types/disponibilidades'

export function useDisponibilidadeProfessor(professorId?: string | null) {
  const [data, setData] = useState<ProfessorDisponibilidadeDTO | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!professorId) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/professores/${professorId}/disponibilidade`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar disponibilidade')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar disponibilidade')
    } finally {
      setLoading(false)
    }
  }, [professorId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const salvar = useCallback(
    async (body: AtualizarDisponibilidadeBody): Promise<AtualizarDisponibilidadeResponse> => {
      if (!professorId) throw new Error('Professor nao informado')
      const res = await fetch(`/api/professores/${professorId}/disponibilidade`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar disponibilidade')
      await carregar()
      return json
    },
    [carregar, professorId]
  )

  return { data, loading, error, carregar, salvar }
}

export function useCobertura(periodoLetivoId?: string, cursoId?: string) {
  const [data, setData] = useState<CoberturaResponseDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (periodoLetivoId) params.set('periodoLetivoId', periodoLetivoId)
      if (cursoId) params.set('cursoId', cursoId)
      const res = await fetch(`/api/cobertura?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar cobertura')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar cobertura')
    } finally {
      setLoading(false)
    }
  }, [cursoId, periodoLetivoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { data, loading, error, carregar }
}
