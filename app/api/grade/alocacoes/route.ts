import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { criarAlocacaoManual } from '@/lib/grade-manual.service'

const diaSemanaSchema = z.enum(['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'])

const schema = z.object({
  turmaId: z.string().min(1),
  disciplinaId: z.string().min(1),
  professorId: z.string().nullable().optional(),
  blocoId: z.string().min(1),
  diaSemana: diaSemanaSchema,
  online: z.boolean().optional().default(false),
  fixa: z.boolean().optional().default(false),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const turmaId = searchParams.get('turmaId')

  const alocacoes = await prisma.alocacao.findMany({
    where: turmaId ? { turmaId } : {},
    include: {
      turma: true,
      disciplina: true,
      professor: { include: { usuario: { select: { nome: true, email: true } } } },
      bloco: true,
    },
    orderBy: [{ diaSemana: 'asc' }, { bloco: { ordem: 'asc' } }],
  })

  return NextResponse.json({ alocacoes })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const perfil = session.user.perfil
  if (perfil !== 'ADMIN' && perfil !== 'COORDENADOR') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', detalhes: parsed.error.flatten().fieldErrors },
      { status: 422 }
    )
  }

  const resultado = await criarAlocacaoManual(parsed.data)
  if (!resultado.sucesso) {
    const detalhes = resultado.erros ?? ['Erro ao criar alocação manual']
    return NextResponse.json({ error: detalhes[0], detalhes }, { status: 422 })
  }

  return NextResponse.json({ alocacao: resultado.alocacao }, { status: 201 })
}
