// app/api/grade/gerar-curso/route.ts
// Sprint 5.5 — Endpoint de geração global da grade por curso

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { gerarGradeCurso } from '@/lib/algoritmo'
import { z } from 'zod'

const bodySchema = z.object({
  cursoId: z.string().min(1, 'cursoId é obrigatório'),
  periodoLetivoId: z.string().min(1, 'periodoLetivoId é obrigatório'),
  substituirExistentes: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (session.user.perfil !== 'ADMIN' && session.user.perfil !== 'COORDENADOR') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = bodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', detalhes: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const resultado = await gerarGradeCurso(parsed.data)

    return NextResponse.json(resultado, { status: 200 })
  } catch (error) {
    console.error('[POST /api/grade/gerar-curso]', error)

    if (error instanceof Error && error.message.includes('não encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ error: 'Erro interno ao gerar grade' }, { status: 500 })
  }
}
