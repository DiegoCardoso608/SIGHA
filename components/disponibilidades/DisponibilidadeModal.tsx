'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DisponibilidadeBlocoItem, ProfessorResumoDTO } from '@/types/disponibilidades'
import { useDisponibilidadeProfessor } from '@/hooks/useDisponibilidades'
import { GradeDisponibilidade } from './GradeDisponibilidade'

type Props = {
  open: boolean
  professor: ProfessorResumoDTO | null
  onClose: () => void
  onSaved: () => void
}

export function DisponibilidadeModal({ open, professor, onClose, onSaved }: Props) {
  const { data, loading, error, salvar } = useDisponibilidadeProfessor(open ? professor?.id : null)
  const [grade, setGrade] = useState<DisponibilidadeBlocoItem[]>([])
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (data?.grade) setGrade(data.grade)
  }, [data])

  const total = useMemo(() => grade.filter((item) => item.disponivel).length, [grade])

  function toggle(diaSemana: DisponibilidadeBlocoItem['diaSemana'], blocoId: string) {
    setGrade((atual) =>
      atual.map((item) =>
        item.diaSemana === diaSemana && item.blocoId === blocoId
          ? { ...item, disponivel: !item.disponivel }
          : item
      )
    )
  }

  async function handleSubmit() {
    setSaving(true)
    setServerError(null)
    try {
      await salvar({ disponibilidades: grade, motivo: 'Atualizacao pela tela de disponibilidades' })
      onSaved()
      onClose()
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Erro ao salvar disponibilidade')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !professor) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#ddd] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#333]">Editar disponibilidade</h2>
            <p className="mt-0.5 text-sm text-gray-500">{professor.nome}</p>
          </div>
          <button onClick={onClose} className="text-xl leading-none text-[#888] hover:text-[#333]">
            x
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {(error || serverError) && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
              {serverError ?? error}
            </div>
          )}

          {loading || !data ? (
            <div className="py-12 text-center text-sm text-gray-400">Carregando disponibilidade...</div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span className="rounded border border-[#a5d6a7] bg-[#e8f5e9] px-3 py-1 text-xs text-[#1b5e20]">
                  {professor.tipo}
                </span>
                <span>{total} blocos disponiveis</span>
              </div>
              <GradeDisponibilidade blocos={data.blocos} grade={grade} onToggle={toggle} />
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#ddd] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[#2e7d32] bg-white px-5 py-2 text-sm font-medium text-[#2e7d32] transition hover:bg-[#e8f5e9]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSubmit}
            className="rounded bg-[#2e7d32] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#1a5c1a] disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </div>
      </div>
    </div>
  )
}
