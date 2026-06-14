// components/turmas/DesativarTurmaModal.tsx
'use client'

import { useState } from 'react'
import type { Turma } from '@/hooks/useTurmas'

interface Props {
  open: boolean
  turma: Turma | null
  onClose: () => void
  onConfirm: (id: string, motivo: string) => Promise<void>
}

export function DesativarTurmaModal({ open, turma, onClose, onConfirm }: Props) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!open || !turma) return null

  const handleConfirmar = async () => {
    if (!motivo.trim()) { setErro('Informe o motivo da desativação'); return }
    setLoading(true)
    setErro(null)
    try {
      await onConfirm(turma.id, motivo)
      setMotivo('')
      onClose()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-[#ddd] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#333]">Desativar Turma</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#333] text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[#555]">
            Você está prestes a desativar a turma{' '}
            <strong className="text-[#333]">{turma.codigo}</strong>.
            Esta ação pode ser revertida posteriormente.
          </p>

          {turma._count && turma._count.alocacoes > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-xs text-yellow-800">
              ⚠️ Esta turma possui {turma._count.alocacoes} alocação(ões). O sistema verificará se alguma está ativa antes de desativar.
            </div>
          )}

          <div>
            <label className="block text-xs font-medium tracking-widest text-gray-500 uppercase mb-1.5">
              Motivo da desativação
            </label>
            <textarea
              rows={3}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Turma cancelada por falta de alunos..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] resize-none"
            />
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-800">
              {erro}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-[#ddd]">
            <button
              onClick={onClose}
              className="bg-white text-[#2e7d32] border border-[#2e7d32] px-5 py-2 rounded text-sm font-medium hover:bg-[#e8f5e9] transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={loading}
              className="bg-[#e53935] text-white px-5 py-2 rounded text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
            >
              {loading ? 'Desativando...' : 'Desativar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
