import 'dotenv/config'

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

function gerarMatricula(numero: number) {
  return numero.toString().padStart(8, '0')
}

async function main() {
  console.log('🌱 Iniciando seed do SIGHA...')

  // ─── Curso ───────────────────────────────────────────────────────────────
  const cc = await prisma.curso.upsert({
    where: { codigo: 'CC' },
    update: {},
    create: {
      codigo: 'CC',
      nome: 'Ciência da Computação',
      modalidade: 'PRESENCIAL',
      totalPeriodos: 8,
      ativo: true,
    },
  })
  console.log(`✓ Curso criado: ${cc.nome}`)

  // ─── Disciplinas ─────────────────────────────────────────────────────────
  const disciplinasData = [
    // 1º Período
    { codigo: 'GSER074000',  nome: 'Matemática Aplicada',                                               cargaHoraria: 60, periodo: 1 },
    { codigo: 'GSER169601',  nome: 'Lógica Matemática',                                                  cargaHoraria: 40, periodo: 1 },
    { codigo: 'GSER179400',  nome: 'Desenvolvimento Pessoal e Trabalhabilidade',                         cargaHoraria: 60, periodo: 1 },
    { codigo: 'GSER2048800', nome: 'Gestão de Times - Métodos Ágeis',                                   cargaHoraria: 60, periodo: 1 },
    { codigo: 'GSER2048900', nome: 'Design Centrado no Ser Humano',                                     cargaHoraria: 40, periodo: 1 },
    { codigo: 'GSER895101',  nome: 'Sistemas Computacionais',                                           cargaHoraria: 60, periodo: 1 },
    { codigo: 'GSER895302',  nome: 'Lógica de Programação',                                             cargaHoraria: 60, periodo: 1 },

    // 2º Período
    { codigo: 'GSER012200',  nome: 'Organização e Arquitetura de Computadores',                         cargaHoraria: 60, periodo: 2 },
    { codigo: 'GSER012801',  nome: 'Engenharia de Software',                                            cargaHoraria: 60, periodo: 2 },
    { codigo: 'GSER2049000', nome: 'UX/UI Design',                                                     cargaHoraria: 60, periodo: 2 },
    { codigo: 'GSER2049100', nome: 'Programação - Web Coding',                                         cargaHoraria: 60, periodo: 2 },
    { codigo: 'GSER895400',  nome: 'Banco de Dados',                                                   cargaHoraria: 60, periodo: 2 },
    { codigo: 'GSER898603',  nome: 'Programação Orientada a Objeto',                                   cargaHoraria: 40, periodo: 2 },
    { codigo: 'GSER898803',  nome: 'Estrutura de Dados',                                               cargaHoraria: 40, periodo: 2 },
    { codigo: 'GSER98851',   nome: 'Atividades Práticas Interdisciplinares de Extensão I',             cargaHoraria: 80, periodo: 2 },

    // 3º Período
    { codigo: 'GSER012500',  nome: 'Redes de Computadores',                                            cargaHoraria: 60, periodo: 3 },
    { codigo: 'GSER012700',  nome: 'Sistemas Operacionais',                                            cargaHoraria: 60, periodo: 3 },
    { codigo: 'GSER2000200', nome: 'Desenvolvimento Sustentável e Direitos Individuais',               cargaHoraria: 80, periodo: 3 },
    { codigo: 'GSER2049300', nome: 'Códigos de Alta Performance - Web',                               cargaHoraria: 60, periodo: 3 },
    { codigo: 'GSER2049400', nome: 'Database Application',                                            cargaHoraria: 60, periodo: 3 },
    { codigo: 'GSER2049500', nome: 'Programação - Mobile Coding',                                     cargaHoraria: 60, periodo: 3 },
    { codigo: 'GSER895900',  nome: 'Arquitetura de Software',                                         cargaHoraria: 40, periodo: 3 },

    // 4º Período
    { codigo: 'GSER2049600', nome: 'Códigos de Alta Performance - Mobile',                            cargaHoraria: 60, periodo: 4 },
    { codigo: 'GSER2049700', nome: 'Front-End Frameworks',                                            cargaHoraria: 60, periodo: 4 },
    { codigo: 'GSER2049800', nome: 'Back-End Frameworks',                                             cargaHoraria: 60, periodo: 4 },
    { codigo: 'GSER2049900', nome: 'Cloud Computing',                                                 cargaHoraria: 60, periodo: 4 },
    { codigo: 'GSER2050000', nome: 'Estatística e Probabilidade',                                     cargaHoraria: 60, periodo: 4 },
    { codigo: 'GSER2050100', nome: 'Maturidade em Desenvolvimento de Software',                       cargaHoraria: 40, periodo: 4 },
    { codigo: 'GSER98852',   nome: 'Atividades Práticas Interdisciplinares de Extensão II',           cargaHoraria: 80, periodo: 4 },

    // 5º Período
    { codigo: 'GSER002200',  nome: 'Empreendedorismo',                                                cargaHoraria: 60, periodo: 5 },
    { codigo: 'GSER184502',  nome: 'Storytelling',                                                    cargaHoraria: 40, periodo: 5 },
    { codigo: 'GSER187500',  nome: 'Design de Personagens',                                           cargaHoraria: 60, periodo: 5 },
    { codigo: 'GSER189701',  nome: 'Machine Learning',                                                cargaHoraria: 40, periodo: 5 },
    { codigo: 'GSER2050200', nome: 'Game Engine',                                                     cargaHoraria: 60, periodo: 5 },
    { codigo: 'GSER2050300', nome: 'Desenvolvimento de Games',                                        cargaHoraria: 60, periodo: 5 },
    { codigo: 'GSER902702',  nome: 'Engenharia de Requisitos',                                        cargaHoraria: 40, periodo: 5 },

    // 6º Período
    { codigo: 'GSER014001',  nome: 'Linguagens Formais e Autômatos',                                  cargaHoraria: 60, periodo: 6 },
    { codigo: 'GSER014101',  nome: 'Qualidade de Software',                                           cargaHoraria: 40, periodo: 6 },
    { codigo: 'GSER10000000',nome: 'Paradigmas de Programação',                                       cargaHoraria: 40, periodo: 6 },
    { codigo: 'GSER2050400', nome: 'Microprocessadores e Microcontroladores',                         cargaHoraria: 40, periodo: 6 },
    { codigo: 'GSER2050600', nome: 'Redes Neurais Artificiais',                                       cargaHoraria: 60, periodo: 6 },
    { codigo: 'GSER895602',  nome: 'Sistemas Multimídia',                                             cargaHoraria: 40, periodo: 6 },
    { codigo: 'GSER895603',  nome: 'Estágio Supervisionado I',                                        cargaHoraria: 40, periodo: 6 },
    { codigo: 'GSER98853',   nome: 'Atividades Práticas Interdisciplinares de Extensão III',          cargaHoraria: 80, periodo: 6 },

    // 7º Período
    { codigo: 'GSER001800',  nome: 'Compiladores',                                                    cargaHoraria: 60, periodo: 7 },
    { codigo: 'GSER006201',  nome: 'Metodologia da Pesquisa',                                         cargaHoraria: 40, periodo: 7 },
    { codigo: 'GSER013400',  nome: 'Teste de Software',                                               cargaHoraria: 60, periodo: 7 },
    { codigo: 'GSER2050700', nome: 'Infraestrutura de Datacenters',                                   cargaHoraria: 60, periodo: 7 },
    { codigo: 'GSER2050800', nome: 'Tópicos Integradores em Ciência da Computação',                   cargaHoraria: 60, periodo: 7 },
    { codigo: 'GSER895604',  nome: 'Estágio Supervisionado II',                                       cargaHoraria: 40, periodo: 7 },
    { codigo: 'GSER899700',  nome: 'Segurança da Informação',                                         cargaHoraria: 60, periodo: 7 },

    // 8º Período
    { codigo: 'GSER2051000', nome: 'Tópicos Avançados em Ciência da Computação',                      cargaHoraria: 60, periodo: 8 },
    { codigo: 'GSER2051100', nome: 'DevOps Tools',                                                    cargaHoraria: 60, periodo: 8 },
    { codigo: 'GSER2051200', nome: 'Fábrica de Software',                                             cargaHoraria: 60, periodo: 8 },
    { codigo: 'GSER98854',   nome: 'Atividades Práticas Interdisciplinares de Extensão IV',           cargaHoraria: 80, periodo: 8 },
  ]

  const disciplinas: Record<string, { id: string }> = {}

  for (const d of disciplinasData) {
    const disc = await prisma.disciplina.upsert({
      where: { codigo: d.codigo },
      update: {},
      create: {
        codigo: d.codigo,
        nome: d.nome,
        cargaHoraria: d.cargaHoraria,
        blocosSemanais: Math.max(1, Math.ceil(d.cargaHoraria / 20)),
        ativo: true,
      },
    })
    disciplinas[d.codigo] = disc

    // Vincula disciplina ao curso no período correto
    await prisma.cursoDisciplina.upsert({
      where: {
        cursoId_disciplinaId: {
          cursoId: cc.id,
          disciplinaId: disc.id,
        },
      },
      update: {},
      create: {
        cursoId: cc.id,
        disciplinaId: disc.id,
        periodo: d.periodo,
        obrigatoria: true,
      },
    })
  }
  console.log(`✓ ${disciplinasData.length} disciplinas criadas e vinculadas ao curso`)

  // ─── Configuração de horários ─────────────────────────────────────────────
  // Blocos de 50 minutos seguindo o padrão UNAMA visto nas imagens
  const blocos = [
    // Manhã
    { inicio: '08:00', fim: '08:50', turno: 'MANHA', ordem: 1 },
    { inicio: '08:50', fim: '09:40', turno: 'MANHA', ordem: 2 },
    { inicio: '09:40', fim: '10:30', turno: 'MANHA', ordem: 3 },
    { inicio: '10:30', fim: '11:20', turno: 'MANHA', ordem: 4 },
    { inicio: '11:20', fim: '12:10', turno: 'MANHA', ordem: 5 },
    // Tarde
    { inicio: '13:00', fim: '13:50', turno: 'TARDE', ordem: 1 },
    { inicio: '13:50', fim: '14:40', turno: 'TARDE', ordem: 2 },
    { inicio: '14:40', fim: '15:30', turno: 'TARDE', ordem: 3 },
    { inicio: '15:30', fim: '16:20', turno: 'TARDE', ordem: 4 },
    { inicio: '16:20', fim: '17:10', turno: 'TARDE', ordem: 5 },
    // Noite
    { inicio: '18:30', fim: '19:20', turno: 'NOITE', ordem: 1 },
    { inicio: '19:20', fim: '20:10', turno: 'NOITE', ordem: 2 },
    { inicio: '20:10', fim: '21:00', turno: 'NOITE', ordem: 3 },
    { inicio: '21:00', fim: '21:50', turno: 'NOITE', ordem: 4 },
  ]

  for (const b of blocos) {
    await prisma.blocoHorario.upsert({
      where: { inicio_turno: { inicio: b.inicio, turno: b.turno as any } },
      update: {},
      create: b as any,
    })
  }
  console.log(`✓ ${blocos.length} blocos de horário configurados`)

  // ─── Professores de exemplo ──────────────────────────────────────────────
  // Baseado nos nomes reais visíveis nas imagens do portal
  const professoresData = [
    {
      nome: 'Rodrigo Silva',
      email: 'rodrigo.silva@unama.br',
      titulacao: 'MESTRE',
      cargaHorariaMax: 20,
      disciplinas: ['GSER012801', 'GSER902702', 'GSER012500'], // Eng. Software, Eng. Requisitos, Redes
      disponibilidade: [
        { diaSemana: 'SEGUNDA', turno: 'MANHA' },
        { diaSemana: 'TERCA',   turno: 'MANHA' },
        { diaSemana: 'QUARTA',  turno: 'MANHA' },
        { diaSemana: 'QUINTA',  turno: 'MANHA' },
        { diaSemana: 'SEXTA',   turno: 'MANHA' },
      ],
    },
    {
      nome: 'Marcia Priscila Furtado Pantoja',
      email: 'marcia.pantoja@unama.br',
      titulacao: 'DOUTORA',
      cargaHorariaMax: 20,
      disciplinas: ['GSER013400', 'GSER014101', 'GSER012700'], // Teste Software, Qualidade, SO
      disponibilidade: [
        { diaSemana: 'SEGUNDA', turno: 'NOITE' },
        { diaSemana: 'QUARTA',  turno: 'NOITE' },
        { diaSemana: 'SEXTA',   turno: 'NOITE' },
        { diaSemana: 'SABADO',  turno: 'MANHA' },
      ],
    },
    {
      nome: 'Diego Medeiros de Abreu',
      email: 'diego.abreu@unama.br',
      titulacao: 'MESTRE',
      cargaHorariaMax: 16,
      tipo: 'SUBSTITUTO',
      disciplinas: ['GSER001800', 'GSER2050800', 'GSER189701'], // Compiladores, Tópicos, ML
      disponibilidade: [
        { diaSemana: 'QUARTA',  turno: 'NOITE' },
        { diaSemana: 'QUINTA',  turno: 'NOITE' },
        { diaSemana: 'SABADO',  turno: 'MANHA' },
      ],
    },
    {
      nome: 'Rodrigo Silva Marques',
      email: 'rodrigo.marques@unama.br',
      titulacao: 'ESPECIALISTA',
      cargaHorariaMax: 20,
      disciplinas: ['GSER012700', 'GSER2050700', 'GSER012500'], // SO, Datacenters, Redes
      disponibilidade: [
        { diaSemana: 'TERCA',   turno: 'MANHA' },
        { diaSemana: 'QUARTA',  turno: 'MANHA' },
        { diaSemana: 'QUINTA',  turno: 'MANHA' },
        { diaSemana: 'SEXTA',   turno: 'MANHA' },
      ],
    },
    {
      nome: 'Ana Lima',
      email: 'ana.lima@unama.br',
      titulacao: 'MESTRE',
      cargaHorariaMax: 20,
      tipo: 'RESERVA',
      disciplinas: ['GSER898603', 'GSER895302', 'GSER2049100'], // POO, Lógica Prog, Web Coding
      disponibilidade: [
        { diaSemana: 'SEGUNDA', turno: 'TARDE' },
        { diaSemana: 'TERCA',   turno: 'TARDE' },
        { diaSemana: 'QUARTA',  turno: 'TARDE' },
        { diaSemana: 'SABADO',  turno: 'MANHA' },
      ],
    },
  ]

  let contadorProf = 0
  for (const p of professoresData) {
    contadorProf++
    const senhaHash = await hash('unama@2026', 10)
    const matricula = gerarMatricula(1000 + contadorProf)

    const usuario = await prisma.usuario.upsert({
      where: { email: p.email },
      update: {},
      create: {
        matricula,
        nome: p.nome,
        email: p.email,
        senhaHash,
        perfil: 'PROFESSOR',
      },
    })

    const prof = await prisma.professor.upsert({
      where: { usuarioId: usuario.id },
      update: {},
      create: {
        usuarioId: usuario.id,
        titulacao: p.titulacao as any,
        cargaHorariaMax: p.cargaHorariaMax,
        tipo: (p as any).tipo ?? 'TITULAR',
      },
    })

    if ((p as any).tipo) {
      await prisma.professor.update({
        where: { id: prof.id },
        data: { tipo: (p as any).tipo },
      })
    }

    // Vincula disciplinas autorizadas
    for (const cod of p.disciplinas) {
      const disc = disciplinas[cod]
      if (!disc) continue
      await prisma.professorDisciplina.upsert({
        where: {
          professorId_disciplinaId: {
            professorId: prof.id,
            disciplinaId: disc.id,
          },
        },
        update: {},
        create: {
          professorId: prof.id,
          disciplinaId: disc.id,
        },
      })
    }

    // Cria disponibilidades
    for (const d of p.disponibilidade) {
      await prisma.disponibilidade.upsert({
        where: {
          professorId_diaSemana_turno: {
            professorId: prof.id,
            diaSemana: d.diaSemana as any,
            turno: d.turno as any,
          },
        },
        update: {},
        create: {
          professorId: prof.id,
          diaSemana: d.diaSemana as any,
          turno: d.turno as any,
        },
      })

      const blocosDoTurno = blocos.filter((b) => b.turno === d.turno)
      for (const bloco of blocosDoTurno) {
        const blocoDb = await prisma.blocoHorario.findUnique({
          where: { inicio_turno: { inicio: bloco.inicio, turno: bloco.turno as any } },
        })
        if (!blocoDb) continue

        await prisma.disponibilidadeBloco.upsert({
          where: {
            professorId_blocoId_diaSemana: {
              professorId: prof.id,
              blocoId: blocoDb.id,
              diaSemana: d.diaSemana as any,
            },
          },
          update: { disponivel: true },
          create: {
            professorId: prof.id,
            blocoId: blocoDb.id,
            diaSemana: d.diaSemana as any,
            disponivel: true,
          },
        })
      }
    }
  }
  console.log(`✓ ${professoresData.length} professores criados com disponibilidades`)

  // ─── Período letivo ───────────────────────────────────────────────────────
  const periodoLetivo20261 = await prisma.periodoLetivo.upsert({
    where: {
      ano_semestre: {
        ano: 2026,
        semestre: 1,
      },
    },
    update: {
      descricao: '2026.1',
      dataInicio: new Date('2026-01-01T00:00:00.000Z'),
      dataFim: new Date('2026-06-30T23:59:59.999Z'),
    },
    create: {
      ano: 2026,
      semestre: 1,
      descricao: '2026.1',
      dataInicio: new Date('2026-01-01T00:00:00.000Z'),
      dataFim: new Date('2026-06-30T23:59:59.999Z'),
      status: 'PLANEJAMENTO',
    },
  })
  console.log(`✓ Período letivo configurado: ${periodoLetivo20261.descricao}`)

  // ─── Turmas de exemplo (7º período — turma da imagem) ────────────────────
  const turmasData = [
    { codigo: 'CC-2026.1-7A', nome: 'CC 7º Período - Turma A', periodo: 7, turno: 'NOITE' },
    { codigo: 'CC-2026.1-7B', nome: 'CC 7º Período - Turma B', periodo: 7, turno: 'NOITE' },
    { codigo: 'CC-2026.1-1A', nome: 'CC 1º Período - Turma A', periodo: 1, turno: 'NOITE' },
  ]

  for (const t of turmasData) {
    await prisma.turma.upsert({
      where: {
        codigo_periodoLetivoId: {
          codigo: t.codigo,
          periodoLetivoId: periodoLetivo20261.id,
        },
      },
      update: {
        nome: t.nome,
        cursoId: cc.id,
        periodo: t.periodo,
        turno: t.turno as any,
        ativo: true,
      },
      create: {
        codigo: t.codigo,
        nome: t.nome,
        cursoId: cc.id,
        periodoLetivoId: periodoLetivo20261.id,
        periodo: t.periodo,
        turno: t.turno as any,
        ativo: true,
      },
    })
  }
  console.log(`✓ ${turmasData.length} turmas criadas`)

  // ─── Usuários padrão ─────────────────────────────────────────────────────
  const senhaAdmin = await hash('admin@sigha2026', 10)
  await prisma.usuario.upsert({
    where: { email: 'admin@sigha.com' },
    update: {},
    create: {
      matricula: gerarMatricula(0),
      nome: 'Administrador',
      email: 'admin@sigha.com',
      senhaHash: senhaAdmin,
      perfil: 'ADMIN',
    },
  })

  const senhaCoordenador = await hash('coord@sigha2026', 10)
  await prisma.usuario.upsert({
    where: { email: 'coordenador@unama.br' },
    update: {},
    create: {
      matricula: gerarMatricula(1),
      nome: 'Coordenador CC',
      email: 'coordenador@unama.br',
      senhaHash: senhaCoordenador,
      perfil: 'COORDENADOR',
    },
  })
  console.log('✓ Usuários padrão criados (admin e coordenador)')

  console.log('\n✅ Seed concluído com sucesso!')
  console.log('   Acesso admin:       admin@sigha.com       / admin@sigha2026')
  console.log('   Acesso coordenador: coordenador@unama.br  / coord@sigha2026')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
