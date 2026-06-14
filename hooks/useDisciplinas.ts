'use client'

// hooks/useDisciplinas.ts

import { useState, useEffect, useCallback, useRef } from 'react'

interface CursoDisciplina {
  cursoId: string
  periodo: number
  obrigatoria: boolean
  curso: { id: string; nome: string; codigo: string }
}

interface Professor {
  id: string
  nome: string
  titulacao: string
  ativo: boolean
}

export interface Disciplina {
  id: string
  codigo: string
  nome: string
  cargaHoraria: number
  ativo: boolean
  cursos: CursoDisciplina[]
  professores: { professor: Professor }[]
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface UseDisciplinasOptions {
  search?: string
  status?: 'todos' | 'ativo' | 'inativo'
  cursoId?: string
  page?: number
  limit?: number
}

export function useDisciplinas(options: UseDisciplinasOptions = {}) {
  const { search = '', status = 'todos', cursoId = '', page = 1, limit = 15 } = options

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Debounce para search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState(search)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const fetchDisciplinas = useCallback(async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (status !== 'todos') params.set('status', status)
    if (cursoId) params.set('cursoId', cursoId)
    params.set('page', String(page))
    params.set('limit', String(limit))

    try {
      const res = await fetch(`/api/disciplinas?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao buscar disciplinas')
      const data = await res.json()
      setDisciplinas(data.disciplinas)
      setPagination(data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, status, cursoId, page, limit])

  useEffect(() => {
    fetchDisciplinas()
  }, [fetchDisciplinas])

  return { disciplinas, pagination, loading, error, refresh: fetchDisciplinas }
}
