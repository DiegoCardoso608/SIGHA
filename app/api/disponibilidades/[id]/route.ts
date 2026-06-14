import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const updateSchema = z.object({
  disponivel: z.boolean(),
  motivo: z.string().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil === 'ALUNO') {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 403 })
  }

  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', detalhes: parsed.error.flatten() }, { status: 400 })
  }

  const existente = await prisma.disponibilidadeBloco.findUnique({
    where: { id },
    include: { bloco: true },
  })
  if (!existente) {
    return NextResponse.json({ error: 'Registro nao encontrado' }, { status: 404 })
  }

  const atualizado = await prisma.$transaction(async (tx) => {
    const reg = await tx.disponibilidadeBloco.update({
      where: { id },
      data: { disponivel: parsed.data.disponivel },
    })

    await tx.logAlteracao.create({
      data: {
        usuarioId: session.user.id,
        entidade: 'DisponibilidadeBloco',
        entidadeId: id,
        campo: `disponibilidade:${existente.diaSemana}:${existente.bloco.inicio}`,
        valorAntes: existente.disponivel ? 'disponivel' : 'indisponivel',
        valorDepois: parsed.data.disponivel ? 'disponivel' : 'indisponivel',
        motivo: parsed.data.motivo ?? null,
      },
    })

    return reg
  })

  return NextResponse.json(atualizado)
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil === 'ALUNO') {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 403 })
  }

  const existente = await prisma.disponibilidadeBloco.findUnique({
    where: { id },
    include: { bloco: true },
  })
  if (!existente) {
    return NextResponse.json({ error: 'Registro nao encontrado' }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.disponibilidadeBloco.delete({ where: { id } })

    await tx.logAlteracao.create({
      data: {
        usuarioId: session.user.id,
        entidade: 'DisponibilidadeBloco',
        entidadeId: id,
        campo: `disponibilidade:${existente.diaSemana}:${existente.bloco.inicio}`,
        valorAntes: existente.disponivel ? 'disponivel' : 'indisponivel',
        valorDepois: 'removido',
        motivo: 'Remocao de registro de disponibilidade',
      },
    })
  })

  return NextResponse.json({ ok: true })
}
