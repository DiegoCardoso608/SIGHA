import type { ErroValidacaoCampo, LinhaMapeada, ResultadoValidacaoLinha } from '../types'

export function validarDisciplinaLinha(
  linha: LinhaMapeada,
  numeroLinha: number
): ResultadoValidacaoLinha<{
  codigo: string
  nome: string
  cargaHoraria: number
  blocosSemanais?: number | null
  modalidade: string
  cursoId?: string | null
  periodo?: number | null
}> {
  const erros: ErroValidacaoCampo[] = []

  const codigo = normalizarTexto(linha.codigo)
  const nome = normalizarTexto(linha.nome)
  const cargaHoraria = Number(linha.cargaHoraria)
  const blocosSemanais = linha.blocosSemanais === undefined || linha.blocosSemanais === null || linha.blocosSemanais === ''
    ? null
    : Number(linha.blocosSemanais)
  const modalidade = normalizarTexto(linha.modalidade) || 'PRESENCIAL'

  if (!codigo) erros.push({ campo: 'codigo', mensagem: 'Código é obrigatório' })
  if (!nome) erros.push({ campo: 'nome', mensagem: 'Nome é obrigatório' })
  if (!Number.isFinite(cargaHoraria) || cargaHoraria <= 0) {
    erros.push({ campo: 'cargaHoraria', mensagem: 'Carga horária inválida' })
  }

  if (blocosSemanais !== null && (!Number.isFinite(blocosSemanais) || blocosSemanais <= 0)) {
    erros.push({ campo: 'blocosSemanais', mensagem: 'Blocos semanais inválidos' })
  }

  if (erros.length > 0) {
    return { sucesso: false, erros }
  }

  return {
    sucesso: true,
    dados: {
      codigo,
      nome,
      cargaHoraria,
      blocosSemanais,
      modalidade: modalidade.toUpperCase(),
      cursoId: linha.cursoId ? String(linha.cursoId) : null,
      periodo: linha.periodo === undefined || linha.periodo === null || linha.periodo === ''
        ? null
        : Number(linha.periodo),
    },
    avisos: [],
  }
}

function normalizarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}
