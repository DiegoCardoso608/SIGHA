import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { editarAlocacao, removerAlocacao } from '@/lib/grade-manual.service'

const schema = z.object({
  disciplinaId: z.string().optional(),
  professorId: z.string().nullable().optional(),
  blocoId: z.string().optional(),
  diaSemana: z.enum(['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']).optional(),
  online: z.boolean().optional(),
  status: z.enum(['PENDENTE', 'CONFIRMADA', 'CONFLITO']).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const alocacao = await prisma.alocacao.findUnique({
    where: { id },
    include: {
      turma: true,
      disciplina: true,
      professor: { include: { usuario: { select: { nome: true, email: true } } } },
      bloco: true,
    },
  })

  if (!alocacao) {
    return NextResponse.json({ error: 'Alocação não encontrada' }, { status: 404 })
  }

  return NextResponse.json({ alocacao })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const perfil = session.user.perfil
  if (perfil !== 'ADMIN' && perfil !== 'COORDENADOR') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
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

  const resultado = await editarAlocacao(id, parsed.data)
  if (!resultado.sucesso) {
    const detalhes = resultado.erros ?? ['Erro ao editar alocação']
    return NextResponse.json({ error: detalhes[0], detalhes }, { status: 422 })
  }

  return NextResponse.json({ alocacao: resultado.alocacao })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const perfil = session.user.perfil
  if (perfil !== 'ADMIN' && perfil !== 'COORDENADOR') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { id } = await params
  const resultado = await removerAlocacao(id)
  if (!resultado.sucesso) {
    const detalhes = resultado.erros ?? ['Erro ao remover alocação']
    return NextResponse.json({ error: detalhes[0], detalhes }, { status: 422 })
  }

  return NextResponse.json({ mensagem: 'Alocação removida com sucesso' })
}
