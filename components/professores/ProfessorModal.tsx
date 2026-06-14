"use client";

// components/professores/ProfessorModal.tsx
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ─── Tipos & enums ────────────────────────────────────────────────────────────

const TITULACOES = [
  { value: "GRADUADO", label: "Graduado" },
  { value: "ESPECIALISTA", label: "Especialista" },
  { value: "MESTRE", label: "Mestre" },
  { value: "DOUTOR", label: "Doutor" },
  { value: "DOUTORA", label: "Doutora" },
  { value: "POS_DOUTOR", label: "Pós-Doutor" },
] as const;

const DIAS_SEMANA = [
  { value: "SEGUNDA", label: "Segunda" },
  { value: "TERCA", label: "Terça" },
  { value: "QUARTA", label: "Quarta" },
  { value: "QUINTA", label: "Quinta" },
  { value: "SEXTA", label: "Sexta" },
  { value: "SABADO", label: "Sábado" },
] as const;

const TURNOS = [
  { value: "MANHA", label: "Manhã" },
  { value: "TARDE", label: "Tarde" },
  { value: "NOITE", label: "Noite" },
] as const;

const TIPOS_PROFESSOR = [
  { value: "TITULAR", label: "Titular" },
  { value: "SUBSTITUTO", label: "Substituto" },
  { value: "RESERVA", label: "Reserva" },
] as const;

type DiaSemana = (typeof DIAS_SEMANA)[number]["value"];
type Turno = (typeof TURNOS)[number]["value"];

interface Disciplina {
  id: string;
  codigo: string;
  nome: string;
}

interface ProfessorParaEdicao {
  id: string;
  titulacao: string;
  tipo?: "TITULAR" | "SUBSTITUTO" | "RESERVA";
  cargaHorariaMax: number;
  ativo: boolean;
  usuario: {
    nome: string;
    email: string;
    matricula?: string | null;
  };
  disciplinas: { disciplina: Disciplina }[];
  disponibilidades: { diaSemana: DiaSemana; turno: Turno }[];
}

interface ProfessorModalProps {
  aberto: boolean;
  professor?: ProfessorParaEdicao | null;
  onFechar: () => void;
  onSalvo: () => void;
}

// ─── Schema de validação ──────────────────────────────────────────────────────

const schema = z
  .object({
    nome: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
    email: z.string().email("E-mail inválido"),
    matricula: z.string().optional(),
    senhaInicial: z.string().optional(),
    titulacao: z.enum([
      "GRADUADO",
      "ESPECIALISTA",
      "MESTRE",
      "DOUTOR",
      "DOUTORA",
      "POS_DOUTOR",
    ] as const),
    cargaHorariaMax: z
      .number()
      .int()
      .min(1, "Mínimo 1 hora")
      .max(40, "Máximo 40 horas"),
    tipo: z.enum(["TITULAR", "SUBSTITUTO", "RESERVA"] as const),
    disciplinaIds: z.array(z.string()),
    disponibilidades: z
      .array(
        z.object({
          diaSemana: z.enum([
            "SEGUNDA",
            "TERCA",
            "QUARTA",
            "QUINTA",
            "SEXTA",
            "SABADO",
          ] as const),
          turno: z.enum(["MANHA", "TARDE", "NOITE"] as const),
        })
      ),
  })
  .refine(
    (data) => {
      // Senha obrigatória apenas na criação (sem professor passado)
      return true;
    },
    { message: "" }
  );

type FormData = z.infer<typeof schema>;

// ─── Componente ───────────────────────────────────────────────────────────────

export function ProfessorModal({
  aberto,
  professor,
  onFechar,
  onSalvo,
}: ProfessorModalProps) {
  const editando = !!professor;
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [carregandoDisciplinas, setCarregandoDisciplinas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      email: "",
      matricula: "",
      senhaInicial: "",
      titulacao: "GRADUADO",
      tipo: "TITULAR",
      cargaHorariaMax: 20,
      disciplinaIds: [],
      disponibilidades: [],
    },
  });

  const disponibilidadesSelecionadas = watch("disponibilidades");
  const disciplinasSelecionadas = watch("disciplinaIds");

  // Carrega disciplinas disponíveis
  useEffect(() => {
    if (!aberto) return;
    setCarregandoDisciplinas(true);
    fetch("/api/disciplinas?porPagina=100")
      .then((r) => r.json())
      .then((json) => setDisciplinas(json.data ?? []))
      .catch(() => setDisciplinas([]))
      .finally(() => setCarregandoDisciplinas(false));
  }, [aberto]);

  // Preenche formulário ao editar
  useEffect(() => {
    if (!aberto) return;
    if (professor) {
      reset({
        nome: professor.usuario.nome,
        email: professor.usuario.email,
        matricula: professor.usuario.matricula ?? "",
        senhaInicial: "",
        titulacao: professor.titulacao as FormData["titulacao"],
        tipo: professor.tipo ?? "TITULAR",
        cargaHorariaMax: professor.cargaHorariaMax,
        disciplinaIds: professor.disciplinas.map((d) => d.disciplina.id),
        disponibilidades: professor.disponibilidades,
      });
    } else {
      reset({
        nome: "",
        email: "",
        matricula: "",
        senhaInicial: "",
        titulacao: "GRADUADO",
        tipo: "TITULAR",
        cargaHorariaMax: 20,
        disciplinaIds: [],
        disponibilidades: [],
      });
    }
    setErro(null);
  }, [aberto, professor, reset]);

  // Fecha com Escape
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [aberto, onFechar]);

  // Alterna disponibilidade
  const toggleDisponibilidade = (diaSemana: DiaSemana, turno: Turno) => {
    const atual = watch("disponibilidades");
    const existe = atual.some(
      (d) => d.diaSemana === diaSemana && d.turno === turno
    );
    if (existe) {
      setValue(
        "disponibilidades",
        atual.filter((d) => !(d.diaSemana === diaSemana && d.turno === turno))
      );
    } else {
      setValue("disponibilidades", [...atual, { diaSemana, turno }]);
    }
  };

  const temDisponibilidade = (diaSemana: DiaSemana, turno: Turno) =>
    disponibilidadesSelecionadas.some(
      (d) => d.diaSemana === diaSemana && d.turno === turno
    );

  // Alterna disciplina
  const toggleDisciplina = (id: string) => {
    const atual = watch("disciplinaIds");
    if (atual.includes(id)) {
      setValue(
        "disciplinaIds",
        atual.filter((d) => d !== id)
      );
    } else {
      setValue("disciplinaIds", [...atual, id]);
    }
  };

  // Submit
  const onSubmit = async (data: FormData) => {
    setSalvando(true);
    setErro(null);

    try {
      const url = editando
        ? `/api/professores/${professor!.id}`
        : "/api/professores";
      const method = editando ? "PUT" : "POST";

      const body = editando
        ? {
            nome: data.nome,
            email: data.email,
            matricula: data.matricula || null,
            titulacao: data.titulacao,
            tipo: data.tipo,
            cargaHorariaMax: data.cargaHorariaMax,
            disciplinaIds: data.disciplinaIds,
            disponibilidades: data.disponibilidades,
            ...(data.senhaInicial ? { novaSenha: data.senhaInicial } : {}),
          }
        : {
            nome: data.nome,
            email: data.email,
            matricula: data.matricula || undefined,
            senhaInicial: data.senhaInicial || "sigha@2026",
            titulacao: data.titulacao,
            tipo: data.tipo,
            cargaHorariaMax: data.cargaHorariaMax,
            disciplinaIds: data.disciplinaIds,
            disponibilidades: data.disponibilidades,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        setErro(json.error ?? "Erro ao salvar professor");
        return;
      }

      onSalvo();
      onFechar();
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onFechar}
      />

      {/* Modal */}
      <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {editando ? "Editar Professor" : "Novo Professor"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {editando
                ? "Atualize os dados do professor"
                : "Preencha os dados para cadastrar um novo professor"}
            </p>
          </div>
          <button
            onClick={onFechar}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Corpo com scroll */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Erro global */}
            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {erro}
              </div>
            )}

            {/* Seção: Dados pessoais */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">1</span>
                Dados pessoais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">
                    Nome completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("nome")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex: João Carlos da Silva"
                  />
                  {errors.nome && (
                    <p className="text-xs text-red-500 mt-1">{errors.nome.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    E-mail institucional <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("email")}
                    type="email"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="professor@instituicao.br"
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Matrícula
                  </label>
                  <input
                    {...register("matricula")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex: 20240001"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    {editando ? "Nova senha (deixe em branco para manter)" : "Senha inicial"}
                  </label>
                  <input
                    {...register("senhaInicial")}
                    type="password"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder={editando ? "••••••••" : "Mínimo 6 caracteres"}
                  />
                  {!editando && (
                    <p className="text-xs text-gray-400 mt-1">
                      Se vazio, será usada a senha padrão: <code>sigha@2026</code>
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Seção: Dados acadêmicos */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">2</span>
                Dados acadêmicos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Titulação <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register("titulacao")}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                  >
                    {TITULACOES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {errors.titulacao && (
                    <p className="text-xs text-red-500 mt-1">{errors.titulacao.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Carga horária máxima (h/semana) <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("cargaHorariaMax", { valueAsNumber: true })}
                    type="number"
                    min={1}
                    max={40}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {errors.cargaHorariaMax && (
                    <p className="text-xs text-red-500 mt-1">{errors.cargaHorariaMax.message}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Seção: Disponibilidade */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">3</span>
                Disponibilidade
                <span className="text-xs font-normal text-gray-400 ml-1">
                  ({disponibilidadesSelecionadas.length} selecionada
                  {disponibilidadesSelecionadas.length !== 1 ? "s" : ""})
                </span>
              </h3>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs">Dia</th>
                      {TURNOS.map((t) => (
                        <th key={t.value} className="text-center px-3 py-2 font-medium text-gray-500 text-xs">
                          {t.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DIAS_SEMANA.map((dia, i) => (
                      <tr key={dia.value} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-3 py-2 font-medium text-gray-700 text-xs">{dia.label}</td>
                        {TURNOS.map((turno) => {
                          const ativo = temDisponibilidade(dia.value, turno.value);
                          return (
                            <td key={turno.value} className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleDisponibilidade(dia.value, turno.value)}
                                className={`w-8 h-8 rounded-lg transition-all text-xs font-medium ${
                                  ativo
                                    ? "bg-green-600 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                }`}
                              >
                                {ativo ? "✓" : "—"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Seção: Disciplinas autorizadas */}
            <section>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">4</span>
                Disciplinas autorizadas
                <span className="text-xs font-normal text-gray-400 ml-1">
                  ({disciplinasSelecionadas.length} selecionada
                  {disciplinasSelecionadas.length !== 1 ? "s" : ""})
                </span>
              </h3>

              {carregandoDisciplinas ? (
                <div className="text-sm text-gray-400 text-center py-6">
                  Carregando disciplinas...
                </div>
              ) : (
                <div className="border border-gray-100 rounded-lg max-h-48 overflow-y-auto">
                  {disciplinas.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      Nenhuma disciplina encontrada
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {disciplinas.map((disc) => {
                        const selecionada = disciplinasSelecionadas.includes(disc.id);
                        return (
                          <label
                            key={disc.id}
                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                              selecionada ? "bg-green-50" : "hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selecionada}
                              onChange={() => toggleDisciplina(disc.id)}
                              className="accent-green-600 w-4 h-4 rounded"
                            />
                            <span className="text-xs text-gray-400 font-mono w-20 shrink-0">
                              {disc.codigo}
                            </span>
                            <span className="text-sm text-gray-700">{disc.nome}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
            <button
              type="button"
              onClick={onFechar}
              disabled={salvando}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="px-5 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {salvando && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar professor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
