'use client'

// components/disciplinas/DesativarDisciplinaModal.tsx

import { useState } from 'react'

interface Disciplina {
  id: string
  nome: string
  codigo: string
}

interface Props {
  disciplina: Disciplina
  onClose: () => void
  onDesativada: () => void
}

export default function DesativarDisciplinaModal({ disciplina, onClose, onDesativada }: Props) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDesativar() {
    if (motivo.trim().length < 5) {
      setError('Informe um motivo com pelo menos 5 caracteres.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/disciplinas/${disciplina.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: false, motivo }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Erro ao desativar disciplina.')
        return
      }

      onDesativada()
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg w-full max-w-md shadow-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[#333]">Desativar Disciplina</h2>

        <p className="text-sm text-gray-600">
          Você está desativando a disciplina{' '}
          <span className="font-medium text-[#333]">{disciplina.nome}</span>{' '}
          <span className="text-gray-400">({disciplina.codigo})</span>.
          Esta ação não apaga os dados, apenas a inativa.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded px-3 py-2">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Motivo <span className="text-red-500">*</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ex: Disciplina removida da matriz curricular 2026.2"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white resize-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-white text-[#2e7d32] border border-[#2e7d32] px-5 py-2 rounded text-sm font-medium hover:bg-[#e8f5e9] transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDesativar}
            disabled={loading}
            className="bg-[#e53935] text-white px-5 py-2 rounded text-sm font-medium hover:bg-red-700 transition disabled:opacity-60"
          >
            {loading ? 'Desativando...' : 'Confirmar desativação'}
          </button>
        </div>
      </div>
    </div>
  )
}
