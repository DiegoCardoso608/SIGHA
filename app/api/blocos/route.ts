import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })

  const blocos = await prisma.blocoHorario.findMany({
    orderBy: [{ turno: 'asc' }, { ordem: 'asc' }],
  })

  return NextResponse.json({ blocos })
}
