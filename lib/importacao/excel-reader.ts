import * as XLSX from 'xlsx'
import type { LinhaBruta } from './types'

export interface OpcoesLeituraExcel {
  planilha?: string | number
  linhaCabecalho?: number
}

export interface ResultadoLeituraExcel {
  planilhaLida: string
  cabecalhos: string[]
  linhas: LinhaBruta[]
  numerosDeLinhaOriginais: number[]
}

export class ExcelReaderError extends Error {}

export function lerArquivoExcel(
  conteudo: Buffer | ArrayBuffer,
  opcoes: OpcoesLeituraExcel = {}
): ResultadoLeituraExcel {
  let workbook: XLSX.WorkBook

  try {
    workbook = XLSX.read(conteudo, { type: 'buffer' })
  } catch (erroOriginal) {
    throw new ExcelReaderError(
      `Não foi possível interpretar o arquivo como uma planilha Excel válida: ${
        erroOriginal instanceof Error ? erroOriginal.message : String(erroOriginal)
      }`
    )
  }

  const nomePlanilha = resolverNomePlanilha(workbook, opcoes.planilha)
  const sheet = workbook.Sheets[nomePlanilha]

  if (!sheet) {
    throw new ExcelReaderError(
      `A planilha "${nomePlanilha}" não foi encontrada no arquivo. Planilhas disponíveis: ${workbook.SheetNames.join(', ')}`
    )
  }

  const linhaCabecalho = opcoes.linhaCabecalho ?? 1
  const matriz: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  })

  if (matriz.length === 0) {
    return {
      planilhaLida: nomePlanilha,
      cabecalhos: [],
      linhas: [],
      numerosDeLinhaOriginais: [],
    }
  }

  const indiceCabecalho = linhaCabecalho - 1
  const linhaHeaderBruta = matriz[indiceCabecalho] ?? []
  const cabecalhos = linhaHeaderBruta.map((valor, idx) => normalizarCabecalho(valor, idx))
  const linhasDeDados = matriz.slice(indiceCabecalho + 1)

  const linhas: LinhaBruta[] = []
  const numerosDeLinhaOriginais: number[] = []

  linhasDeDados.forEach((linhaArray, idxRelativo) => {
    const totalmenteVazia = linhaArray.every(
      (v) => v === null || v === undefined || String(v).trim() === ''
    )
    if (totalmenteVazia) return

    const objeto: LinhaBruta = {}
    cabecalhos.forEach((nomeColuna, idxColuna) => {
      objeto[nomeColuna] = linhaArray[idxColuna] ?? null
    })

    linhas.push(objeto)
    numerosDeLinhaOriginais.push(indiceCabecalho + 2 + idxRelativo)
  })

  return {
    planilhaLida: nomePlanilha,
    cabecalhos,
    linhas,
    numerosDeLinhaOriginais,
  }
}

function resolverNomePlanilha(
  workbook: XLSX.WorkBook,
  planilha?: string | number
): string {
  if (planilha === undefined) {
    return workbook.SheetNames[0]
  }
  if (typeof planilha === 'number') {
    const nome = workbook.SheetNames[planilha]
    if (!nome) {
      throw new ExcelReaderError(
        `Índice de planilha ${planilha} fora do intervalo (arquivo possui ${workbook.SheetNames.length} planilha(s)).`
      )
    }
    return nome
  }
  return planilha
}

function normalizarCabecalho(valorOriginal: unknown, indice: number): string {
  if (valorOriginal === null || valorOriginal === undefined) {
    return `Coluna_${indice + 1}`
  }
  const texto = String(valorOriginal).trim()
  return texto === '' ? `Coluna_${indice + 1}` : texto
}
