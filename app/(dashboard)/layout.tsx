'use client'

import { signOut } from 'next-auth/react'
import { useAuth } from '@/hooks/useAuth'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-primary">SIGHA</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {session?.user?.name || session?.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="px-4 py-2 text-sm text-gray-700 hover:text-primary transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm border-r border-gray-200 p-6">
          <nav className="space-y-2">
            <a
              href="/dashboard"
              className="block px-4 py-2 text-gray-700 hover:bg-primary-bg hover:text-primary rounded-lg transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/professores"
              className="block px-4 py-2 text-gray-700 hover:bg-primary-bg hover:text-primary rounded-lg transition-colors"
            >
              Professores
            </a>
            <a
              href="/disciplinas"
              className="block px-4 py-2 text-gray-700 hover:bg-primary-bg hover:text-primary rounded-lg transition-colors"
            >
              Disciplinas
            </a>
            <a
              href="/turmas"
              className="block px-4 py-2 text-gray-700 hover:bg-primary-bg hover:text-primary rounded-lg transition-colors"
            >
              Turmas
            </a>
            <a
              href="/disponibilidades"
              className="block px-4 py-2 text-gray-700 hover:bg-primary-bg hover:text-primary rounded-lg transition-colors"
            >
              Disponibilidades
            </a>
            <hr className="my-2" />
            <a
              href="/grade"
              className="block px-4 py-2 text-gray-700 hover:bg-primary-bg hover:text-primary rounded-lg transition-colors font-medium"
            >
              Grade
            </a>
            <a
              href="/alocacoes"
              className="block px-4 py-2 text-gray-700 hover:bg-primary-bg hover:text-primary rounded-lg transition-colors"
            >
              Alocações
            </a>
          </nav>
        </aside>

        {/* Page Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
