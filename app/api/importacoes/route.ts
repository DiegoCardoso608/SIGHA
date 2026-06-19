import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get('tipo') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '10')))
  const skip = (page - 1) * limit

  const where = tipo ? { tipo } : {}

  const [importacoes, total] = await Promise.all([
    prisma.importacao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip,
      take: limit,
    }),
    prisma.importacao.count({ where }),
  ])

  return NextResponse.json({
    data: importacoes,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  })
}
