'use client'

import { useState } from 'react'

interface ExportarGradePDFProps {
  cursoId:         string
  periodoLetivoId: string
  label?:          string
  className?:      string
  cursoNome?:      string
  periodoDescricao?: string
}

export function ExportarGradePDF({
  cursoId,
  periodoLetivoId,
  label           = 'Exportar PDF',
  className       = '',
  cursoNome       = 'Grade',
  periodoDescricao = '',
}: ExportarGradePDFProps) {
  const [carregando, setCarregando] = useState(false)
  const [erro,       setErro]       = useState<string | null>(null)

  async function handleExportar() {
    setCarregando(true)
    setErro(null)

    try {
      const url = `/api/relatorios/grade?cursoId=${cursoId}&periodoLetivoId=${periodoLetivoId}`

      const resposta = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/pdf' },
      })

      if (!resposta.ok) {
        let mensagem = `Erro ${resposta.status}`
        try {
          const json = await resposta.json()
          mensagem = json.error ?? mensagem
        } catch {
        }
        throw new Error(mensagem)
      }

      const blob      = await resposta.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor    = document.createElement('a')

      const nomeArquivo = `SIGHA_Grade_${cursoNome.replace(/\s+/g, '_')}_${periodoDescricao || ''}.pdf`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_.-]/g, '_')

      anchor.href     = objectUrl
      anchor.download = nomeArquivo
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao gerar PDF'
      setErro(msg)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleExportar}
        disabled={carregando}
        className={[
          'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium',
          'bg-blue-800 text-white hover:bg-blue-700 active:bg-blue-900',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors duration-150',
          className,
        ].join(' ')}
      >
        {carregando ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Gerando PDF…
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            {label}
          </>
        )}
      </button>

      {erro && (
        <p className="text-xs text-red-600">{erro}</p>
      )}
    </div>
  )
}

export default ExportarGradePDF
