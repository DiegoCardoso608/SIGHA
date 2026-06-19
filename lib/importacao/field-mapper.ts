import type {
  DicionarioAliases,
  LinhaBruta,
  LinhaMapeada,
  MapeamentoColunas,
} from './types'

interface CandidatoMatch {
  coluna: string
  campo: string
  score: number
}

const LIMIAR_MINIMO_SCORE = 0.72

/**
 * Normaliza textos para comparação robusta entre nomes de colunas e aliases.
 */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tenta associar cada coluna do arquivo aos campos esperados da estratégia.
 *
 * O algoritmo usa comparação aproximada entre nomes de colunas e aliases,
 * permitindo importar planilhas com variações de escrita.
 */
export function mapearColunas(
  cabecalhos: string[],
  aliases: DicionarioAliases
): MapeamentoColunas {
  const colunaParaCampo: Record<string, string> = {}
  const usados = new Set<string>()
  const candidatos: CandidatoMatch[] = []

  for (const coluna of cabecalhos) {
    const chave = normalizarTexto(coluna)
    let melhor: CandidatoMatch | null = null
    for (const [campo, listaAliases] of Object.entries(aliases)) {
      for (const alias of listaAliases) {
        const aliasNormalizado = normalizarTexto(alias)
        const score = calcularScore(chave, aliasNormalizado)
        if (score >= LIMIAR_MINIMO_SCORE) {
          const candidato = { coluna, campo, score }
          if (!melhor || candidato.score > melhor.score) {
            melhor = candidato
          }
        }
      }
    }
    if (melhor && !usados.has(melhor.campo)) {
      colunaParaCampo[coluna] = melhor.campo
      usados.add(melhor.campo)
    } else if (melhor) {
      candidatos.push(melhor)
    }
  }

  const camposNaoEncontrados = Object.keys(aliases).filter((campo) => !Object.values(colunaParaCampo).includes(campo))

  return {
    colunaParaCampo,
    colunasIgnoradas: cabecalhos.filter((coluna) => !(coluna in colunaParaCampo)),
    camposNaoEncontrados,
  }
}

/**
 * Converte uma linha bruta do Excel para um objeto com campos já mapeados.
 */
export function linhaParaMapeada(
  linhaBruta: LinhaBruta,
  mapeamento: MapeamentoColunas
): LinhaMapeada {
  const linhaMapeada: LinhaMapeada = {}
  for (const [colunaOriginal, campoInterno] of Object.entries(mapeamento.colunaParaCampo)) {
    linhaMapeada[campoInterno] = linhaBruta[colunaOriginal]
  }
  return linhaMapeada
}

function calcularScore(texto: string, alias: string): number {
  if (texto === alias) return 1
  if (texto.includes(alias) || alias.includes(texto)) return 0.95
  const distancia = levenshtein(texto, alias)
  const maxLen = Math.max(texto.length, alias.length)
  return maxLen === 0 ? 1 : Math.max(0, 1 - distancia / maxLen)
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + custo
      )
    }
  }
  return matrix[a.length][b.length]
}
