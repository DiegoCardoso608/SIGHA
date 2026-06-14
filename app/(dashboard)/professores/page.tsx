"use client";

// app/(dashboard)/professores/page.tsx
import { useCallback, useEffect, useState } from "react";
import { ProfessorModal } from "@/components/professores/ProfessorModal";
import { DesativarModal } from "@/components/professores/DesativarModal";

// ─── Tipos ────────────────────────────────────────────────────────────────────

const TITULACAO_LABEL: Record<string, string> = {
  GRADUADO: "Graduado",
  ESPECIALISTA: "Especialista",
  MESTRE: "Mestre",
  DOUTOR: "Doutor",
  DOUTORA: "Doutora",
  POS_DOUTOR: "Pós-Doutor",
};

const TITULACAO_COR: Record<string, string> = {
  GRADUADO: "bg-gray-100 text-gray-600",
  ESPECIALISTA: "bg-blue-50 text-blue-600",
  MESTRE: "bg-violet-50 text-violet-600",
  DOUTOR: "bg-amber-50 text-amber-700",
  DOUTORA: "bg-amber-50 text-amber-700",
  POS_DOUTOR: "bg-green-50 text-green-700",
};

interface Professor {
  id: string;
  titulacao: string;
  tipo?: "TITULAR" | "SUBSTITUTO" | "RESERVA";
  cargaHorariaMax: number;
  ativo: boolean;
  criadoEm: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    matricula?: string | null;
    ativo: boolean;
  };
  disciplinas: { disciplina: { id: string; codigo: string; nome: string } }[];
  disponibilidades: { diaSemana: "SEGUNDA" | "TERCA" | "QUARTA" | "QUINTA" | "SEXTA" | "SABADO"; turno: "MANHA" | "TARDE" | "NOITE" }[];
  _count: { alocacoes: number };
}

interface Meta {
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ProfessoresPage() {
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [meta, setMeta] = useState<Meta>({
    total: 0,
    pagina: 1,
    porPagina: 10,
    totalPaginas: 0,
  });
  const [carregando, setCarregando] = useState(true);

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<"" | "true" | "false">("");
  const [filtroTitulacao, setFiltroTitulacao] = useState("");
  const [pagina, setPagina] = useState(1);

  // Modais
  const [modalAberto, setModalAberto] = useState(false);
  const [professorEditando, setProfessorEditando] = useState<Professor | null>(null);
  const [desativarModalAberto, setDesativarModalAberto] = useState(false);
  const [professorDesativando, setProfessorDesativando] = useState<Professor | null>(null);

  // Busca com debounce
  const [buscaDebounced, setBuscaDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 400);
    return () => clearTimeout(t);
  }, [busca]);

  // Reset página ao filtrar
  useEffect(() => {
    setPagina(1);
  }, [buscaDebounced, filtroAtivo, filtroTitulacao]);

  // Carrega dados
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams({
        pagina: String(pagina),
        porPagina: "10",
        ...(buscaDebounced ? { busca: buscaDebounced } : {}),
        ...(filtroAtivo !== "" ? { ativo: filtroAtivo } : {}),
        ...(filtroTitulacao ? { titulacao: filtroTitulacao } : {}),
      });

      const res = await fetch(`/api/professores?${params}`);
      const json = await res.json();

      if (res.ok) {
        setProfessores(json.data);
        setMeta(json.meta);
      }
    } finally {
      setCarregando(false);
    }
  }, [pagina, buscaDebounced, filtroAtivo, filtroTitulacao]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Handlers
  const abrirCadastro = () => {
    setProfessorEditando(null);
    setModalAberto(true);
  };

  const abrirEdicao = (prof: Professor) => {
    setProfessorEditando(prof);
    setModalAberto(true);
  };

  const abrirDesativar = (prof: Professor) => {
    setProfessorDesativando(prof);
    setDesativarModalAberto(true);
  };

  const reativar = async (prof: Professor) => {
    if (!confirm(`Reativar ${prof.usuario.nome}?`)) return;
    await fetch(`/api/professores/${prof.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: true, motivo: "Reativação pelo coordenador" }),
    });
    carregar();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Professores</h1>
            <p className="text-sm text-gray-500 mt-1">
              {meta.total} professor{meta.total !== 1 ? "es" : ""} cadastrado{meta.total !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={abrirCadastro}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo professor
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Busca */}
            <div className="flex-1 relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, e-mail ou matrícula..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Filtro titulação */}
            <select
              value={filtroTitulacao}
              onChange={(e) => setFiltroTitulacao(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white min-w-[140px]"
            >
              <option value="">Todas as titulações</option>
              <option value="GRADUADO">Graduado</option>
              <option value="ESPECIALISTA">Especialista</option>
              <option value="MESTRE">Mestre</option>
              <option value="DOUTOR">Doutor</option>
              <option value="DOUTORA">Doutora</option>
              <option value="POS_DOUTOR">Pós-Doutor</option>
            </select>

            {/* Filtro status */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              {(
                [
                  { value: "", label: "Todos" },
                  { value: "true", label: "Ativos" },
                  { value: "false", label: "Inativos" },
                ] as const
              ).map((op) => (
                <button
                  key={op.value}
                  onClick={() => setFiltroAtivo(op.value)}
                  className={`px-3 py-2 transition-colors ${
                    filtroAtivo === op.value
                      ? "bg-green-700 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {carregando ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-sm text-gray-400">Carregando professores...</span>
              </div>
            </div>
          ) : professores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">Nenhum professor encontrado</p>
              <p className="text-sm text-gray-400 mt-1">
                {busca || filtroAtivo || filtroTitulacao
                  ? "Tente ajustar os filtros"
                  : "Cadastre o primeiro professor"}
              </p>
              {!busca && !filtroAtivo && !filtroTitulacao && (
                <button
                  onClick={abrirCadastro}
                  className="mt-4 px-4 py-2 bg-green-700 text-white text-sm rounded-lg hover:bg-green-800 transition-colors"
                >
                  Cadastrar professor
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Professor
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Titulação
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        CH máx.
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Disciplinas
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Alocações
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {professores.map((prof) => (
                      <tr
                        key={prof.id}
                        className={`hover:bg-gray-50/50 transition-colors ${
                          !prof.ativo ? "opacity-60" : ""
                        }`}
                      >
                        {/* Nome + email */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                              <span className="text-sm font-semibold text-green-700">
                                {prof.usuario.nome.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {prof.usuario.nome}
                              </p>
                              <p className="text-xs text-gray-400">{prof.usuario.email}</p>
                              {prof.usuario.matricula && (
                                <p className="text-xs text-gray-300 font-mono">
                                  {prof.usuario.matricula}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Titulação */}
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              TITULACAO_COR[prof.titulacao] ?? "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {TITULACAO_LABEL[prof.titulacao] ?? prof.titulacao}
                          </span>
                        </td>

                        {/* Carga horária */}
                        <td className="px-4 py-4 text-center">
                          <span className="text-sm text-gray-700">
                            {prof.cargaHorariaMax}h
                          </span>
                        </td>

                        {/* Disciplinas */}
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                            {prof.disciplinas.length}
                          </span>
                        </td>

                        {/* Alocações */}
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-xs font-medium text-blue-600">
                            {prof._count.alocacoes}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              prof.ativo
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                prof.ativo ? "bg-green-500" : "bg-gray-400"
                              }`}
                            />
                            {prof.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => abrirEdicao(prof)}
                              title="Editar"
                              className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>

                            {prof.ativo ? (
                              <button
                                onClick={() => abrirDesativar(prof)}
                                title="Desativar"
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={() => reativar(prof)}
                                title="Reativar"
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {meta.totalPaginas > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Mostrando {(meta.pagina - 1) * meta.porPagina + 1}–
                    {Math.min(meta.pagina * meta.porPagina, meta.total)} de {meta.total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      disabled={pagina === 1}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Anterior
                    </button>
                    {Array.from({ length: meta.totalPaginas }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === meta.totalPaginas ||
                          Math.abs(p - pagina) <= 1
                      )
                      .reduce<(number | "...")[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1)
                          acc.push("...");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === "..." ? (
                          <span key={`dots-${i}`} className="px-2 text-gray-400 text-sm">
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPagina(p as number)}
                            className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                              pagina === p
                                ? "bg-green-700 text-white"
                                : "text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <button
                      onClick={() => setPagina((p) => Math.min(meta.totalPaginas, p + 1))}
                      disabled={pagina === meta.totalPaginas}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modais */}
      <ProfessorModal
        aberto={modalAberto}
        professor={professorEditando}
        onFechar={() => setModalAberto(false)}
        onSalvo={carregar}
      />

      {desativarModalAberto && professorDesativando && (
        <DesativarModal
          aberto={desativarModalAberto}
          nomeProfessor={professorDesativando.usuario.nome}
          professorId={professorDesativando.id}
          onFechar={() => setDesativarModalAberto(false)}
          onDesativado={carregar}
        />
      )}
    </div>
  );
}
