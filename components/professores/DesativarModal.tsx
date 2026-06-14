"use client";

// components/professores/DesativarModal.tsx
import { useState } from "react";

interface DesativarModalProps {
  aberto: boolean;
  nomeProfessor: string;
  professorId: string;
  onFechar: () => void;
  onDesativado: () => void;
}

export function DesativarModal({
  aberto,
  nomeProfessor,
  professorId,
  onFechar,
  onDesativado,
}: DesativarModalProps) {
  const [motivo, setMotivo] = useState("");
  const [desativando, setDesativando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) return null;

  const confirmar = async () => {
    setDesativando(true);
    setErro(null);

    try {
      const res = await fetch(`/api/professores/${professorId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo || "Desativação pelo coordenador" }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErro(json.error ?? "Não foi possível desativar o professor");
        return;
      }

      onDesativado();
      onFechar();
      setMotivo("");
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setDesativando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onFechar} />
      <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Desativar professor</h3>
            <p className="text-sm text-gray-500 mt-1">
              Você está prestes a desativar <strong>{nomeProfessor}</strong>. O professor perderá o acesso ao sistema, mas seus dados históricos serão mantidos.
            </p>
          </div>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
            {erro}
          </div>
        )}

        <div className="mb-5">
          <label className="block text-sm text-gray-600 mb-1">
            Motivo da desativação <span className="text-gray-400">(opcional)</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
            placeholder="Ex: Professor encerrou contrato"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onFechar}
            disabled={desativando}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={desativando}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {desativando && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {desativando ? "Desativando..." : "Desativar professor"}
          </button>
        </div>
      </div>
    </div>
  );
}
