import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { marcarAulaFixa } from '@/lib/grade-manual.service'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const perfil = session.user.perfil
  if (perfil !== 'ADMIN' && perfil !== 'COORDENADOR') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const resultado = await marcarAulaFixa(id)
  if (!resultado.sucesso) {
    const detalhes = resultado.erros ?? ['Erro ao fixar alocação']
    return NextResponse.json({ error: detalhes[0], detalhes }, { status: 422 })
  }

  return NextResponse.json({ alocacao: resultado.alocacao })
}
