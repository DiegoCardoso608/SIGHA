'use client'

import { useEffect, useMemo, useState } from 'react'

interface DisciplinaOption {
  id: string
  nome: string
  cursos?: Array<{
    cursoId?: string
    disciplinaId?: string
    periodo?: number
  }>
}

interface ProfessorOption {
  id: string
  nome: string
  disciplinas?: Array<{
    disciplinaId?: string
  }>
}

interface BlocoOption {
  id: string
  inicio: string
  fim: string
}

interface AulaEditorValue {
  id?: string
  disciplinaId?: string
  professorId?: string | null
  blocoId?: string
  diaSemana?: string
  online?: boolean
  fixa?: boolean
}

interface AulaEditorModalProps {
  open: boolean
  mode: 'create' | 'edit'
  turmaId?: string
  alocacao?: AulaEditorValue | null
  onClose: () => void
  onCreate?: (dados: {
    turmaId: string
    disciplinaId: string
    professorId?: string | null
    blocoId: string
    diaSemana: string
    online?: boolean
    fixa?: boolean
  }) => Promise<unknown>
  onEdit?: (
    id: string,
    dados: {
      disciplinaId?: string
      professorId?: string | null
      blocoId?: string
      diaSemana?: string
      online?: boolean
    }
  ) => Promise<unknown>
  onDelete?: (id: string) => Promise<unknown>
  onFixar?: (id: string) => Promise<unknown>
  onDesfixar?: (id: string) => Promise<unknown>
}

const DIAS = [
  { key: 'SEGUNDA', label: 'Segunda' },
  { key: 'TERCA', label: 'Terça' },
  { key: 'QUARTA', label: 'Quarta' },
  { key: 'QUINTA', label: 'Quinta' },
  { key: 'SEXTA', label: 'Sexta' },
  { key: 'SABADO', label: 'Sábado' },
]

function normalizarLista(valor: unknown): unknown[] {
  if (Array.isArray(valor)) return valor
  if (valor && typeof valor === 'object') {
    const record = valor as Record<string, unknown>
    if (Array.isArray(record.data)) return record.data
    if (Array.isArray(record.items)) return record.items
    if (Array.isArray(record.results)) return record.results
    if (Array.isArray(record.disciplinas)) return record.disciplinas
    if (Array.isArray(record.professores)) return record.professores
    if (Array.isArray(record.blocos)) return record.blocos
    if (Array.isArray(record.turmas)) return record.turmas
  }
  return []
}

export function AulaEditorModal({
  open,
  mode,
  turmaId,
  alocacao,
  onClose,
  onCreate,
  onEdit,
  onDelete,
  onFixar,
  onDesfixar,
}: AulaEditorModalProps) {
  const [disciplinas, setDisciplinas] = useState<DisciplinaOption[]>([])
  const [professores, setProfessores] = useState<ProfessorOption[]>([])
  const [blocos, setBlocos] = useState<BlocoOption[]>([])
  const [turmaContexto, setTurmaContexto] = useState<{
    cursoId: string
    periodo: number
    disciplinasJaAlocadas: Set<string>
  } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [form, setForm] = useState({
    disciplinaId: alocacao?.disciplinaId ?? '',
    professorId: alocacao?.professorId ?? '',
    diaSemana: alocacao?.diaSemana ?? DIAS[0].key,
    blocoId: alocacao?.blocoId ?? '',
    online: alocacao?.online ?? false,
    fixa: alocacao?.fixa ?? false,
  })

  useEffect(() => {
    if (!open) return

    setForm({
      disciplinaId: alocacao?.disciplinaId ?? '',
      professorId: alocacao?.professorId ?? '',
      diaSemana: alocacao?.diaSemana ?? DIAS[0].key,
      blocoId: alocacao?.blocoId ?? '',
      online: alocacao?.online ?? false,
      fixa: alocacao?.fixa ?? false,
    })
  }, [open, alocacao])

  useEffect(() => {
    if (!open) return

    let cancelado = false

    async function carregar() {
      try {
        const respostas = await Promise.all([
          fetch('/api/disciplinas?status=ativo&limit=500'),
          fetch('/api/professores?ativo=true&porPagina=300'),
          fetch('/api/blocos'),
        ])

        const [resDisciplinas, resProfessores, resBlocos] = respostas
        const dataDisciplinas = await resDisciplinas.json()
        const dataProfessores = await resProfessores.json()
        const dataBlocos = await resBlocos.json()

        if (cancelado) return

        const disciplinasCarregadas = normalizarLista(dataDisciplinas)
          .map((item: any) => ({
            id: item.id,
            nome: item.nome ?? item.disciplina?.nome ?? item.codigo ?? item.id,
            cursos: Array.isArray(item.cursos) ? item.cursos : [],
          }))
          .filter((item) => item.id)

        const professoresCarregados = normalizarLista(dataProfessores)
          .map((item: any) => ({
            id: item.id,
            nome: item.usuario?.nome ?? item.nome ?? item.email ?? item.id,
            disciplinas: Array.isArray(item.disciplinas)
              ? item.disciplinas.map((vinculo: any) => ({
                  disciplinaId: vinculo?.disciplinaId ?? vinculo?.disciplina?.id,
                }))
              : [],
          }))
          .filter((item) => item.id)

        const blocosCarregados = normalizarLista(dataBlocos)
          .map((item: any) => ({
            id: item.id,
            inicio: item.inicio ?? item.horario?.inicio ?? '',
            fim: item.fim ?? item.horario?.fim ?? '',
          }))
          .filter((item) => item.id)

        let turmaContextoData: { cursoId: string; periodo: number; disciplinasJaAlocadas: Set<string> } | null = null
        if (turmaId) {
          const resTurma = await fetch(`/api/turmas/${turmaId}`)
          const dataTurma = await resTurma.json()
          if (!cancelado && dataTurma?.turma) {
            const turma = dataTurma.turma
            const disciplinasJaAlocadas = new Set<string>(
              Array.isArray(turma.alocacoes)
                ? turma.alocacoes
                    .map((alocacao: any) => alocacao?.disciplinaId)
                    .filter((value: unknown): value is string => typeof value === 'string')
                : []
            )

            turmaContextoData = {
              cursoId: turma.curso?.id ?? turma.cursoId,
              periodo: turma.periodo,
              disciplinasJaAlocadas,
            }
          }
        }

        if (!cancelado) {
          setDisciplinas(disciplinasCarregadas)
          setProfessores(professoresCarregados)
          setBlocos(blocosCarregados)
          setTurmaContexto(turmaContextoData)
        }
      } catch {
        if (!cancelado) {
          setDisciplinas([])
          setProfessores([])
          setBlocos([])
          setTurmaContexto(null)
        }
      }
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [open, turmaId])

  const disciplinasOrdenadas = useMemo(() => {
    const garantirSelecionada = (lista: DisciplinaOption[]) => {
      if (!form.disciplinaId) return lista
      const selecionada = disciplinas.find((disciplina) => disciplina.id === form.disciplinaId)
      if (!selecionada) return lista
      const jaExiste = lista.some((disciplina) => disciplina.id === selecionada.id)
      return jaExiste ? lista : [...lista, selecionada]
    }

    if (!turmaContexto?.cursoId || turmaContexto.periodo === undefined) {
      return {
        disciplinaDaTurma: [],
        outrasDisciplinas: garantirSelecionada(disciplinas),
      }
    }

    const disciplinaDaTurma = disciplinas.filter((disciplina) =>
      (disciplina.cursos ?? []).some(
        (cursoDisciplina) =>
          cursoDisciplina.cursoId === turmaContexto.cursoId &&
          cursoDisciplina.periodo === turmaContexto.periodo
      )
    )

    const outrasDisciplinas = disciplinas.filter(
      (disciplina) =>
        !disciplinaDaTurma.some((item) => item.id === disciplina.id)
    )

    return {
      disciplinaDaTurma: garantirSelecionada(disciplinaDaTurma),
      outrasDisciplinas: garantirSelecionada(outrasDisciplinas),
    }
  }, [disciplinas, form.disciplinaId, turmaContexto])

  const professoresOrdenados = useMemo(() => {
    const aptos = professores.filter((professor) =>
      professor.disciplinas?.some(
        (vinculo) => vinculo.disciplinaId === form.disciplinaId
      )
    )

    const outros = professores.filter(
      (professor) => !aptos.some((item) => item.id === professor.id)
    )

    const garantirSelecionado = (lista: ProfessorOption[]) => {
      if (!form.professorId) return lista
      const selecionado = professores.find((professor) => professor.id === form.professorId)
      if (!selecionado) return lista
      const jaExiste = lista.some((professor) => professor.id === selecionado.id)
      return jaExiste ? lista : [...lista, selecionado]
    }

    return {
      aptos: garantirSelecionado(aptos),
      outros: garantirSelecionado(outros),
    }
  }, [form.disciplinaId, form.professorId, professores])

  const podeSalvar = useMemo(
    () => Boolean(form.disciplinaId && form.blocoId && turmaId),
    [form.blocoId, form.disciplinaId, turmaId]
  )

  async function salvar() {
    if (!podeSalvar || salvando) return
    setErro(null)
    setSalvando(true)

    try {
      if (mode === 'create' && onCreate && turmaId) {
        await onCreate({
          turmaId,
          disciplinaId: form.disciplinaId,
          professorId: form.professorId || null,
          blocoId: form.blocoId,
          diaSemana: form.diaSemana,
          online: form.online,
          fixa: form.fixa,
        })
      } else if (mode === 'edit' && alocacao?.id && onEdit) {
        await onEdit(alocacao.id, {
          disciplinaId: form.disciplinaId,
          professorId: form.professorId || null,
          blocoId: form.blocoId,
          diaSemana: form.diaSemana,
          online: form.online,
        })
      }
      onClose()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar aula.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!alocacao?.id || !onDelete) return
    setErro(null)
    try {
      await onDelete(alocacao.id)
      onClose()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao excluir aula.')
    }
  }

  async function alternarFixacao() {
    if (!alocacao?.id) return
    setErro(null)
    try {
      if (alocacao.fixa) {
        await onDesfixar?.(alocacao.id)
      } else {
        await onFixar?.(alocacao.id)
      }
      onClose()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao ajustar fixação.')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#111827]">
            {mode === 'edit' ? 'Editar Aula' : 'Nova Aula'}
          </h3>
          <button type="button" onClick={onClose} className="text-[#6b7280] hover:text-[#111827]">
            ✕
          </button>
        </div>

        {erro && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {erro}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs text-[#374151]">
            Disciplina
            <select
              value={form.disciplinaId}
              onChange={(event) => setForm((prev) => ({ ...prev, disciplinaId: event.target.value }))}
              className="mt-1 w-full rounded border border-[#d1d5db] px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {disciplinasOrdenadas.disciplinaDaTurma.length > 0 && (
                <optgroup label="Disciplinas da Turma">
                  {disciplinasOrdenadas.disciplinaDaTurma.map((disciplina) => (
                    <option key={disciplina.id} value={disciplina.id}>
                      {disciplina.nome}
                    </option>
                  ))}
                </optgroup>
              )}
              {disciplinasOrdenadas.outrasDisciplinas.length > 0 && (
                <optgroup label="Outras Disciplinas">
                  {disciplinasOrdenadas.outrasDisciplinas.map((disciplina) => (
                    <option key={disciplina.id} value={disciplina.id}>
                      {disciplina.nome}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          <label className="text-xs text-[#374151]">
            Professor
            <select
              value={form.professorId}
              onChange={(event) => setForm((prev) => ({ ...prev, professorId: event.target.value }))}
              className="mt-1 w-full rounded border border-[#d1d5db] px-3 py-2 text-sm"
            >
              <option value="">Sem professor</option>
              {professoresOrdenados.aptos.length > 0 && (
                <optgroup label="Professores Aptos">
                  {professoresOrdenados.aptos.map((professor) => (
                    <option key={professor.id} value={professor.id}>
                      {professor.nome}
                    </option>
                  ))}
                </optgroup>
              )}
              {professoresOrdenados.outros.length > 0 && (
                <optgroup label="Outros Professores">
                  {professoresOrdenados.outros.map((professor) => (
                    <option key={professor.id} value={professor.id}>
                      {professor.nome}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          <label className="text-xs text-[#374151]">
            Dia
            <select
              value={form.diaSemana}
              onChange={(event) => setForm((prev) => ({ ...prev, diaSemana: event.target.value }))}
              className="mt-1 w-full rounded border border-[#d1d5db] px-3 py-2 text-sm"
            >
              {DIAS.map((dia) => (
                <option key={dia.key} value={dia.key}>
                  {dia.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-[#374151]">
            Horário
            <select
              value={form.blocoId}
              onChange={(event) => setForm((prev) => ({ ...prev, blocoId: event.target.value }))}
              className="mt-1 w-full rounded border border-[#d1d5db] px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {blocos.map((bloco) => (
                <option key={bloco.id} value={bloco.id}>
                  {bloco.inicio} - {bloco.fim}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#374151]">
            <input
              type="checkbox"
              checked={form.online}
              onChange={(event) => setForm((prev) => ({ ...prev, online: event.target.checked }))}
            />
            Online
          </label>
          <label className="flex items-center gap-2 text-xs text-[#374151]">
            <input
              type="checkbox"
              checked={form.fixa}
              onChange={(event) => setForm((prev) => ({ ...prev, fixa: event.target.checked }))}
            />
            Fixa
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {mode === 'edit' && onDelete && (
              <button
                type="button"
                onClick={excluir}
                className="rounded border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                Excluir Aula
              </button>
            )}
            {mode === 'edit' && (onFixar || onDesfixar) && (
              <button
                type="button"
                onClick={alternarFixacao}
                className="rounded border border-amber-300 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50"
              >
                {alocacao?.fixa ? 'Desfixar' : 'Fixar'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[#d1d5db] px-3 py-2 text-xs font-medium text-[#374151]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || !podeSalvar}
              className="rounded bg-[#2e7d32] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : mode === 'edit' ? 'Salvar' : 'Criar Aula'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
