import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const termosOnline = ['EXTENSAO', 'ESTAGIO', 'AVA', 'DOL']

function removerAcentos(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
}

function deveSerOnline(nome: string) {
  const nomeNormalizado = removerAcentos(nome)
  return termosOnline.some((termo) => nomeNormalizado.includes(termo))
}

async function main() {
  console.log('🌱 Sprint 7 — Classificando modalidade das disciplinas existentes...')

  const disciplinas = await prisma.disciplina.findMany({
    select: {
      id: true,
      nome: true,
      modalidade: true,
    },
  })

  for (const disciplina of disciplinas) {
    const modalidade = deveSerOnline(disciplina.nome) ? 'ONLINE' : 'PRESENCIAL'

    if (disciplina.modalidade !== modalidade) {
      await prisma.disciplina.update({
        where: { id: disciplina.id },
        data: { modalidade },
      })
      console.log(`✓ ${disciplina.nome} => ${modalidade}`)
    }
  }

  console.log('✅ Classificação de modalidade concluída.')
}

main()
  .catch((error) => {
    console.error('❌ Erro na classificação de modalidade:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
