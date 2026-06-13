// src/app/api/professores/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const professorSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  matricula: z.string().min(3, 'Matrícula obrigatória'),
  titulacao: z.string().min(1, 'Titulação obrigatória'),
  cargaHorariaMax: z.number().min(1).max(60),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres').optional(),
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const busca = searchParams.get('busca') || ''
  const pagina = parseInt(searchParams.get('pagina') || '1')
  const limite = parseInt(searchParams.get('limite') || '20')
  const skip = (pagina - 1) * limite

  const where = busca
    ? {
        OR: [
          { usuario: { nome: { contains: busca, mode: 'insensitive' as const } } },
          { usuario: { email: { contains: busca, mode: 'insensitive' as const } } },
          { usuario: { matricula: { contains: busca, mode: 'insensitive' as const } } },
        ],
        ativo: true,
      }
    : { ativo: true }

  const [profs, total] = await Promise.all([
    prisma.professor.findMany({
      where,
      skip,
      take: limite,
      include: {
        usuario: true,
        disciplinas: {
          include: { disciplina: { select: { id: true, nome: true, codigo: true } } },
        },
        disponibilidades: true,
        _count: { select: { alocacoes: true } },
      },
      orderBy: { usuario: { nome: 'asc' } },
    }),
    prisma.professor.count({ where }),
  ])

  const professores = profs.map((p) => ({
    id: p.id,
    nome: p.usuario.nome,
    email: p.usuario.email,
    matricula: p.usuario.matricula,
    titulacao: p.titulacao,
    cargaHorariaMax: p.cargaHorariaMax,
    ativo: p.ativo,
    criadoEm: p.criadoEm,
    disciplinas: p.disciplinas,
    disponibilidades: p.disponibilidades,
    _count: p._count,
  }))

  return NextResponse.json({
    data: professores,
    meta: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = professorSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', detalhes: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { nome, email, matricula, titulacao, cargaHorariaMax, senha, disciplinaIds, disponibilidades } =
    parsed.data

  const usuarioExistente = await prisma.usuario.findUnique({ where: { email } })
  if (usuarioExistente) {
    return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
  }

  const senhaHash = await bcrypt.hash(senha || 'sigha@2026', 10)

  const professor = await prisma.professor.create({
    data: {
      usuario: {
        create: {
          nome,
          email,
          matricula,
          senhaHash,
          perfil: 'PROFESSOR',
        },
      },
      titulacao,
      cargaHorariaMax,
      disciplinas: disciplinaIds
        ? { create: disciplinaIds.map((id) => ({ disciplinaId: id })) }
        : undefined,
      disponibilidades: disponibilidades ? { create: disponibilidades } : undefined,
    },
    include: {
      usuario: true,
      disciplinas: { include: { disciplina: true } },
      disponibilidades: true,
    },
  })

  // Registrar auditoria
  await prisma.logAlteracao.create({
    data: {
      usuarioId: session.user.id,
      entidade: 'Professor',
      entidadeId: professor.id,
      valorDepois: JSON.stringify({ nome, email, matricula }),
    },
  })

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
  }

  return NextResponse.json({ data: resultado }, { status: 201 })
}
