// prisma/seed-patch-sprint3.ts
// Execute APÓS a migration:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-patch-sprint3.ts
//
// O que faz:
//   1. Cria os períodos letivos 2026.1 e 2026.2
//   2. Vincula as turmas existentes ao período letivo correto
//   3. Remove o campo semestre das turmas (via Prisma — a migration SQL já deve ter removido a coluna)

import 'dotenv/config'

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, StatusPeriodoLetivo } from '@prisma/client'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seed Patch Sprint 3 — Períodos Letivos')

  // ── 1. Criar períodos letivos ────────────────────────────────────────────────

  const periodo2026_1 = await prisma.periodoLetivo.upsert({
    where: { ano_semestre: { ano: 2026, semestre: 1 } },
    update: {},
    create: {
      ano: 2026,
      semestre: 1,
      descricao: '2026.1',
      dataInicio: new Date('2026-02-10'),
      dataFim: new Date('2026-06-30'),
      status: StatusPeriodoLetivo.ATIVO,
    },
  })
  console.log(`✅ Período letivo criado: ${periodo2026_1.descricao}`)

  const periodo2026_2 = await prisma.periodoLetivo.upsert({
    where: { ano_semestre: { ano: 2026, semestre: 2 } },
    update: {},
    create: {
      ano: 2026,
      semestre: 2,
      descricao: '2026.2',
      dataInicio: new Date('2026-08-03'),
      dataFim: new Date('2026-12-15'),
      status: StatusPeriodoLetivo.PLANEJAMENTO,
    },
  })
  console.log(`✅ Período letivo criado: ${periodo2026_2.descricao}`)

  // ── 2. Vincular turmas existentes ────────────────────────────────────────────
  // As 3 turmas do seed original usam semestre "2026.1"
  // Períodos ímpares (1º, 3º, 5º, 7º) → 2026.1
  // Períodos pares (2º, 4º, 6º, 8º)   → 2026.2

  const turmas = await prisma.turma.findMany()

  for (const turma of turmas) {
    // Inferir o período letivo correto baseado no período da matriz curricular
    const isImpar = turma.periodo % 2 !== 0
    const periodoLetivoId = isImpar ? periodo2026_1.id : periodo2026_2.id

    await prisma.turma.update({
      where: { id: turma.id },
      data: { periodoLetivoId },
    })
    console.log(`🔗 Turma "${turma.codigo}" vinculada a ${isImpar ? '2026.1' : '2026.2'}`)
  }

  // ── 3. Criar turmas de exemplo adicionais para o período 2026.2 ─────────────

  const curso = await prisma.curso.findFirst()
  if (curso) {
    const turmasPares = [
      {
        codigo: 'CC-2026.2-2A',
        nome: 'Ciência da Computação — 2º Período A',
        cursoId: curso.id,
        periodoLetivoId: periodo2026_2.id,
        periodo: 2,
        turno: 'NOITE' as const,
      },
      {
        codigo: 'CC-2026.2-4A',
        nome: 'Ciência da Computação — 4º Período A',
        cursoId: curso.id,
        periodoLetivoId: periodo2026_2.id,
        periodo: 4,
        turno: 'NOITE' as const,
      },
    ]

    for (const t of turmasPares) {
      await prisma.turma.upsert({
        where: {
          codigo_periodoLetivoId: {
            codigo: t.codigo,
            periodoLetivoId: t.periodoLetivoId,
          },
        },
        update: {},
        create: t,
      })
      console.log(`✅ Turma criada: ${t.codigo}`)
    }
  }

  console.log('\n✅ Seed patch Sprint 3 concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed patch:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
