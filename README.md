# Py-SIGHA · Simulador de grade horária

Projeto baseado no meu projeto SIGHA original. Esta versão reúne em Python a interface gráfica e a lógica de montagem das grades, sem banco de dados.

## Executar
```bash
python sigha_gui.py
python sigha_gui.py --exemplo
```

Requer Python 3 com Tkinter. No instalador oficial do Python para Windows, Tkinter pode ser selecionado como componente; em algumas distribuições Linux é necessário instalar o pacote `python3-tk`. Não requer instalação via `pip`.

## Uso
Na aba **Turmas**, informe o código, o nome opcional, o turno e as disciplinas. A grade é recalculada ao atualizar a interface. O botão **Exemplo** carrega cinco turmas de demonstração.

Os dados são salvos em `sigha_dados.json`, ao lado do script. A interface também permite importar e exportar configurações JSON e exportar a grade calculada em CSV.

## Regras da grade
- Cada disciplina é alocada como um bloco contínuo no mesmo dia e dentro do turno da turma.
- Cada turno tem quatro horários; uma disciplina precisa caber nesse bloco.
- Disponibilidade de professores e disciplinas é definida por dia da semana, não por horário.
- Não há cadastro ou restrição de salas.
- Cada disciplina tem professores habilitados em uma ordem; o primeiro é o titular e os demais podem substituí-lo.
- Um professor e uma turma não podem ter duas aulas no mesmo horário.

## Algoritmo
1. A lógica calcula as posições possíveis de cada oferta e ordena as mais restritas antes das demais.
2. A etapa gulosa tenta alocar cada oferta, priorizando o titular e distribuindo as aulas pelos dias.
3. Para ofertas pendentes, uma etapa de reparo pode mover até duas ofertas que estejam bloqueando uma posição. Se não conseguir realocá-las, restaura a grade anterior.
4. Uma verificação final procura violações de turno, disponibilidade, habilitação de professor e sobreposição de horários.

O algoritmo é heurístico: o reparo é limitado e não garante encontrar uma grade completa sempre que existir uma solução.

## Paradigma imperativo
O programa mantém estado mutável em listas e dicionários (`ESTADO`, ofertas e matrizes de ocupação), usa atribuições, condicionais, laços `for` e `while`, funções e estruturas de controle para construir, alocar, mover e validar as aulas. A disponibilidade semanal é representada por máscaras de bits.

## Arquivos
- `sigha_gui.py`: interface Tkinter e algoritmo de simulação.
- `sigha_dados.json`: dados salvos da execução atual.
- `sigha_dados_exemplo.json`: dados para importar como demonstração.

## Limitações
- Professores e disciplinas são pré-cadastrados; a interface permite editar quais professores estão habilitados por disciplina, mas não cadastrar novos professores ou disciplinas.
- Há limite de 12 turmas e os turnos têm quatro horários.
- A disponibilidade é por dia e não há restrições por horário ou sala.
- O reparo considera no máximo duas ofertas bloqueadoras por tentativa e percorre até quatro passadas.
