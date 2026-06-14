'use client'

import { useCobertura } from '@/hooks/useDisponibilidades'

const STATUS_CLASS = {
  OK: 'bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]',
  ATENCAO: 'bg-yellow-50 text-yellow-900 border-yellow-200',
  CRITICO: 'bg-red-50 text-red-800 border-red-200',
}

const TURNO_LABEL = {
  MANHA: 'Manha',
  TARDE: 'Tarde',
  NOITE: 'Noite',
}

const DIA_LABEL = {
  SEGUNDA: 'Segunda',
  TERCA: 'Terca',
  QUARTA: 'Quarta',
  QUINTA: 'Quinta',
  SEXTA: 'Sexta',
  SABADO: 'Sabado',
}

export function CoberturaPanel({ periodoLetivoId, cursoId }: { periodoLetivoId?: string; cursoId?: string }) {
  const { data, loading, error } = useCobertura(periodoLetivoId, cursoId)

  return (
    <div className="rounded-lg border border-[#ddd] bg-white">
      <div className="flex items-center justify-between border-b border-[#ddd] px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#333]">Painel de cobertura</h2>
          <p className="text-xs text-gray-500">{data?.periodoLetivo.descricao ?? 'Periodo vigente'}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Carregando cobertura...</div>
      ) : error ? (
        <div className="px-5 py-6 text-sm text-red-700">{error}</div>
      ) : !data ? (
        <div className="py-10 text-center text-sm text-gray-400">Sem dados de cobertura.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ddd] bg-gray-50">
                {['Dia', 'Turno', 'Necessario', 'Titulares', 'Reserva', 'Cobertura', 'Status'].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-gray-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.resumo.map((item) => (
                <tr key={`${item.diaSemana}-${item.turno}`} className="border-b border-[#eee] hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{DIA_LABEL[item.diaSemana]}</td>
                  <td className="px-4 py-3 text-gray-700">{TURNO_LABEL[item.turno]}</td>
                  <td className="px-4 py-3 text-gray-700">{item.necessario}</td>
                  <td className="px-4 py-3 text-gray-700">{item.disponivelTitulares}</td>
                  <td className="px-4 py-3 text-gray-700">{item.disponivelReserva}</td>
                  <td className="px-4 py-3 text-gray-700">{Math.round(item.cobertura * 100)}%</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-3 py-0.5 text-xs ${STATUS_CLASS[item.status]}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
