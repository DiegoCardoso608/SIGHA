import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { gerarGrade } from '@/lib/algoritmo'

/**
 * Endpoint responsável por disparar a geração automática de grade para turmas.
 *
 * Requer autenticação e permissões de administrador ou coordenador.
 */

const schema = z.object({
  periodoLetivoId: z.string().min(1, 'Periodo letivo obrigatorio'),
  turmaIds: z.array(z.string()).optional(),
  substituirExistentes: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const perfil = session.user.perfil
  if (perfil !== 'ADMIN' && perfil !== 'COORDENADOR') {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', detalhes: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    const resultado = await gerarGrade(parsed.data)
    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[POST /api/grade/gerar]', error)
    return NextResponse.json({ error: 'Erro ao gerar grade' }, { status: 500 })
  }
}
