'use client'

import type { BlocoHorarioDTO, DisponibilidadeBlocoItem } from '@/types/disponibilidades'

const DIAS = [
  { value: 'SEGUNDA', label: 'Segunda' },
  { value: 'TERCA', label: 'Terca' },
  { value: 'QUARTA', label: 'Quarta' },
  { value: 'QUINTA', label: 'Quinta' },
  { value: 'SEXTA', label: 'Sexta' },
  { value: 'SABADO', label: 'Sabado' },
] as const

type Props = {
  blocos: BlocoHorarioDTO[]
  grade: DisponibilidadeBlocoItem[]
  onToggle?: (diaSemana: DisponibilidadeBlocoItem['diaSemana'], blocoId: string) => void
  readonly?: boolean
}

export function GradeDisponibilidade({ blocos, grade, onToggle, readonly = false }: Props) {
  const selecionados = new Set(grade.filter((item) => item.disponivel).map((item) => `${item.diaSemana}-${item.blocoId}`))

  return (
    <div className="overflow-x-auto rounded-lg border border-[#ddd] bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-[#ddd] bg-gray-50">
            <th className="w-28 px-3 py-3 text-left text-xs font-medium uppercase tracking-widest text-gray-500">
              Dia
            </th>
            {blocos.map((bloco) => (
              <th key={bloco.id} className="px-2 py-3 text-center text-xs font-medium text-gray-500">
                <span className="block font-semibold text-gray-700">{bloco.inicio}</span>
                <span className="block text-[11px]">{bloco.turno}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIAS.map((dia, index) => (
            <tr key={dia.value} className={`border-b border-[#eee] ${index % 2 ? 'bg-gray-50/60' : 'bg-white'}`}>
              <td className="px-3 py-2 text-xs font-medium text-gray-700">{dia.label}</td>
              {blocos.map((bloco) => {
                const ativo = selecionados.has(`${dia.value}-${bloco.id}`)
                return (
                  <td key={bloco.id} className="px-2 py-2 text-center">
                    <button
                      type="button"
                      disabled={readonly}
                      onClick={() => onToggle?.(dia.value, bloco.id)}
                      className={`h-8 w-8 rounded text-xs font-semibold transition ${
                        ativo
                          ? 'bg-[#2e7d32] text-white'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      } disabled:cursor-default`}
                      title={ativo ? 'Disponivel' : 'Indisponivel'}
                    >
                      {ativo ? '✓' : '-'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
