import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { DiaSemana } from '@prisma/client'

// ─── CORREÇÃO DE BUG – Sprint 5 ───────────────────────────────────────────────
// Issue: Erro "Unexpected token '<', "<!DOCTYPE"" ao editar disponibilidade
// Causa: Falta de try/catch causava exceções não capturadas → erro 500 com HTML
// Resultado: Frontend recebia HTML ao invés de JSON → response.json() falhava
// Solução: Adicionado try/catch em GET e PUT com tratamento de erro JSON
// ────────────────────────────────────────────────────────────────────────────

const DIAS: DiaSemana[] = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']

const itemSchema = z.object({
  diaSemana: z.enum(['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']),
  blocoId: z.string().min(1),
  disponivel: z.boolean(),
})

const bodySchema = z.object({
  disponibilidades: z.array(itemSchema),
  motivo: z.string().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  }

  try {
    const professor = await prisma.professor.findUnique({
      where: { id },
      include: { usuario: true },
    })
    if (!professor) {
      return NextResponse.json({ error: 'Professor nao encontrado' }, { status: 404 })
    }

    const [blocos, registros] = await Promise.all([
      prisma.blocoHorario.findMany({ orderBy: [{ turno: 'asc' }, { ordem: 'asc' }] }),
      prisma.disponibilidadeBloco.findMany({ where: { professorId: id } }),
    ])

    const disponiveis = new Set(registros.filter((r) => r.disponivel).map((r) => `${r.diaSemana}-${r.blocoId}`))
    const grade = DIAS.flatMap((diaSemana) =>
      blocos.map((bloco) => ({
        diaSemana,
        blocoId: bloco.id,
        disponivel: disponiveis.has(`${diaSemana}-${bloco.id}`),
      }))
    )

    return NextResponse.json({
      professor: {
        id: professor.id,
        nome: professor.usuario.nome,
        titulacao: professor.titulacao,
        tipo: professor.tipo,
        cargaHorariaMax: professor.cargaHorariaMax,
      },
      blocos,
      grade,
    })
  } catch (error) {
    console.error('[GET /api/professores/[id]/disponibilidade] Erro:', error)
    return NextResponse.json({ error: 'Erro ao carregar disponibilidades' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil === 'ALUNO') {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 403 })
  }

  try {
    const professor = await prisma.professor.findUnique({ where: { id } })
    if (!professor) {
      return NextResponse.json({ error: 'Professor nao encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados invalidos', detalhes: parsed.error.flatten() }, { status: 400 })
    }

    const blocos = await prisma.blocoHorario.findMany({ select: { id: true } })
    const blocoIds = new Set(blocos.map((b) => b.id))
    const novosDisponiveis = parsed.data.disponibilidades.filter((d) => d.disponivel && blocoIds.has(d.blocoId))

    const anteriores = await prisma.disponibilidadeBloco.findMany({
      where: { professorId: id, disponivel: true },
    })
    const chaveAnterior = new Set(anteriores.map((d) => `${d.diaSemana}-${d.blocoId}`))
    const chaveNova = new Set(novosDisponiveis.map((d) => `${d.diaSemana}-${d.blocoId}`))
    const adicionados = [...chaveNova].filter((k) => !chaveAnterior.has(k)).length
    const removidos = [...chaveAnterior].filter((k) => !chaveNova.has(k)).length

    await prisma.$transaction(async (tx) => {
      await tx.disponibilidadeBloco.deleteMany({ where: { professorId: id } })
      if (novosDisponiveis.length > 0) {
        await tx.disponibilidadeBloco.createMany({
          data: novosDisponiveis.map((d) => ({
            professorId: id,
            blocoId: d.blocoId,
            diaSemana: d.diaSemana,
            disponivel: true,
          })),
          skipDuplicates: true,
        })
      }

      await tx.logAlteracao.create({
        data: {
          usuarioId: session.user.id,
          entidade: 'Professor',
          entidadeId: id,
          campo: 'disponibilidadeGrade',
          valorAntes: `${anteriores.length} blocos disponiveis`,
          valorDepois: `${novosDisponiveis.length} blocos disponiveis (+${adicionados} / -${removidos})`,
          motivo: parsed.data.motivo ?? 'Atualizacao em lote da grade de disponibilidade',
        },
      })
    })

    return NextResponse.json({
      ok: true,
      total: novosDisponiveis.length,
      adicionados,
      removidos,
    })
  } catch (error) {
    console.error('[PUT /api/professores/[id]/disponibilidade] Erro:', error)
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao atualizar disponibilidades' }, { status: 500 })
  }
}
