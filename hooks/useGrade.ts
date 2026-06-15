'use client'

import { useCallback, useState } from 'react'

export interface Alocacao {
  id: string
  turmaId: string
  disciplinaId: string
  professorId: string | null
  blocoId: string
  diaSemana: string
  online: boolean
  status: 'PENDENTE' | 'CONFIRMADA' | 'CONFLITO'
  turma: {
    id: string
    nome: string
    turno: string
    periodo: number
    curso: { id?: string; codigo?: string; nome: string }
    periodoLetivo: { id?: string; descricao: string; status?: string }
  }
  disciplina: { id: string; codigo?: string; nome: string; cargaHoraria: number }
  professor: {
    id: string
    usuario: { nome: string; email: string }
  } | null
  bloco: {
    id: string
    inicio: string
    fim: string
    turno: string
    ordem: number
  }
}

export interface ResultadoGeracao {
  alocadas: Array<{
    turmaId: string
    turmaNome: string
    disciplinaId: string
    disciplinaNome: string
    professorId: string
    professorNome: string
    blocoId: string
    blocoInicio: string
    blocoFim: string
    diaSemana: string
  }>
  pendencias: Array<{
    turmaId: string
    turmaNome: string
    disciplinaId: string
    disciplinaNome: string
    motivo: string
  }>
  conflitos: string[]
  resumo: {
    total: number
    alocadas: number
    pendentes: number
    taxaSucesso: number
  }
}

export function useGrade() {
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const buscarAlocacoes = useCallback(async (params: {
    turmaId?: string
    professorId?: string
    periodoLetivoId?: string
    diaSemana?: string
    status?: string
  }) => {
    setCarregando(true)
    setErro(null)

    try {
      const query = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.set(key, value)
      })

      const res = await fetch(`/api/alocacoes?${query.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao buscar alocacoes')

      setAlocacoes(data.alocacoes ?? [])
      return (data.alocacoes ?? []) as Alocacao[]
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido'
      setErro(mensagem)
      return []
    } finally {
      setCarregando(false)
    }
  }, [])

  const criarAlocacao = useCallback(async (dados: {
    turmaId: string
    disciplinaId: string
    professorId?: string | null
    blocoId: string
    diaSemana: string
    online?: boolean
  }) => {
    setErro(null)
    const res = await fetch('/api/alocacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erro ao criar alocacao')
    setAlocacoes((prev) => [...prev, data.alocacao])
    return data.alocacao as Alocacao
  }, [])

  const atualizarAlocacao = useCallback(async (
    id: string,
    dados: {
      professorId?: string | null
      blocoId?: string
      diaSemana?: string
      online?: boolean
      status?: 'PENDENTE' | 'CONFIRMADA' | 'CONFLITO'
      motivo?: string
    }
  ) => {
    setErro(null)
    const res = await fetch(`/api/alocacoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erro ao atualizar alocacao')
    setAlocacoes((prev) => prev.map((alocacao) => (alocacao.id === id ? data.alocacao : alocacao)))
    return data.alocacao as Alocacao
  }, [])

  const removerAlocacao = useCallback(async (id: string, motivo?: string) => {
    setErro(null)
    const res = await fetch(`/api/alocacoes/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'Erro ao remover alocacao')
    setAlocacoes((prev) => prev.filter((alocacao) => alocacao.id !== id))
  }, [])

  const gerarGrade = useCallback(async (params: {
    periodoLetivoId: string
    turmaIds?: string[]
    substituirExistentes?: boolean
  }): Promise<ResultadoGeracao> => {
    setGerando(true)
    setErro(null)

    try {
      const res = await fetch('/api/grade/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar grade')
      return data as ResultadoGeracao
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido'
      setErro(mensagem)
      throw error
    } finally {
      setGerando(false)
    }
  }, [])

  const simularAlocacao = useCallback(async (params: {
    alocacaoId?: string
    turmaId: string
    disciplinaId: string
    professorId: string
    blocoId: string
    diaSemana: string
  }): Promise<{ valido: boolean; erros: string[] }> => {
    const res = await fetch('/api/grade/simular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erro ao simular alocacao')
    return data
  }, [])

  return {
    alocacoes,
    carregando,
    gerando,
    erro,
    buscarAlocacoes,
    criarAlocacao,
    atualizarAlocacao,
    removerAlocacao,
    gerarGrade,
    simularAlocacao,
  }
}
