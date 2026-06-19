# SIGHA

SIGHA é um sistema de gestão acadêmica voltado para alocação de horários, disponibilidade de professores, geração automática de grades e importação de dados acadêmicos.

## Visão geral

O projeto utiliza Next.js App Router, Prisma, PostgreSQL e NextAuth para combinar:

- cadastro e manutenção de entidades acadêmicas;
- gerenciamento de disponibilidade por professor e bloco;
- geração automática de alocações com regras de conflito;
- importação de dados em lote a partir de arquivos Excel;
- visualização e exportação de relatórios.

## Arquitetura principal

- [app](app) contém as rotas da API e as páginas da aplicação.
- [lib](lib) concentra a lógica de domínio e regras de negócio.
- [prisma](prisma) define o modelo de dados e os scripts de seed.
- [components](components) reúne componentes reutilizáveis para telas de relatório e interface.
- [hooks](hooks) encapsula chamadas e estados compartilhados no frontend.

## Fluxos centrais

### Geração de grade

A lógica principal fica em [lib/algoritmo.ts](lib/algoritmo.ts). Ali são calculadas:

- carga semanal necessária por disciplina;
- compatibilidade entre turma, professor e bloco;
- prioridade de horários e penalidades para evitar conflitos;
- identificação de pendências quando não há solução completa.

### Alocações manuais

A API de alocações valida:

- existência da turma, disciplina e bloco;
- compatibilidade entre turno da turma e bloco;
- vínculo da disciplina ao curso da turma;
- conflitos com outros horários já confirmados.

### Disponibilidade

A API de disponibilidades gerencia registros por professor, dia e bloco, permitindo consultas por turma, turno e curso.

### Importação

O pipeline de importação lê planilhas Excel, realiza mapeamento de colunas, valida linhas e persiste registros por estratégia específica (professor, disciplina ou turma).

## Modelo de dados

O schema do Prisma define os principais domínios do projeto, como:

- `Usuario` e perfis de acesso;
- `Professor`, `Disciplina`, `Curso` e `Turma`;
- `PeriodoLetivo` para o ciclo acadêmico;
- `BlocoHorario` para a grade horária;
- `Disponibilidade`, `DisponibilidadeBloco` e `Alocacao`;
- `Importacao` e `LogAlteracao` para auditoria.

## Regras de negócio importantes

- Turmas só podem usar blocos compatíveis com o turno da turma.
- Disciplinas precisam pertencer ao período correto da turma.
- Professores precisam estar vinculados à disciplina e respeitar disponibilidade.
- A geração automática tenta maximizar aproveitamento do horário sem gerar conflitos.
- Em caso de conflito, o sistema marca a alocação como pendente ou conflito conforme o fluxo utilizado.

## Configuração e execução

### Pré-requisitos

- Node.js 20+
- npm
- PostgreSQL configurado para o projeto
- variáveis de ambiente do Prisma/NextAuth

### Instalação

```bash
npm install
npx prisma generate
```

### Executar em desenvolvimento

```bash
npm run dev
```

### Verificar tipagem

```bash
npx tsc --noEmit
```

### Build para produção

```bash
npm run build
```

## Estrutura de pastas relevante

```text
app/              # páginas e endpoints da API
components/       # componentes reutilizáveis
hooks/            # hooks para estado e integração com API
lib/              # regras de negócio e utilidades
prisma/           # schema, migrations e seed
scripts/          # utilidades operacionais
```

## Observação sobre documentação

Este README foi atualizado para refletir a implementação atual do sistema. As mudanças realizadas são apenas documentacionais e não alteram regras de negócio nem o comportamento em execução.
