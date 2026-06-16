'use client'

import React, { useEffect, useState } from 'react'

interface Props { cursoId: string; periodoLetivoId: string }

export function GradeInstitucionalTable({ cursoId, periodoLetivoId }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/relatorios/grade?cursoId=${cursoId}&periodoLetivoId=${periodoLetivoId}`)
      .then((r) => r.json())
      .then((j) => setData(j))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [cursoId, periodoLetivoId])

  if (loading) return <div>Carregando...</div>
  if (!data) return <div>Erro ao carregar dados da grade.</div>

  return (
    <div className="overflow-auto text-xs">
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}

export default GradeInstitucionalTable
