import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import type { DiaSemana } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { simularAlocacao } from '@/lib/algoritmo'

const schema = z.object({
  alocacaoId: z.string().optional(),
  turmaId: z.string().min(1),
  disciplinaId: z.string().min(1),
  professorId: z.string().min(1),
  blocoId: z.string().min(1),
  diaSemana: z.enum(['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

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
    const resultado = await simularAlocacao({
      ...parsed.data,
      diaSemana: parsed.data.diaSemana as DiaSemana,
    })
    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[POST /api/grade/simular]', error)
    return NextResponse.json({ error: 'Erro ao simular alocacao' }, { status: 500 })
  }
}
