import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const resetSchema = z.object({
  alvo: z.enum(['PROFESSOR', 'DISCIPLINA', 'TURMA', 'TODOS']),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = resetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Alvo inválido para reset.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { alvo } = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      await tx.alocacao.deleteMany({})

      if (alvo === 'PROFESSOR' || alvo === 'TODOS') {
        await tx.disponibilidadeBloco.deleteMany({})
        await tx.disponibilidade.deleteMany({})
        await tx.professorDisciplina.deleteMany({})
        await tx.professor.deleteMany({})
        await tx.usuario.deleteMany({
          where: { perfil: 'PROFESSOR' },
        })
      }

      if (alvo === 'DISCIPLINA' || alvo === 'TODOS') {
        await tx.cursoDisciplina.deleteMany({})
        await tx.disciplina.deleteMany({})
      }

      if (alvo === 'TURMA' || alvo === 'TODOS') {
        await tx.turma.deleteMany({})
      }
    })

    return NextResponse.json({
      success: true,
      message: `Dados resetados com sucesso para ${alvo}.`,
    })
  } catch (erro) {
    return NextResponse.json(
      {
        error:
          erro instanceof Error
            ? erro.message
            : 'Não foi possível resetar os dados.',
      },
      { status: 500 }
    )
  }
}
