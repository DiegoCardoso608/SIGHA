'use client'

import { useAuth } from '@/hooks/useAuth'

export default function DashboardPage() {
  const { session } = useAuth()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Bem-vindo, {session?.user?.name}!
        </h1>
        <p className="text-gray-600 mt-2">
          Sistema de Gestão e Horários Acadêmicos
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-600 text-sm font-medium">Professores</h3>
          <p className="text-2xl font-bold text-primary mt-2">—</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-600 text-sm font-medium">Disciplinas</h3>
          <p className="text-2xl font-bold text-primary mt-2">—</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-600 text-sm font-medium">Turmas</h3>
          <p className="text-2xl font-bold text-primary mt-2">—</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-600 text-sm font-medium">Alocações</h3>
          <p className="text-2xl font-bold text-primary mt-2">—</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
        <h2 className="font-semibold text-blue-900">ℹ️ Próximos passos</h2>
        <ul className="list-disc list-inside text-blue-900 text-sm mt-2 space-y-1">
          <li>Cadastre os professores</li>
          <li>Configure as disciplinas</li>
          <li>Registre as turmas</li>
          <li>Gere as alocações automáticas</li>
        </ul>
      </div>
    </div>
  )
}
