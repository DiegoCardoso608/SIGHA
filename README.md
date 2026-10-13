# C-SIGHA · Simulador de grade horária

Projeto baseado no meu projeto SIGHA original, com implementações em C e Python para simular a montagem de grades horárias.

As duas versões compartilham o mesmo algoritmo e os mesmos dados, sem necessidade de banco de dados:

| Arquivo | Linguagem | Interface |
|---|---|---|
| `sigha_gui.py` | Python 3 + tkinter | **Janela gráfica** (painel, turmas, professores, disciplinas, conflitos) |
| `sigha_sim.c` | C | Menu de terminal (mesmas funções) |

As duas geram **exatamente a mesma grade** e leem/gravam o mesmo arquivo `sigha_dados.json`.

## Rodar a interface gráfica (Python)
```bash
python3 sigha_gui.py            # Windows: python sigha_gui.py
python3 sigha_gui.py --exemplo  # já abre com 5 turmas de exemplo
```
Só precisa do Python 3 com tkinter (já vem no instalador do python.org para Windows e macOS;
no Ubuntu/Debian: `sudo apt install python3-tk`). Nenhum `pip install`.

**Uso:** aba *Turmas* → preencha código/nome/turno, marque as disciplinas e clique em *Criar turma*.
A grade é recalculada na hora. O botão *Exemplo* carrega 5 turmas prontas. Tudo é salvo sozinho
em `sigha_dados.json` (ao lado do programa). *Exportar/Importar JSON* servem de backup.

## Rodar a versão em C (terminal)
```bash
make && ./sigha_sim             # menu interativo
./sigha_sim --demo --auto       # relatório com as 5 turmas de exemplo
```
> Atenção: rode dentro da pasta onde está este `Makefile`. Se aparecer outro menu
> ("Gerar grade automaticamente", "Adicionar turma"…), é outro programa/executável antigo:
> rode `make clean && make` e confira que o título é "SIGHA · Cenário A".

## Regras
| Regra | Como é garantida |
|---|---|
| Disciplina em um bloco só | cada oferta é um bloco contínuo de N aulas no **mesmo dia**, dentro do turno da turma |
| Mais de uma disciplina por dia | se sobrar espaço no turno, outra disciplina usa o mesmo dia |
| Disponibilidade só por dia | máscara de bits `dias` do professor e da disciplina (SEG–SEX) |
| Sem salas | qualquer professor leciona em qualquer lugar |
| 2+ professores por disciplina | lista `hab`: o 1º é o titular; se estiver ocupado/indisponível, o próximo assume |
| Mesma disciplina em várias turmas | permitido; o professor não pode estar em dois lugares, então a oferta vai para outro dia |
| Sem choques | matrizes `prof_oc[prof][dia][horário]` e `turma_oc[turma][dia][horário]` |

## Algoritmo
1. **Gulosa**: ordena as ofertas da mais restrita (menos posições viáveis por aula) para a mais folgada; escolhe o titular antes dos substitutos e espalha pelos dias.
2. **Reparo**: para uma oferta que sobrou, remove até 2 ofertas que a bloqueiam, a coloca e tenta realocar as removidas; se não conseguir, **desfaz tudo (rollback)**.
3. **Verificação**: validador independente reconfere todas as regras sobre a grade final.

## Recursos do paradigma imperativo usados
| Recurso | Onde (Python / C) |
|---|---|
| Estado global mutável e atribuição | `ESTADO`, `W`, `prof_oc`, `turma_oc` / `profOc`, `turmaOc`, `ofertas[]` |
| Variáveis, tipos compostos | dicionários e listas / `struct` e `enum` |
| Vetores e matrizes | `prof_oc[P][5][12]`, `turma_oc[T][5][12]` |
| Estruturas de controle | `if/elif/else`, `for`, `while`, `break`/`continue` |
| Laços aninhados | `candidatos()` (professor × dia × início), `desenhar_grade()` |
| Sub-rotinas | `simular()` com `tentar()`, `reparar()`, `livre()`, `colocar()`, `remover()` |
| Passagem de parâmetros / ponteiros | funções com parâmetros; em C `const Oferta *x`, `Cand *c` |
| Máscaras de bits | `(disc_dias & prof_dias) >> dia & 1` |
| Ordenação | `sorted(..., cmp_to_key)` / insertion sort estável em C |
| Backtracking com rollback | `reparar()` |
| Entrada/saída e arquivos | `json`, `open()` / `fopen`, `fgets`, `printf` |
| Memória dinâmica (só C) | `malloc`/`free` em `carregar_json()` |
| Validação de entrada | formulários e `messagebox` / `ler_int()`, `confirmar()` |

## Arquivos
`sigha_gui.py` · `sigha_sim.c` · `Makefile` · `exemplo_saida_cenarioA.txt` (saída do relatório em C) · `sigha_dados_exemplo.json` (dados de exemplo: *Importar JSON* na janela, ou *Arquivo → Carregar* no C).

## Limitações
- Professores e disciplinas são pré-cadastrados no código; só os professores habilitados de cada disciplina podem ser editados.
- Até 12 turmas. O reparo move no máximo 2 ofertas por vez.
