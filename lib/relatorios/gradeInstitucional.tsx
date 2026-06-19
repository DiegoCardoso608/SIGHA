// sigh/lib/relatorios/gradeInstitucional.tsx
// Geração do PDF institucional CCG-FOR-01
import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
  renderToFile,
} from '@react-pdf/renderer'

const COR = {
  azulHeader: '#1B4F8E',
  azulClaro: '#D9E1F2',
  branco: '#FFFFFF',
  cinzaBorda: '#808080',
  textoEscuro: '#000000',
  textoHeader: '#FFFFFF',
  cinzaAltern: '#EEF2FA',
} as const

const s = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: COR.branco,
    padding: 10,
    fontFamily: 'Helvetica',
    fontSize: 7,
  },
  cabecalhoLinha1: {
    flexDirection: 'row',
    backgroundColor: COR.azulHeader,
    alignItems: 'center',
  },
  cabLogo: {
    width: '15%',
    padding: 4,
    color: COR.textoHeader,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  cabTitulo: {
    width: '70%',
    padding: 4,
    color: COR.textoHeader,
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  cabCodigo: {
    width: '15%',
    padding: 4,
    color: COR.textoHeader,
    fontSize: 7,
    textAlign: 'center',
    borderLeft: `0.5px solid ${COR.branco}`,
  },
  cabecalhoLinha2: {
    flexDirection: 'row',
    backgroundColor: COR.azulClaro,
    borderTop: `0.5px solid ${COR.cinzaBorda}`,
  },
  cabAprovado: {
    width: '55%',
    padding: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
  cabData: {
    width: '25%',
    padding: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    borderLeft: `0.5px solid ${COR.cinzaBorda}`,
  },
  cabVersao: {
    width: '20%',
    padding: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    borderLeft: `0.5px solid ${COR.cinzaBorda}`,
  },
  cabecalhoLinha3: {
    flexDirection: 'row',
    borderTop: `0.5px solid ${COR.cinzaBorda}`,
    borderBottom: `0.5px solid ${COR.cinzaBorda}`,
  },
  cabLabelSm: {
    padding: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    borderRight: `0.5px solid ${COR.cinzaBorda}`,
  },
  cabValorSm: {
    padding: 3,
    fontSize: 7,
    textAlign: 'center',
    borderRight: `0.5px solid ${COR.cinzaBorda}`,
  },
  grade: {
    marginTop: 4,
    borderLeft: `0.5px solid ${COR.cinzaBorda}`,
    borderTop: `0.5px solid ${COR.cinzaBorda}`,
  },
  gradeRow: {
    flexDirection: 'row',
    borderBottom: `0.5px solid ${COR.cinzaBorda}`,
  },
  gradeRowHeader: {
    flexDirection: 'row',
    backgroundColor: COR.azulHeader,
    borderBottom: `0.5px solid ${COR.cinzaBorda}`,
  },
  gradeHeaderCell: {
    padding: 4,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COR.textoHeader,
    textAlign: 'center',
    borderRight: `0.5px solid ${COR.branco}`,
  },
  gradeCell: {
    padding: 3,
    fontSize: 6.5,
    textAlign: 'center',
    borderRight: `0.5px solid ${COR.cinzaBorda}`,
    justifyContent: 'center',
    minHeight: 36,
  },
  gradeCellHorario: {
    padding: 3,
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    borderRight: `0.5px solid ${COR.cinzaBorda}`,
    justifyContent: 'center',
    backgroundColor: COR.azulClaro,
    minHeight: 36,
  },
  disciplinaNome: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  professorNome: {
    fontSize: 6,
    textAlign: 'center',
    marginTop: 1,
  },
  rodapeIntervalo: {
    marginTop: 4,
    flexDirection: 'row',
    backgroundColor: COR.azulClaro,
    padding: 4,
    borderTop: `0.5px solid ${COR.cinzaBorda}`,
    borderBottom: `0.5px solid ${COR.cinzaBorda}`,
  },
  gradeRowIntervalo: {
    flexDirection: 'row',
    borderBottom: `0.5px solid ${COR.cinzaBorda}`,
    backgroundColor: COR.azulClaro,
  },
  gradeCellIntervaloLabel: {
    padding: 3,
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    borderRight: `0.5px solid ${COR.cinzaBorda}`,
    justifyContent: 'center',
    minHeight: 14,
  },
  gradeCellIntervaloTexto: {
    padding: 3,
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    justifyContent: 'center',
    minHeight: 14,
  },
  rodapeEmissao: {
    marginTop: 3,
    fontSize: 6,
    color: COR.cinzaBorda,
    textAlign: 'center',
  },
})

const DIAS_SEMANA = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO'] as const
const DIAS_LABEL = ['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO']

type DiaSemana = (typeof DIAS_SEMANA)[number]

interface AlocacaoCriada {
  turmaId: string
  turmaNome: string
  disciplinaId: string
  disciplinaNome: string
  professorId: string | null
  professorNome: string
  blocoId: string
  blocoInicio: string
  blocoFim: string
  diaSemana: string
}

interface TurmaGrade {
  turma: {
    id: string
    codigo: string
    nome: string
    periodo: number
    turno: string
    sala?: string | null
  }
  alocadas: AlocacaoCriada[]
  pendencias: Array<{ disciplinaId: string; disciplinaNome: string }>
}

interface GradeData {
  curso: { id: string; nome: string }
  periodoLetivo: { id: string; descricao: string }
  turmas: TurmaGrade[]
}

type BlocoAgrupado = {
  tipo: 'aula'
  blocoInicio: string
  blocoFim: string
  aulas: Partial<Record<DiaSemana, { disciplina: string; professor: string }>>
}

type ItemIntervalo = {
  tipo: 'intervalo'
  inicio: string
  fim: string
}

type ItemGrade = BlocoAgrupado | ItemIntervalo

function turnoLabel(turno: string) {
  return { MANHA: 'MANHÃ', TARDE: 'TARDE', NOITE: 'NOITE' }[turno] ?? turno
}

function dataHoje() {
  return new Date().toLocaleDateString('pt-BR')
}

function dataHoraAgora() {
  return new Date().toLocaleString('pt-BR')
}

function agruparPorBloco(alocadas: AlocacaoCriada[]): BlocoAgrupado[] {
  const map = new Map<string, BlocoAgrupado>()

  for (const a of alocadas) {
    if (!map.has(a.blocoInicio)) {
      map.set(a.blocoInicio, {
        tipo: 'aula',
        blocoInicio: a.blocoInicio,
        blocoFim: a.blocoFim,
        aulas: {},
      })
    }

    const bloco = map.get(a.blocoInicio)!
    bloco.aulas[a.diaSemana as DiaSemana] = {
      disciplina: a.disciplinaNome,
      professor: a.professorNome || 'Não informado',
    }
  }

  return [...map.values()].sort((a, b) => a.blocoInicio.localeCompare(b.blocoInicio))
}

function montarSequenciaComIntervalos(blocos: BlocoAgrupado[]): ItemGrade[] {
  const sequencia: ItemGrade[] = []

  for (let i = 0; i < blocos.length; i++) {
    sequencia.push(blocos[i])

    const proximo = blocos[i + 1]
    if (proximo && blocos[i].blocoFim !== proximo.blocoInicio) {
      sequencia.push({
        tipo: 'intervalo',
        inicio: blocos[i].blocoFim,
        fim: proximo.blocoInicio,
      })
    }
  }

  return sequencia
}

function detectarIntervalo(blocos: BlocoAgrupado[]) {
  for (let i = 0; i < blocos.length - 1; i++) {
    if (blocos[i].blocoFim !== blocos[i + 1].blocoInicio) {
      return { inicio: blocos[i].blocoFim, fim: blocos[i + 1].blocoInicio }
    }
  }
  return null
}

const COL_HORARIO = '13%'
const COL_DIA = `${87 / 6}%` as `${number}%`

function CabecalhoInstitucional({
  turmaGrade,
  periodoLetivo,
  cursoNome,
}: {
  turmaGrade: TurmaGrade
  periodoLetivo: { descricao: string }
  cursoNome: string
}) {
  const { turma } = turmaGrade

  return (
    <View>
      <View style={s.cabecalhoLinha1}>
        <Text style={s.cabLogo}></Text>
        <Text style={s.cabTitulo}>HORÁRIO DE AULA</Text>
        <View style={s.cabCodigo}>
          <Text>CÓDIGO:</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>CCG-FOR-01</Text>
        </View>
      </View>

      <View style={s.cabecalhoLinha2}>
        <Text style={s.cabAprovado}>APROVADO POR: SUPERINTENDENTE ACADÊMICA</Text>
        <Text style={s.cabData}>DATA: {dataHoje()}</Text>
        <Text style={s.cabVersao}>VERSÃO: 07</Text>
      </View>

      <View style={[s.cabecalhoLinha3, { alignItems: 'center' }]}>
        <Text style={[s.cabLabelSm, { width: '10%' }]}>CURSO:</Text>
        <Text style={[s.cabValorSm, { width: '65%', textAlign: 'left' }]}>
          {cursoNome.toUpperCase()}
        </Text>
        <Text style={[s.cabLabelSm, { width: '13%' }]}>SEMESTRE{`\n`}LETIVO:</Text>
        <Text style={[s.cabValorSm, { width: '12%', borderRight: 'none' }]}>
          {periodoLetivo.descricao}
        </Text>
      </View>

      <View style={[s.cabecalhoLinha3, { alignItems: 'center' }]}>
        <Text style={[s.cabLabelSm, { width: '8%' }]}>PERÍODO:</Text>
        <Text style={[s.cabValorSm, { width: '7%' }]}>{turma.periodo}</Text>
        <Text style={[s.cabLabelSm, { width: '8%' }]}>TURMA:</Text>
        <Text style={[s.cabValorSm, { width: '30%' }]}>{turma.codigo}</Text>
        <Text style={[s.cabLabelSm, { width: '8%' }]}>TURNO:</Text>
        <Text style={[s.cabValorSm, { width: '13%' }]}>{turnoLabel(turma.turno)}</Text>
        <Text style={[s.cabLabelSm, { width: '8%' }]}>BLOCO:</Text>
        <Text style={[s.cabValorSm, { width: '18%', borderRight: 'none' }]}>
          {turma.sala || ''}
        </Text>
      </View>
    </View>
  )
}

function GradeRow({ bloco, index }: { bloco: BlocoAgrupado; index: number }) {
  const bgRow = index % 2 === 0 ? COR.azulClaro : COR.branco

  return (
    <View style={[s.gradeRow, { backgroundColor: bgRow }]}> 
      <Text style={[s.gradeCellHorario, { width: COL_HORARIO, backgroundColor: bgRow }]}> 
        {bloco.blocoInicio}{`\n`}às{`\n`}{bloco.blocoFim}
      </Text>
      {DIAS_SEMANA.map((dia) => {
        const aula = bloco.aulas[dia]
        return (
          <View key={dia} style={[s.gradeCell, { width: COL_DIA }]}>
            {aula ? (
              <>
                <Text style={s.disciplinaNome}>{aula.disciplina.toUpperCase()}</Text>
                {aula.professor && (
                  <Text style={s.professorNome}>{aula.professor.toUpperCase()}</Text>
                )}
              </>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

function GradeRowIntervalo({ item }: { item: ItemIntervalo }) {
  return (
    <View style={s.gradeRowIntervalo}>
      <Text style={[s.gradeCellIntervaloLabel, { width: COL_HORARIO }]}>
        {item.inicio}{`\n`}às{`\n`}{item.fim}
      </Text>
      <Text style={[s.gradeCellIntervaloTexto, { width: `${87}%` as `${number}%` }]}>INTERVALO</Text>
    </View>
  )
}

function GradeSemanal({ alocadas }: { alocadas: AlocacaoCriada[] }) {
  const blocos = agruparPorBloco(alocadas)
  const sequencia = montarSequenciaComIntervalos(blocos)
  let indiceAula = 0

  return (
    <View style={s.grade}>
      <View style={s.gradeRowHeader}>
        <Text style={[s.gradeHeaderCell, { width: COL_HORARIO }]}>HORÁRIO</Text>
        {DIAS_LABEL.map((dia) => (
          <Text key={dia} style={[s.gradeHeaderCell, { width: COL_DIA }]}>{dia}</Text>
        ))}
      </View>

      {sequencia.map((item) => {
        if (item.tipo === 'intervalo') {
          return <GradeRowIntervalo key={`intervalo-${item.inicio}`} item={item} />
        }

        const idx = indiceAula++
        return <GradeRow key={item.blocoInicio} bloco={item} index={idx} />
      })}
    </View>
  )
}

function Rodape() {
  return (
    <View>
      <Text style={s.rodapeEmissao}>Gerado pelo SIGHA  {dataHoraAgora()}</Text>
    </View>
  )
}

function GradeDocument({ data }: { data: GradeData }) {
  return (
    <Document
      title={`Horário de Aula  ${data.curso.nome}  ${data.periodoLetivo.descricao}`}
      author="SIGHA"
      subject="Horário de Aula CCG-FOR-01"
      creator="SIGHA  Sistema Inteligente de Gestão de Horários Acadêmicos"
    >
      {data.turmas.map((turmaGrade) => (
        <Page key={turmaGrade.turma.id} size="A4" orientation="landscape" style={s.page}>
          <CabecalhoInstitucional
            turmaGrade={turmaGrade}
            periodoLetivo={data.periodoLetivo}
            cursoNome={data.curso.nome}
          />
          <GradeSemanal alocadas={turmaGrade.alocadas} />
          <Rodape />
        </Page>
      ))}
    </Document>
  )
}

export async function gerarBufferPDF(data: GradeData): Promise<Buffer> {
  const element = React.createElement(GradeDocument, { data } as never)
  return await renderToBuffer(element as never)
}

export async function salvarPDFEmDisco(data: GradeData, outputPath: string): Promise<string> {
  const element = React.createElement(GradeDocument, { data } as never)
  await renderToFile(element as never, outputPath)
  return outputPath
}

