// src/app/api/professores/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const atualizarSchema = z.object({
  nome: z.string().min(3).optional(),
  email: z.string().email().optional(),
  titulacao: z.string().optional(),
  cargaHorariaMax: z.number().min(1).max(60).optional(),
  ativo: z.boolean().optional(),
  disciplinaIds: z.array(z.string()).optional(),
  disponibilidades: z
    .array(
      z.object({
        diaSemana: z.enum(['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']),
        turno: z.enum(['MANHA', 'TARDE', 'NOITE']),
      })
    )
    .optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const professor = await prisma.professor.findUnique({
    where: { id: params.id },
    include: {
      usuario: true,
      disciplinas: {
        include: { disciplina: { select: { id: true, nome: true, codigo: true } } },
      },
      disponibilidades: true,
      alocacoes: {
        include: {
          disciplina: { select: { nome: true } },
          turma: { select: { nome: true, codigo: true } },
          bloco: true,
        },
        orderBy: [{ diaSemana: 'asc' }],
      },
    },
  })

  if (!professor) {
    return NextResponse.json({ error: 'Professor não encontrado' }, { status: 404 })
  }

  const resultado = {
    id: professor.id,
    nome: professor.usuario.nome,
    email: professor.usuario.email,
    matricula: professor.usuario.matricula,
    titulacao: professor.titulacao,
    cargaHorariaMax: professor.cargaHorariaMax,
    ativo: professor.ativo,
    criadoEm: professor.criadoEm,
    disciplinas: professor.disciplinas,
    disponibilidades: professor.disponibilidades,
    alocacoes: professor.alocacoes,
  }

  return NextResponse.json({ data: resultado })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = atualizarSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const professorAtual = await prisma.professor.findUnique({
    where: { id: params.id },
    include: { usuario: true },
  })
  if (!professorAtual) {
    return NextResponse.json({ error: 'Professor não encontrado' }, { status: 404 })
  }

  const { disciplinaIds, disponibilidades, ...dadosBase } = parsed.data

  const professor = await prisma.$transaction(async (tx) => {
    // Atualiza dados do professor
    const prof = await tx.professor.update({
      where: { id: params.id },
      data: {
        ...(dadosBase.titulacao && { titulacao: dadosBase.titulacao }),
        ...(dadosBase.cargaHorariaMax && { cargaHorariaMax: dadosBase.cargaHorariaMax }),
        ...(dadosBase.ativo !== undefined && { ativo: dadosBase.ativo }),
      },
    })

    // Atualiza dados do usuário se necessário
    if (dadosBase.nome || dadosBase.email) {
      await tx.usuario.update({
        where: { id: professorAtual.usuarioId },
        data: {
          ...(dadosBase.nome && { nome: dadosBase.nome }),
          ...(dadosBase.email && { email: dadosBase.email }),
        },
      })
    }

    // Atualiza disciplinas (substitui tudo)
    if (disciplinaIds !== undefined) {
      await tx.professorDisciplina.deleteMany({ where: { professorId: params.id } })
      if (disciplinaIds.length > 0) {
        await tx.professorDisciplina.createMany({
          data: disciplinaIds.map((id) => ({ professorId: params.id, disciplinaId: id })),
        })
      }
    }

    // Atualiza disponibilidades (substitui tudo)
    if (disponibilidades !== undefined) {
      await tx.disponibilidade.deleteMany({ where: { professorId: params.id } })
      if (disponibilidades.length > 0) {
        await tx.disponibilidade.createMany({
          data: disponibilidades.map((d) => ({ ...d, professorId: params.id })),
        })
      }
    }

    return prof
  })

  // Auditoria
  await prisma.logAlteracao.create({
    data: {
      usuarioId: session.user.id,
      entidade: 'Professor',
      entidadeId: params.id,
      valorAntes: JSON.stringify(professorAtual),
      valorDepois: JSON.stringify(dadosBase),
    },
  })

  return NextResponse.json({ data: professor })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Soft delete — nunca apaga de verdade
  const professor = await prisma.professor.update({
    where: { id: params.id },
    data: { ativo: false },
  })

  await prisma.logAlteracao.create({
    data: {
      usuarioId: session.user.id,
      entidade: 'Professor',
      entidadeId: params.id,
      valorAntes: JSON.stringify({ ativo: true }),
      valorDepois: JSON.stringify({ ativo: false }),
    },
  })

  return NextResponse.json({ data: professor })
}
