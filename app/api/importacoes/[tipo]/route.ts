import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { executarImportacao } from '@/lib/importacao/import-engine'
import { PrismaImportRepository } from '@/lib/importacao/prisma-repository'
import { professorImportStrategy } from '@/lib/importacao/strategies/professor'
import { disciplinaImportStrategy } from '@/lib/importacao/strategies/disciplina'
import { turmaImportStrategy } from '@/lib/importacao/strategies/turma'
import type { ImportStrategy } from '@/lib/importacao/types'

const strategyMap: Record<string, ImportStrategy<Record<string, unknown>>> = {
  PROFESSOR: professorImportStrategy,
  DISCIPLINA: disciplinaImportStrategy,
  TURMA: turmaImportStrategy,
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tipo } = await params
  const strategy = strategyMap[tipo as keyof typeof strategyMap]

  if (!strategy) {
    return NextResponse.json({ error: 'Tipo de importação inválido' }, { status: 400 })
  }

  const formData = await request.formData()
  const arquivo = formData.get('arquivo')
  const confirmar = formData.get('confirmar') === 'true'

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const repo = new PrismaImportRepository()

  try {
    const relatorio = await executarImportacao(
      buffer,
      strategy,
      repo,
      {
        tipo: strategy.tipo,
        nomeArquivo: arquivo.name,
        apenasSimular: !confirmar,
      }
    )

    return NextResponse.json(relatorio, { status: 200 })
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : 'Não foi possível processar o arquivo Excel. Verifique se o formato está correto.'

    return NextResponse.json(
      {
        error:
          mensagem.includes('planilha') || mensagem.includes('Excel')
            ? mensagem
            : `Arquivo Excel inválido ou incompatível com o tipo de importação selecionado. Detalhe: ${mensagem}`,
      },
      { status: 400 }
    )
  }
}
