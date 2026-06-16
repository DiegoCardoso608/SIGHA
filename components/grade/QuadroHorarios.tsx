'use client'

// components/grade/QuadroHorarios.tsx
// Sprint 5.6 A — Grade semanal visual de uma turma com expansão controlada externamente

import { useRouter } from 'next/navigation'
import type { AlocacaoCriada, PendenciaDetalhada, ConflitoCruzado, TipoPendencia } from '@/lib/algoritmo'

// ─── CLEANUP: Remover código duplicado posterior ao export ───────────────────

const DIAS: { key: string; label: string }[] = [
  { key: 'SEGUNDA', label: 'Segunda' },
  { key: 'TERCA', label: 'Terça' },
  { key: 'QUARTA', label: 'Quarta' },
  { key: 'QUINTA', label: 'Quinta' },
  { key: 'SEXTA', label: 'Sexta' },
  { key: 'SABADO', label: 'Sábado' },
]

const ICONE_PENDENCIA: Record<TipoPendencia, string> = {
  SEM_PROFESSOR_VINCULADO: '👤',
  SEM_DISPONIBILIDADE_COMPATIVEL: '📅',
  CARGA_HORARIA_ESGOTADA: '⏱️',
  CONFLITO_DE_HORARIO: '⚠️',
}

const COR_PENDENCIA: Record<TipoPendencia, string> = {
  SEM_PROFESSOR_VINCULADO: 'bg-red-50 border-red-200 text-red-800',
  SEM_DISPONIBILIDADE_COMPATIVEL: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  CARGA_HORARIA_ESGOTADA: 'bg-orange-50 border-orange-200 text-orange-800',
  CONFLITO_DE_HORARIO: 'bg-red-50 border-red-300 text-red-900',
}

interface QuadroHorariosProps {
  turma: {
    id: string
    codigo: string
    nome: string
    periodo: number
    turno: string
  }
  alocadas: AlocacaoCriada[]
  pendencias: PendenciaDetalhada[]
  conflitos: ConflitoCruzado[]
  // Sprint 5.6 A — Controle externo de expansão
  expandido?: boolean
  onToggle?: () => void
  // Compatibilidade com Sprint 5.5
  defaultExpandido?: boolean
}

export function QuadroHorarios({
  turma,
  alocadas,
  pendencias,
  conflitos,
  expandido,
  onToggle,
  defaultExpandido = true,
}: QuadroHorariosProps) {
  const router = useRouter()

  // Determinar se deve estar expandido: prioritário é expandido (Sprint 5.6 A), fallback é defaultExpandido (Sprint 5.5)
  const estaExpandido = expandido !== undefined ? expandido : defaultExpandido

  // Agrupa alocações por dia
  const porDia = new Map<string, AlocacaoCriada[]>()
  for (const alocacao of alocadas) {
    if (!porDia.has(alocacao.diaSemana)) {
      porDia.set(alocacao.diaSemana, [])
    }
    porDia.get(alocacao.diaSemana)!.push(alocacao)
  }

  // Coleta todos os blocos únicos (para as linhas do grid)
  const blocosUnicos = Array.from(
    new Map(
      alocadas.map((a) => [a.blocoId, { id: a.blocoId, inicio: a.blocoInicio, fim: a.blocoFim }])
    ).values()
  ).sort((a, b) => a.inicio.localeCompare(b.inicio))

  const temConteudo = alocadas.length > 0 || pendencias.length > 0 || conflitos.length > 0

  const badgeTurno: Record<string, string> = {
    MANHA: 'bg-blue-50 text-blue-700 border border-blue-200',
    TARDE: 'bg-amber-50 text-amber-700 border border-amber-200',
    NOITE: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  }
  const labelTurno: Record<string, string> = {
    MANHA: 'Manhã',
    TARDE: 'Tarde',
    NOITE: 'Noite',
  }

  return (
    <div className="rounded-lg border border-[#dddddd] bg-white overflow-hidden">
      {/* Cabeçalho da turma — clicável se onToggle for definido */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-[#dddddd] bg-[#f5f5f5] ${
          onToggle ? 'cursor-pointer select-none hover:bg-[#eeeeee] transition-colors' : ''
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {/* Chevron de colapso — exibido apenas se onToggle for definido */}
          {onToggle && (
            <svg
              className={`w-4 h-4 text-[#888888] transition-transform duration-200 ${
                estaExpandido ? 'rotate-0' : '-rotate-90'
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}

          <div>
            <p className="text-sm font-semibold text-[#333333]">{turma.nome}</p>
            <p className="text-xs text-[#888888]">{turma.codigo}</p>
          </div>

          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              badgeTurno[turma.turno] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {labelTurno[turma.turno] ?? turma.turno}
          </span>

          {conflitos.length > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-800 border border-red-200">
              ⚠️ {conflitos.length} conflito{conflitos.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Lado direito: contadores + botão Alocações */}
        <div
          className="flex items-center gap-4"
          onClick={(e) => e.stopPropagation()} // evita colapsar ao clicar nos botões
        >
          <div className="flex items-center gap-3 text-xs text-[#888888]">
            <span>
              <span className="font-medium text-[#2e7d32]">{alocadas.length}</span> alocadas
            </span>
            {pendencias.length > 0 && (
              <span>
                <span className="font-medium text-[#f9a825]">{pendencias.length}</span> pendentes
              </span>
            )}
          </div>

          {/* Botão Alocações — Sprint 5.6 A */}
          <button
            onClick={() => router.push(`/alocacoes?turmaId=${turma.id}`)}
            className="text-xs font-medium px-3 py-1.5 rounded border border-[#2e7d32] text-[#2e7d32] hover:bg-[#e8f5e9] transition-colors whitespace-nowrap"
          >
            Alocações
          </button>
        </div>
      </div>

      {/* Conteúdo colapsável */}
      {temConteudo && estaExpandido && (
        <div className="p-4 space-y-4">
          {/* Grid semanal */}
          {alocadas.length > 0 && blocosUnicos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr>
                    <th className="w-24 py-2 pr-3 text-left text-[10px] font-medium tracking-widest text-[#888888] uppercase">
                      Horário
                    </th>
                    {DIAS.map((dia) => (
                      <th
                        key={dia.key}
                        className="py-2 px-1 text-center text-[10px] font-medium tracking-widest text-[#888888] uppercase"
                      >
                        {dia.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {blocosUnicos.map((bloco) => (
                    <tr key={bloco.id} className="border-t border-[#dddddd]">
                      <td className="py-1.5 pr-3 text-[10px] text-[#888888] whitespace-nowrap align-top">
                        {bloco.inicio}
                        <br />
                        <span className="text-[9px]">{bloco.fim}</span>
                      </td>
                      {DIAS.map((dia) => {
                        const alocacaoDia = porDia.get(dia.key)?.find((a) => a.blocoId === bloco.id)

                        const temConflito = conflitos.some(
                          (c) =>
                            c.diaSemana === dia.key &&
                            c.blocoInicio === bloco.inicio &&
                            (c.turma1 === turma.nome || c.turma2 === turma.nome)
                        )

                        return (
                          <td key={dia.key} className="py-1 px-1 align-top">
                            {alocacaoDia ? (
                              <div
                                className={`rounded px-1.5 py-1.5 text-white ${
                                  temConflito
                                    ? 'bg-[#e53935]'
                                    : dia.key === 'SABADO'
                                    ? 'bg-[#7b9ccc]'
                                    : 'bg-[#4a7abf]'
                                }`}
                              >
                                <p
                                  className="text-[10px] font-medium leading-tight"
                                  style={{ color: 'rgba(255,255,255,0.95)' }}
                                >
                                  {alocacaoDia.disciplinaNome}
                                </p>
                                <p
                                  className="text-[9px] mt-0.5 leading-tight truncate"
                                  style={{ color: 'rgba(255,255,255,0.75)' }}
                                >
                                  {alocacaoDia.professorNome}
                                </p>
                                {temConflito && (
                                  <p className="text-[9px] mt-0.5 font-semibold">⚠️ Conflito</p>
                                )}
                              </div>
                            ) : (
                              <div className="h-10" />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Conflitos cross-turma */}
          {conflitos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium tracking-widest text-red-600 uppercase">
                Conflitos detectados
              </p>
              {conflitos.map((conflito, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2"
                >
                  <span className="text-[11px]">⚠️</span>
                  <p className="text-xs text-red-800 leading-relaxed">
                    <span className="font-medium">{conflito.professorNome}</span> está alocado em{' '}
                    <span className="font-medium">{conflito.turma1}</span> e{' '}
                    <span className="font-medium">{conflito.turma2}</span> ao mesmo tempo —{' '}
                    {conflito.diaSemana.charAt(0) + conflito.diaSemana.slice(1).toLowerCase()}{' '}
                    {conflito.blocoInicio}–{conflito.blocoFim}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Pendências com diagnóstico detalhado */}
          {pendencias.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium tracking-widest text-[#888888] uppercase">
                Disciplinas pendentes
              </p>
              {pendencias.map((pendencia, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded border px-3 py-2 ${COR_PENDENCIA[pendencia.tipoPendencia]}`}
                >
                  <span className="text-[11px] mt-0.5">{ICONE_PENDENCIA[pendencia.tipoPendencia]}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{pendencia.disciplinaNome}</p>
                    <p className="text-[10px] mt-0.5 leading-relaxed opacity-90">{pendencia.motivo}</p>
                    {pendencia.professoresVinculados > 0 && (
                      <p className="text-[10px] mt-0.5 opacity-70">
                        {pendencia.professoresVinculados} professor
                        {pendencia.professoresVinculados > 1 ? 'es' : ''} vinculado
                        {pendencia.professoresVinculados > 1 ? 's' : ''},{' '}
                        {pendencia.professoresDisponiveis} com disponibilidade compatível
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Estado vazio — tudo alocado */}
          {alocadas.length > 0 && pendencias.length === 0 && conflitos.length === 0 && (
            <p className="text-xs text-[#2e7d32] bg-[#e8f5e9] rounded px-3 py-2 border border-[#a5d6a7]">
              ✓ Todas as disciplinas foram alocadas com sucesso.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
