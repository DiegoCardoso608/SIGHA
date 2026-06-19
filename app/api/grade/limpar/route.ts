import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  cursoId: z.string().min(1, 'cursoId é obrigatório'),
  periodoLetivoId: z.string().min(1, 'periodoLetivoId é obrigatório'),
})

export async function DELETE(request: NextRequest) {
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

    const { cursoId, periodoLetivoId } = parsed.data

    const curso = await prisma.curso.findUnique({ where: { id: cursoId } })
    const periodoLetivo = await prisma.periodoLetivo.findUnique({ where: { id: periodoLetivoId } })
    if (!curso || !periodoLetivo) {
      return NextResponse.json(
        { error: 'Curso ou período letivo não encontrado' },
        { status: 404 }
      )
    }

    const turmas = await prisma.turma.findMany({
      where: { cursoId, periodoLetivoId },
      select: { id: true },
    })

    if (turmas.length === 0) {
      return NextResponse.json({ removidas: 0 }, { status: 200 })
    }

    const turmaIds = turmas.map((t) => t.id)
    const { count } = await prisma.alocacao.deleteMany({
      where: {
        turmaId: { in: turmaIds },
      },
    })

    return NextResponse.json({ removidas: count }, { status: 200 })
  } catch (error) {
    console.error('[DELETE /api/grade/limpar]', error)
    return NextResponse.json({ error: 'Erro interno ao zerar grade' }, { status: 500 })
  }
}
