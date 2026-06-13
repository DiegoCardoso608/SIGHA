'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import type { Professor, Disponibilidade, ProfessorPayload } from '@/hooks/useProfessores'

const schema = z.object({
  nome: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  matricula: z.string().min(3, 'Matrícula obrigatória'),
  titulacao: z.string().min(1, 'Titulação obrigatória'),
  cargaHorariaMax: z.coerce.number().min(1, 'Mínimo 1h').max(60, 'Máximo 60h'),
  senha: z.string().min(6, 'Ao menos 6 caracteres').optional().or(z.literal('')),
})

type FormData = z.infer<typeof schema>

const DIAS = [
  { value: 'SEGUNDA', label: 'Seg' },
  { value: 'TERCA', label: 'Ter' },
  { value: 'QUARTA', label: 'Qua' },
  { value: 'QUINTA', label: 'Qui' },
  { value: 'SEXTA', label: 'Sex' },
  { value: 'SABADO', label: 'Sáb' },
] as const

const TURNOS = [
  { value: 'MANHA', label: 'Manhã' },
  { value: 'TARDE', label: 'Tarde' },
  { value: 'NOITE', label: 'Noite' },
] as const

const TITULACOES = ['Especialista', 'Mestre', 'Doutor', 'Pós-Doutor']

type Props = {
  aberto: boolean
  professor?: Professor | null
  disciplinasDisponiveis: { id: string; nome: string; codigo: string }[]
  onFechar: () => void
  onSalvar: (dados: ProfessorPayload) => Promise<{ ok: boolean; erro?: string }>
}

export function ProfessorModal({ aberto, professor, disciplinasDisponiveis, onFechar, onSalvar }: Props) {
  const [salvando, setSalvando] = useState(false)
  const [erroServidor, setErroServidor] = useState<string | null>(null)
  const [disciplinaIds, setDisciplinaIds] = useState<string[]>([])
  const [disponibilidades, setDisponibilidades] = useState<Disponibilidade[]>([])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (aberto) {
      setErroServidor(null)
      if (professor) {
        reset({
          nome: professor.nome,
          email: professor.email,
          matricula: professor.matricula,
          titulacao: professor.titulacao,
          cargaHorariaMax: professor.cargaHorariaMax,
          senha: '',
        })
        setDisciplinaIds(professor.disciplinas.map((d) => d.disciplina.id))
        setDisponibilidades(professor.disponibilidades)
      } else {
        reset({ nome: '', email: '', matricula: '', titulacao: '', cargaHorariaMax: 20, senha: '' })
        setDisciplinaIds([])
        setDisponibilidades([])
      }
    }
  }, [aberto, professor, reset])

  function toggleDisponibilidade(dia: Disponibilidade['diaSemana'], turno: Disponibilidade['turno']) {
    setDisponibilidades((prev) => {
      const existe = prev.some((d) => d.diaSemana === dia && d.turno === turno)
      return existe
        ? prev.filter((d) => !(d.diaSemana === dia && d.turno === turno))
        : [...prev, { diaSemana: dia, turno }]
    })
  }

  function toggleDisciplina(id: string) {
    setDisciplinaIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))
  }

  async function onSubmit(data: FormData) {
    setSalvando(true)
    setErroServidor(null)
    const payload: ProfessorPayload = {
      ...data,
      senha: data.senha || undefined,
      disciplinaIds,
      disponibilidades,
    }
    const result = await onSalvar(payload)
    setSalvando(false)
    if (result.ok) {
      onFechar()
    } else {
      setErroServidor(result.erro || 'Erro desconhecido')
    }
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-8 pb-8 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">
            {professor ? 'Editar Professor' : 'Novo Professor'}
          </h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-5">
          {erroServidor && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded">
              {erroServidor}
            </div>
          )}

          {/* Dados pessoais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Nome completo
              </label>
              <input
                {...register('nome')}
                className={cn(
                  'w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white',
                  errors.nome ? 'border-red-400' : 'border-gray-300'
                )}
                placeholder="Ex: João da Silva"
              />
              {errors.nome && <p className="text-red-500 text-xs mt-1">{errors.nome.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Email institucional
              </label>
              <input
                {...register('email')}
                type="email"
                className={cn(
                  'w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white',
                  errors.email ? 'border-red-400' : 'border-gray-300'
                )}
                placeholder="professor@instituicao.edu.br"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Matrícula
              </label>
              <input
                {...register('matricula')}
                className={cn(
                  'w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white',
                  errors.matricula ? 'border-red-400' : 'border-gray-300'
                )}
                placeholder="Ex: PROF2026001"
              />
              {errors.matricula && <p className="text-red-500 text-xs mt-1">{errors.matricula.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Titulação
              </label>
              <select
                {...register('titulacao')}
                className={cn(
                  'w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white',
                  errors.titulacao ? 'border-red-400' : 'border-gray-300'
                )}
              >
                <option value="">Selecione...</option>
                {TITULACOES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {errors.titulacao && <p className="text-red-500 text-xs mt-1">{errors.titulacao.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Carga horária máx. (h/semana)
              </label>
              <input
                {...register('cargaHorariaMax')}
                type="number"
                min={1}
                max={60}
                className={cn(
                  'w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white',
                  errors.cargaHorariaMax ? 'border-red-400' : 'border-gray-300'
                )}
              />
              {errors.cargaHorariaMax && (
                <p className="text-red-500 text-xs mt-1">{errors.cargaHorariaMax.message}</p>
              )}
            </div>

            {!professor && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  Senha inicial
                </label>
                <input
                  {...register('senha')}
                  type="password"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white"
                  placeholder="Deixe em branco para usar o padrão"
                />
                <p className="text-xs text-gray-400 mt-1">Padrão: sigha@2026</p>
              </div>
            )}
          </div>

          {/* Disponibilidade */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Disponibilidade
            </label>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Dia</th>
                    {TURNOS.map((t) => (
                      <th key={t.value} className="px-2 py-2 text-center font-medium text-gray-600">
                        {t.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DIAS.map((dia) => (
                    <tr key={dia.value} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-700">{dia.label}</td>
                      {TURNOS.map((turno) => {
                        const marcado = disponibilidades.some(
                          (d) => d.diaSemana === dia.value && d.turno === turno.value
                        )
                        return (
                          <td key={turno.value} className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => toggleDisponibilidade(dia.value, turno.value)}
                              className="w-4 h-4 cursor-pointer accent-[#2e7d32]"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {disponibilidades.length} bloco{disponibilidades.length !== 1 ? 's' : ''} selecionado
              {disponibilidades.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Disciplinas */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Disciplinas autorizadas
            </label>
            <div className="border border-gray-200 rounded p-3 max-h-48 overflow-y-auto">
              {disciplinasDisponiveis.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma disciplina cadastrada.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {disciplinasDisponiveis.map((disc) => {
                    const marcada = disciplinaIds.includes(disc.id)
                    return (
                      <label key={disc.id} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => toggleDisciplina(disc.id)}
                          className="w-4 h-4 accent-[#2e7d32]"
                        />
                        <div className="text-xs">
                          <div className="font-medium text-gray-700 group-hover:text-[#2e7d32]">{disc.codigo}</div>
                          <div className="text-gray-400 text-[11px]">{disc.nome}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {disciplinaIds.length} disciplina{disciplinaIds.length !== 1 ? 's' : ''} selecionada
              {disciplinaIds.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onFechar}
              className="px-5 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2 bg-[#2e7d32] text-white rounded text-sm font-medium hover:bg-[#1a5c1a] disabled:opacity-60 transition"
            >
              {salvando ? 'Salvando...' : professor ? 'Salvar alterações' : 'Cadastrar professor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
