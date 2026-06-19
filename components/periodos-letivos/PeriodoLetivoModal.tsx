// components/periodos-letivos/PeriodoLetivoModal.tsx
'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { PeriodoLetivo } from '@/hooks/usePeriodosLetivos'

const schema = z.object({
  ano: z.coerce.number().int().min(2024).max(2099),
  semestre: z.coerce.number().int().min(1).max(2),
  dataInicio: z.string().min(1, 'Obrigatório'),
  dataFim: z.string().min(1, 'Obrigatório'),
  status: z.enum(['PLANEJAMENTO', 'ATIVO', 'FINALIZADO']).optional(),
})

type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
  periodo?: PeriodoLetivo | null
  onDelete?: (id: string) => Promise<void>
  onChangeStatus?: (id: string, status: FormData['status']) => Promise<void>
}

const STATUS_LABELS = { PLANEJAMENTO: 'Planejamento', ATIVO: 'Ativo', FINALIZADO: 'Finalizado' }

export function PeriodoLetivoModal({ open, onClose, onSubmit, periodo, onDelete, onChangeStatus }: Props) {
  const [loading, setLoading] = useState(false)
  const isEdit = !!periodo

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormInput, any, FormData>({
    resolver: zodResolver(schema),
    defaultValues: { semestre: 1, status: 'PLANEJAMENTO' },
  })

  const ano = watch('ano')
  const semestre = watch('semestre')
  const preview = ano && semestre ? `${ano}.${semestre}` : '—'

  useEffect(() => {
    if (open) {
      if (periodo) {
        reset({
          ano: periodo.ano,
          semestre: periodo.semestre,
          dataInicio: periodo.dataInicio.split('T')[0],
          dataFim: periodo.dataFim.split('T')[0],
          status: periodo.status,
        })
      } else {
        reset({ ano: new Date().getFullYear(), semestre: 1, dataInicio: '', dataFim: '', status: 'PLANEJAMENTO' })
      }
    }
  }, [open, periodo, reset])

  const handleStatusChange = async (nextStatus: FormData['status']) => {
    if (!periodo) return

    setLoading(true)
    try {
      if (onChangeStatus) {
        await onChangeStatus(periodo.id, nextStatus)
        return
      }

      await onSubmit({
        ano: periodo.ano,
        semestre: periodo.semestre,
        dataInicio: periodo.dataInicio,
        dataFim: periodo.dataFim,
        status: nextStatus,
      } as unknown as FormData)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!periodo) return

    setLoading(true)
    try {
      if (onDelete) {
        await onDelete(periodo.id)
        return
      }

      const res = await fetch(`/api/periodos-letivos/${periodo.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao excluir período')
      onClose()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFormSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await onSubmit({
        ...data,
        dataInicio: new Date(data.dataInicio).toISOString(),
        dataFim: new Date(data.dataFim).toISOString(),
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ddd]">
          <h2 className="text-base font-semibold text-[#333]">
            {isEdit ? 'Editar Período Letivo' : 'Novo Período Letivo'}
          </h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="px-6 py-5 space-y-4">

          {/* Preview */}
          <div className="bg-[#e8f5e9] border border-[#a5d6a7] rounded px-4 py-2 text-center">
            <span className="text-xs text-[#1b5e20] uppercase tracking-wider font-medium">Período</span>
            <div className="text-2xl font-bold text-[#2e7d32]">{preview}</div>
          </div>

          {/* Ano + Semestre */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">Ano</label>
              <input
                type="number"
                {...register('ano')}
                disabled={isEdit}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] disabled:bg-gray-50"
              />
              {errors.ano && <p className="text-red-600 text-xs mt-1">{errors.ano.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">Semestre</label>
              <select
                {...register('semestre')}
                disabled={isEdit}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white disabled:bg-gray-50"
              >
                <option value={1}>1º Semestre (.1) — períodos ímpares</option>
                <option value={2}>2º Semestre (.2) — períodos pares</option>
              </select>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">Início</label>
              <input
                type="date"
                {...register('dataInicio')}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32]"
              />
              {errors.dataInicio && <p className="text-red-600 text-xs mt-1">{errors.dataInicio.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">Fim</label>
              <input
                type="date"
                {...register('dataFim')}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32]"
              />
              {errors.dataFim && <p className="text-red-600 text-xs mt-1">{errors.dataFim.message}</p>}
            </div>
          </div>

          {/* Status (só aparece na edição) */}
          {isEdit && (
            <div>
              <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">Status</label>
              <select
                {...register('status')}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white"
              >
                {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-between items-center gap-3 pt-2 border-t border-[#ddd]">
            <div className="flex items-center gap-2">
              {isEdit && periodo && (
                <>
                  {periodo.status === 'FINALIZADO' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Reativar período ${periodo.descricao}?`)) return
                        await handleStatusChange('ATIVO')
                      }}
                      className="text-xs text-[#2e7d32] hover:underline"
                    >
                      Reativar
                    </button>
                  )}
                  {periodo.status !== 'PLANEJAMENTO' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Retornar ${periodo.descricao} para PLANEJAMENTO?`)) return
                        await handleStatusChange('PLANEJAMENTO')
                      }}
                      className="text-xs text-[#6b7280] hover:underline"
                    >
                      Retornar para Planejamento
                    </button>
                  )}
                  <button type="button" onClick={async () => {
                    if (!confirm(`Excluir o período ${periodo.descricao}?`)) return
                    await handleDelete()
                  }} className="text-xs text-[#e53935] hover:underline">Excluir</button>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose}
                className="bg-white text-[#2e7d32] border border-[#2e7d32] px-5 py-2 rounded text-sm font-medium hover:bg-[#e8f5e9] transition">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="bg-[#2e7d32] text-white px-5 py-2 rounded text-sm font-medium hover:bg-[#1a5c1a] transition disabled:opacity-50">
                {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Período'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
