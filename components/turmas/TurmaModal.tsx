// components/turmas/TurmaModal.tsx
'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Turma, Turno } from '@/hooks/useTurmas'
import type { PeriodoLetivo } from '@/hooks/usePeriodosLetivos'

const schema = z.object({
  codigo: z.string().min(3, 'Mínimo 3 caracteres').max(30),
  nome: z.string().min(3, 'Mínimo 3 caracteres').max(100),
  cursoId: z.string().min(1, 'Selecione um curso'),
  periodoLetivoId: z.string().min(1, 'Selecione um período letivo'),
  periodo: z.coerce.number().int().min(1).max(10),
  turno: z.enum(['MANHA', 'TARDE', 'NOITE']),
})

type FormInput = z.input<typeof schema>
type FormData = z.output<typeof schema>

interface Curso {
  id: string
  nome: string
  codigo: string
  totalPeriodos: number
}

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
  turma?: Turma | null
  cursos: Curso[]
  periodosLetivos: PeriodoLetivo[]
}

const TURNO_LABELS: Record<Turno, string> = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
}

// Valida regra ímpar/par retornando mensagem de erro ou null
function validarPeriodoSemestre(periodo: number, semestre: number): string | null {
  const isImpar = periodo % 2 !== 0
  if (semestre === 1 && !isImpar)
    return `${periodo}º período é par — só pode ser ofertado no semestre .2`
  if (semestre === 2 && isImpar)
    return `${periodo}º período é ímpar — só pode ser ofertado no semestre .1`
  return null
}

export function TurmaModal({ open, onClose, onSubmit, turma, cursos, periodosLetivos }: Props) {
  const [loading, setLoading] = useState(false)
  const [erroRegra, setErroRegra] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormInput, any, FormData>({ resolver: zodResolver(schema) })

  const isEdit = !!turma

  // Observa campos para validação em tempo real
  const periodoLetivoId = watch('periodoLetivoId')
  const periodoMatriz = watch('periodo')
  const cursoId = watch('cursoId')

  // Valida regra ímpar/par em tempo real
  useEffect(() => {
    if (!periodoLetivoId || !periodoMatriz) { setErroRegra(null); return }
    const pl = periodosLetivos.find(p => p.id === periodoLetivoId)
    if (!pl) { setErroRegra(null); return }
    setErroRegra(validarPeriodoSemestre(Number(periodoMatriz), pl.semestre))
  }, [periodoLetivoId, periodoMatriz, periodosLetivos])

  // Gera código automaticamente
  const periodoLetivoSelecionado = periodosLetivos.find(p => p.id === periodoLetivoId)
  const cursoSelecionado = cursos.find(c => c.id === cursoId)

  useEffect(() => {
    if (open) {
      if (turma) {
        reset({
          codigo: turma.codigo,
          nome: turma.nome,
          cursoId: turma.cursoId,
          periodoLetivoId: turma.periodoLetivoId,
          periodo: turma.periodo,
          turno: turma.turno,
        })
      } else {
        reset({ codigo: '', nome: '', cursoId: '', periodoLetivoId: '', periodo: undefined, turno: 'NOITE' })
      }
      setErroRegra(null)
    }
  }, [open, turma, reset])

  // Sugestão de código automático
  const codigoSugerido =
    cursoSelecionado && periodoLetivoSelecionado && periodoMatriz
      ? `${cursoSelecionado.codigo}-${periodoLetivoSelecionado.descricao}-${periodoMatriz}A`
      : ''

  const handleFormSubmit = async (data: FormData) => {
    if (erroRegra) return
    setLoading(true)
    try {
      await onSubmit(data)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ddd]">
          <h2 className="text-base font-semibold text-[#333]">
            {isEdit ? 'Editar Turma' : 'Nova Turma'}
          </h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="px-6 py-5 space-y-5">

          {/* Período Letivo */}
          <div>
            <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">
              Período Letivo
            </label>
            <select
              {...register('periodoLetivoId')}
              disabled={isEdit}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Selecione...</option>
              {periodosLetivos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.descricao} — {p.status === 'ATIVO' ? 'Ativo' : p.status === 'PLANEJAMENTO' ? 'Planejamento' : 'Finalizado'}
                </option>
              ))}
            </select>
            {errors.periodoLetivoId && (
              <p className="text-red-600 text-xs mt-1">{errors.periodoLetivoId.message}</p>
            )}
          </div>

          {/* Curso */}
          <div>
            <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">
              Curso
            </label>
            <select
              {...register('cursoId')}
              disabled={isEdit}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Selecione...</option>
              {cursos.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {errors.cursoId && <p className="text-red-600 text-xs mt-1">{errors.cursoId.message}</p>}
          </div>

          {/* Período da Matriz + Turno */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">
                Período da Matriz
              </label>
              <input
                type="number"
                min={1}
                max={10}
                {...register('periodo')}
                disabled={isEdit}
                placeholder="ex: 7"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] disabled:bg-gray-50 disabled:text-gray-400"
              />
              {errors.periodo && <p className="text-red-600 text-xs mt-1">{errors.periodo.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">
                Turno
              </label>
              <select
                {...register('turno')}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white"
              >
                {(Object.keys(TURNO_LABELS) as Turno[]).map(t => (
                  <option key={t} value={t}>{TURNO_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Alerta de regra ímpar/par */}
          {erroRegra && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-800 flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>{erroRegra}</span>
            </div>
          )}

          {/* Código */}
          <div>
            <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">
              Código da Turma
            </label>
            <input
              {...register('codigo')}
              placeholder={codigoSugerido || 'ex: CC-2026.1-7A'}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32]"
            />
            {codigoSugerido && !watch('codigo') && (
              <p className="text-xs text-[#888] mt-1">Sugestão: <strong>{codigoSugerido}</strong></p>
            )}
            {errors.codigo && <p className="text-red-600 text-xs mt-1">{errors.codigo.message}</p>}
          </div>

          {/* Nome */}
          <div>
            <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">
              Nome da Turma
            </label>
            <input
              {...register('nome')}
              placeholder="ex: Ciência da Computação — 7º Período A"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32]"
            />
            {errors.nome && <p className="text-red-600 text-xs mt-1">{errors.nome.message}</p>}
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-2 border-t border-[#ddd]">
            <button
              type="button"
              onClick={onClose}
              className="bg-white text-[#2e7d32] border border-[#2e7d32] px-5 py-2 rounded text-sm font-medium hover:bg-[#e8f5e9] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !!erroRegra}
              className="bg-[#2e7d32] text-white px-5 py-2 rounded text-sm font-medium hover:bg-[#1a5c1a] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Turma'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
