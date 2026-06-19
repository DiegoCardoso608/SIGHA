import { lerArquivoExcel } from './excel-reader'
import { linhaParaMapeada, mapearColunas } from './field-mapper'
import type {
  ImportRepository,
  ImportStrategy,
  OpcoesImportacao,
  RelatorioImportacao,
  ResultadoLinha,
} from './types'

/**
 * Executa o fluxo completo de importação de uma planilha.
 *
 * O processo lê o arquivo, mapeia colunas para campos internos, valida cada
 * linha com a estratégia específica e, quando necessário, salva os registros
 * no repositório correspondente.
 */
export async function executarImportacao<T>(
  conteudo: Buffer,
  strategy: ImportStrategy<T>,
  repo: ImportRepository,
  opcoes: OpcoesImportacao
): Promise<RelatorioImportacao> {
  const iniciadoEm = new Date()
  const leitura = lerArquivoExcel(conteudo)
  const mapeamento = mapearColunas(leitura.cabecalhos, strategy.aliases)

  const resultados: ResultadoLinha[] = []

  for (let i = 0; i < leitura.linhas.length; i++) {
    const linhaBruta = leitura.linhas[i]
    const numeroLinha = leitura.numerosDeLinhaOriginais[i]
    const linhaMapeada = linhaParaMapeada(linhaBruta, mapeamento)

    const validacao = strategy.validar(linhaMapeada, numeroLinha)
    if (!validacao.sucesso) {
      resultados.push({
        linha: numeroLinha,
        status: 'IGNORADA',
        erros: validacao.erros,
      })
      continue
    }

    if (opcoes.apenasSimular) {
      resultados.push({
        linha: numeroLinha,
        status: 'IMPORTADA',
        avisos: validacao.avisos,
      })
      continue
    }

    const persistido = await strategy.salvar(validacao.dados, {
      repo,
      cache: new Map(),
    })

    resultados.push({
      linha: numeroLinha,
      status: persistido.status,
      entidadeId: persistido.id,
      avisos: validacao.avisos,
    })
  }

  const finalizadoEm = new Date()
  const totalImportadas = resultados.filter((r) => r.status === 'IMPORTADA').length
  const totalAtualizadas = resultados.filter((r) => r.status === 'ATUALIZADA').length
  const totalIgnoradas = resultados.filter((r) => r.status === 'IGNORADA').length

  const relatorio: RelatorioImportacao = {
    tipo: strategy.tipo,
    arquivo: opcoes.nomeArquivo,
    totalLinhas: leitura.linhas.length,
    totalImportadas,
    totalAtualizadas,
    totalIgnoradas,
    mapeamento,
    resultados,
    iniciadoEm,
    finalizadoEm,
    duracaoMs: finalizadoEm.getTime() - iniciadoEm.getTime(),
  }

  if (!opcoes.apenasSimular) {
    const detalhesErros = resultados
      .filter((r) => r.erros && r.erros.length > 0)
      .map((r) => `Linha ${r.linha}: ${r.erros?.map((e) => e.mensagem).join('; ')}`)
      .join(' | ')

    try {
      await repo.registrarImportacao({
        tipo: strategy.tipo,
        arquivo: opcoes.nomeArquivo,
        totalLinhas: leitura.linhas.length,
        importadas: totalImportadas,
        ignoradas: totalIgnoradas,
        detalhesErros,
      })
      relatorio.historicoRegistrado = true
    } catch (erro) {
      relatorio.historicoRegistrado = false
      relatorio.avisoHistorico =
        erro instanceof Error
          ? erro.message
          : 'Não foi possível registrar o histórico desta importação.'
    }
  }

  return relatorio
}
