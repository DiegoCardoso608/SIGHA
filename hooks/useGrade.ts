'use client'

import { useCallback, useState } from 'react'
import type { ResultadoGradeCurso } from '@/lib/algoritmo'

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

// ─── Estado expandido com suporte a consulta persistente (Sprint 5.6 A) ───────

interface UseGradeState {
  resultado: ResultadoGradeCurso | null
  turmasExpandidas: Record<string, boolean>
}

export function useGrade() {
  // ─── Estado legado para gerenciamento de alocações individuais ─────────────
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // ─── Estado novo para consulta persistente (Sprint 5.6 A) ──────────────────
  const [gradeState, setGradeState] = useState<UseGradeState>({
    resultado: null,
    turmasExpandidas: {},
  })

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

  const gerarGradeCurso = useCallback(async (params: {
    cursoId: string
    periodoLetivoId: string
    substituirExistentes?: boolean
  }): Promise<ResultadoGradeCurso> => {
    setGerando(true)
    setErro(null)

    try {
      const res = await fetch('/api/grade/gerar-curso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar grade do curso')

      const resultado = data as ResultadoGradeCurso
      const expandidas: Record<string, boolean> = {}
      for (const rt of resultado.turmas ?? []) {
        expandidas[rt.turma.id] = true
      }

      setGradeState({
        resultado,
        turmasExpandidas: expandidas,
      })

      return resultado
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

  // ─── Novos métodos para consulta persistente (Sprint 5.6 A) ────────────────

  /**
   * Carrega uma grade já existente no banco (GET /api/grade/consultar)
   * Sem necessidade de gerar novamente
   */
  const carregarGrade = useCallback(
    async (
      cursoId: string,
      periodoLetivoId: string
    ): Promise<ResultadoGradeCurso | null> => {
      if (!cursoId || !periodoLetivoId) return null

      setGerando(true)
      setErro(null)

      try {
        const params = new URLSearchParams({ cursoId, periodoLetivoId })
        const response = await fetch(`/api/grade/consultar?${params.toString()}`)
        const data = await response.json()

        if (!response.ok) {
          // 404 significa "sem grade" — não é erro crítico
          if (response.status === 404) {
            setGradeState({ resultado: null, turmasExpandidas: {} })
            return null
          }
          setErro(data.error ?? 'Erro ao carregar grade')
          return null
        }

        // Todas as turmas iniciam expandidas
        const expandidas: Record<string, boolean> = {}
        for (const rt of data.turmas ?? []) {
          expandidas[rt.turma.id] = true
        }

        setGradeState({
          resultado: data as ResultadoGradeCurso,
          turmasExpandidas: expandidas,
        })
        return data as ResultadoGradeCurso
      } catch {
        setErro('Falha na comunicação com o servidor')
        return null
      } finally {
        setGerando(false)
      }
    },
    []
  )

  /**
   * Toggle de expansão individual de uma turma
   */
  const toggleTurma = useCallback((turmaId: string) => {
    setGradeState((prev) => ({
      ...prev,
      turmasExpandidas: {
        ...prev.turmasExpandidas,
        [turmaId]: !prev.turmasExpandidas[turmaId],
      },
    }))
  }, [])

  /**
   * Expandir ou recolher todas as turmas
   */
  const expandirTodas = useCallback((expandir: boolean) => {
    setGradeState((prev) => {
      if (!prev.resultado) return prev
      const expandidas: Record<string, boolean> = {}
      for (const rt of prev.resultado.turmas) {
        expandidas[rt.turma.id] = expandir
      }
      return { ...prev, turmasExpandidas: expandidas }
    })
  }, [])

  /**
   * Limpar estado de grade
   */
  const limparGrade = useCallback(() => {
    setGradeState({ resultado: null, turmasExpandidas: {} })
    setErro(null)
  }, [])

  return {
    // ─── Legado (compatibilidade com Sprint 5 e 5.5) ────────────────────────
    alocacoes,
    carregando,
    gerando,
    erro,
    buscarAlocacoes,
    criarAlocacao,
    atualizarAlocacao,
    removerAlocacao,
    gerarGrade,
    gerarGradeCurso,
    simularAlocacao,

    // ─── Sprint 5.6 A (Consulta persistente) ───────────────────────────────
    resultado: gradeState.resultado,
    turmasExpandidas: gradeState.turmasExpandidas,
    carregarGrade,
    toggleTurma,
    expandirTodas,
    limparGrade,
  }
}
