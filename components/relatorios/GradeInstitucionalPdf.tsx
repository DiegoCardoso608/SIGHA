'use client'

import React from 'react'
import ExportarGradePDF from './ExportarGradePDF'

interface Props {
  cursoId: string
  periodoLetivoId: string
  cursoNome?: string
  periodoDescricao?: string
}

export function GradeInstitucionalPdf({ cursoId, periodoLetivoId, cursoNome = 'Grade', periodoDescricao = '' }: Props) {
  return (
    <ExportarGradePDF
      cursoId={cursoId}
      periodoLetivoId={periodoLetivoId}
      cursoNome={cursoNome}
      periodoDescricao={periodoDescricao}
    />
  )
}

export default GradeInstitucionalPdf
