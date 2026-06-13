'use client'

import { useState, useEffect, useCallback } from 'react'

export type Disponibilidade = {
  diaSemana: 'SEGUNDA' | 'TERCA' | 'QUARTA' | 'QUINTA' | 'SEXTA' | 'SABADO'
  turno: 'MANHA' | 'TARDE' | 'NOITE'
}

export type Disciplina = {
  id: string
  nome: string
  codigo: string
}

export type Professor = {
  id: string
  nome: string
  email: string
  matricula: string
  titulacao: string
  cargaHorariaMax: number
  ativo: boolean
  criadoEm: string
  disciplinas: { disciplina: Disciplina }[]
  disponibilidades: Disponibilidade[]
  _count?: { alocacoes: number }
}

export type ProfessorPayload = {
  nome: string
  email: string
  matricula: string
  titulacao: string
  cargaHorariaMax: number
  senha?: string
  disciplinaIds?: string[]
  disponibilidades?: Disponibilidade[]
}

type Meta = {
  total: number
  pagina: number
  limite: number
  totalPaginas: number
}

export function useProfessores() {
  const [professores, setProfessores] = useState<Professor[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, pagina: 1, limite: 20, totalPaginas: 0 })
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const params = new URLSearchParams({ busca, pagina: String(pagina), limite: '20' })
      const res = await fetch(`/api/professores?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar professores')
      const json = await res.json()
      setProfessores(json.data)
      setMeta(json.meta)
    } catch (e) {
      setErro('Não foi possível carregar os professores.')
    } finally {
      setLoading(false)
    }
  }, [busca, pagina])

  useEffect(() => {
    const timeout = setTimeout(carregar, 300)
    return () => clearTimeout(timeout)
  }, [carregar])

  async function criar(dados: ProfessorPayload): Promise<{ ok: boolean; erro?: string }> {
    try {
      const res = await fetch('/api/professores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      })
      const json = await res.json()
      if (!res.ok) return { ok: false, erro: json.error || 'Erro ao criar professor' }
      await carregar()
      return { ok: true }
    } catch {
      return { ok: false, erro: 'Erro de conexão' }
    }
  }

  async function atualizar(id: string, dados: Partial<ProfessorPayload>): Promise<{ ok: boolean; erro?: string }> {
    try {
      const res = await fetch(`/api/professores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      })
      const json = await res.json()
      if (!res.ok) return { ok: false, erro: json.error || 'Erro ao atualizar professor' }
      await carregar()
      return { ok: true }
    } catch {
      return { ok: false, erro: 'Erro de conexão' }
    }
  }

  async function desativar(id: string): Promise<{ ok: boolean; erro?: string }> {
    try {
      const res = await fetch(`/api/professores/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) return { ok: false, erro: json.error || 'Erro ao desativar professor' }
      await carregar()
      return { ok: true }
    } catch {
      return { ok: false, erro: 'Erro de conexão' }
    }
  }

  return {
    professores,
    meta,
    loading,
    erro,
    busca,
    setBusca,
    pagina,
    setPagina,
    carregar,
    criar,
    atualizar,
    desativar,
  }
}
