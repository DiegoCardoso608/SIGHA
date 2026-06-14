'use client'

// components/disciplinas/DisciplinaModal.tsx
// Sprint 2 — Modal de cadastro e edição de disciplinas

import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Curso {
  id: string
  nome: string
  codigo: string
}

interface Professor {
  id: string
  nome: string
  titulacao: string
  ativo: boolean
}

interface CursoDisciplina {
  cursoId: string
  periodo: number
  obrigatoria: boolean
  curso: { id: string; nome: string; codigo: string }
}

interface Disciplina {
  id: string
  codigo: string
  nome: string
  cargaHoraria: number
  ativo: boolean
  cursos: CursoDisciplina[]
  professores?: { professor: Professor }[]
}

interface DisciplinaModalProps {
  disciplina?: Disciplina | null
  onClose: () => void
  onSaved: () => void
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const formSchema = z.object({
  codigo: z.string().min(2, 'Código obrigatório'),
  nome: z.string().min(3, 'Nome obrigatório'),
  cargaHoraria: z
    .number()
    .int()
    .min(1)
    .max(500),
  cursos: z.array(
    z.object({
      cursoId: z.string().min(1, 'Selecione o curso'),
      periodo: z.number().int().min(1).max(10),
      obrigatoria: z.boolean(),
    })
  ),
})

type FormData = z.infer<typeof formSchema>

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DisciplinaModal({
  disciplina,
  onClose,
  onSaved,
}: DisciplinaModalProps) {
  const isEdit = !!disciplina
  const [cursos, setCursos] = useState<Curso[]>([])
  const [loadingCursos, setLoadingCursos] = useState(true)
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      codigo: disciplina?.codigo ?? '',
      nome: disciplina?.nome ?? '',
      cargaHoraria: disciplina?.cargaHoraria ?? undefined,
      cursos: disciplina?.cursos.map((cd) => ({
        cursoId: cd.cursoId,
        periodo: cd.periodo,
        obrigatoria: cd.obrigatoria,
      })) ?? [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'cursos' })

  // Carregar lista de cursos
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/cursos')
        if (res.ok) {
          const data = await res.json()
          setCursos(data.cursos ?? data)
        }
      } catch {
        // silencia — lista fica vazia
      } finally {
        setLoadingCursos(false)
      }
    }
    load()
  }, [])

  async function onSubmit(data: FormData) {
    setSaving(true)
    setServerError('')

    try {
      const url = isEdit ? `/api/disciplinas/${disciplina!.id}` : '/api/disciplinas'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        setServerError(err.error ?? 'Erro ao salvar disciplina.')
        return
      }

      onSaved()
    } catch {
      setServerError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // Professores autorizados (somente visualização na edição)
  const professoresAutorizados = disciplina?.professores ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ddd]">
          <h2 className="text-lg font-semibold text-[#333]">
            {isEdit ? 'Editar Disciplina' : 'Nova Disciplina'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-6">
          {/* Erro do servidor */}
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded px-4 py-2">
              {serverError}
            </div>
          )}

          {/* ── Seção 1: Dados da disciplina ─────────────────────────────── */}
          <section>
            <h3 className="text-xs font-medium tracking-widest text-gray-500 uppercase mb-3">
              Dados da Disciplina
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('codigo')}
                  placeholder="Ex: CC001"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white uppercase"
                />
                {errors.codigo && (
                  <p className="text-red-500 text-xs mt-1">{errors.codigo.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Carga Horária (h) <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('cargaHoraria', { valueAsNumber: true })}
                  type="number"
                  min={1}
                  max={500}
                  placeholder="Ex: 80"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white"
                />
                {errors.cargaHoraria && (
                  <p className="text-red-500 text-xs mt-1">{errors.cargaHoraria.message}</p>
                )}
              </div>

              <div className="col-span-2">
                <label className="block text-sm text-gray-700 mb-1">
                  Nome da Disciplina <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('nome')}
                  placeholder="Ex: Engenharia de Software"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white"
                />
                {errors.nome && (
                  <p className="text-red-500 text-xs mt-1">{errors.nome.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* ── Seção 2: Vínculos com cursos ─────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium tracking-widest text-gray-500 uppercase">
                Vínculos com Cursos
              </h3>
              <button
                type="button"
                onClick={() =>
                  append({ cursoId: '', periodo: 1, obrigatoria: true })
                }
                className="text-[#2e7d32] text-xs font-medium hover:text-[#1a5c1a] border border-[#2e7d32] px-3 py-1 rounded hover:bg-[#e8f5e9] transition"
              >
                + Adicionar curso
              </button>
            </div>

            {loadingCursos ? (
              <p className="text-sm text-gray-400">Carregando cursos...</p>
            ) : fields.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Nenhum vínculo adicionado. A disciplina pode ser vinculada depois.
              </p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-[1fr_100px_120px_32px] gap-2 items-end"
                  >
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Curso</label>
                      <select
                        {...register(`cursos.${index}.cursoId`)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white"
                      >
                        <option value="">Selecione...</option>
                        {cursos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                      {errors.cursos?.[index]?.cursoId && (
                        <p className="text-red-500 text-xs mt-0.5">
                          {errors.cursos[index]?.cursoId?.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Período</label>
                      <input
                        {...register(`cursos.${index}.periodo`, { valueAsNumber: true })}
                        type="number"
                        min={1}
                        max={10}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2e7d32] bg-white"
                      />
                    </div>

                    <div className="flex items-center gap-2 pb-2">
                      <input
                        {...register(`cursos.${index}.obrigatoria`)}
                        type="checkbox"
                        id={`obrigatoria-${index}`}
                        className="accent-[#2e7d32]"
                      />
                      <label
                        htmlFor={`obrigatoria-${index}`}
                        className="text-sm text-gray-700 select-none"
                      >
                        Obrigatória
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="pb-1 text-gray-400 hover:text-red-500 transition text-lg leading-none"
                      title="Remover vínculo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Seção 3: Professores autorizados (somente leitura na edição) ── */}
          {isEdit && professoresAutorizados.length > 0 && (
            <section>
              <h3 className="text-xs font-medium tracking-widest text-gray-500 uppercase mb-3">
                Professores Autorizados
              </h3>
              <div className="flex flex-wrap gap-2">
                {professoresAutorizados.map(({ professor }) => (
                  <span
                    key={professor.id}
                    className={`text-xs px-3 py-1 rounded-full border ${
                      professor.ativo
                        ? 'bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]'
                        : 'bg-[#f5f5f5] text-gray-500 border-[#ddd]'
                    }`}
                  >
                    {professor.nome}
                    {!professor.ativo && ' (inativo)'}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Gerencie as autorizações no módulo de Professores.
              </p>
            </section>
          )}

          {/* Footer */}
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
              disabled={saving}
              className="bg-[#2e7d32] text-white px-5 py-2 rounded text-sm font-medium hover:bg-[#1a5c1a] transition disabled:opacity-60"
            >
              {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
