/* ============================================================================
 * SIGHA - Simulador de grade horária, com interface de terminal (C, imperativo)
 *
 * Tudo em C: cadastro de turmas, edição dos professores habilitados, simulação,
 * grades, conflitos, estatísticas e arquivo de dados (JSON) -- sem bibliotecas.
 *
 * Regras:
 *  - Cada DISCIPLINA é um bloco contínuo no MESMO dia, dentro do turno da turma.
 *    Se sobrar espaço no turno, outra disciplina pode usar o mesmo dia.
 *  - Disponibilidade só por DIA (SEG-SEX); o horário não faz diferença.
 *  - Não há salas: qualquer professor leciona em qualquer lugar.
 *  - Cada disciplina tem 2 ou mais professores habilitados. O primeiro é o
 *    titular; se estiver ocupado ou indisponível, o próximo assume.
 *  - A mesma disciplina pode ser oferecida a várias turmas; como o professor
 *    não pode estar em dois lugares, a oferta é remanejada para outro dia.
 *  - Professor e turma nunca ocupam o mesmo horário duas vezes.
 *
 * Algoritmo: 1) gulosa (mais restritas primeiro)  2) reparo (move até 2 ofertas,
 * com rollback)  3) verificação independente.
 * Compilar: make   |   Rodar: ./sigha_sim
 * ========================================================================== */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <windows.h>
#endif

#define N_DIAS       5
#define SLOTS_TURNO  4
#define SLOTS_DIA    12
#define MAX_TURMAS   12
#define MAX_DISC     32
#define MAX_PROFS    12
#define MAX_OFERTAS  (MAX_TURMAS * MAX_DISC)
#define MAX_CAND     256

#define DIA_SEG 1
#define DIA_TER 2
#define DIA_QUA 4
#define DIA_QUI 8
#define DIA_SEX 16
#define TODOS   31

typedef struct { char sigla[8], nome[44]; int aulas, dias, nhab, hab[MAX_PROFS]; } Disciplina;
typedef struct { char nome[32]; int dias; } Professor;
typedef struct { char codigo[24], nome[48]; int turno, ndisc, disc[MAX_DISC]; } Turma;   /* turno: 0 manhã, 1 tarde, 2 noite */
typedef struct { int turma, disc, prof, dia, slot, motivo; } Oferta;                    /* prof/dia = -1: sem horário */
typedef struct { int prof, dia, slot, ordem; } Cand;

enum { RODRIGO, MARCIA, DIEGO, ANA, LUCAS, PAULO, CARLA, FERNANDA, JULIA };
enum { MAT, LOG, SCO, GTA, DCH, ARQ, RED, SOP, DBA, MOB, COM, TST, SEGI, TOP, MET, MLE, GEN, DGA, EMP, ERQ, POO, ESW, BDD, EDA, UXD };
enum { M_OK = 0, M_PROF_OCUPADO, M_TURMA_OCUPADA, M_SEM_DIA, M_CARGA, N_MOTIVOS };

static Turma      turmas[MAX_TURMAS];      static int n_turmas;
static Disciplina disciplinas[MAX_DISC];   static int n_disc;
static Professor  professores[MAX_PROFS];  static int n_profs;
static Oferta     ofertas[MAX_OFERTAS];    static int n_ofertas;
static int        hab_padrao[MAX_DISC][3];

static int profOc [MAX_PROFS ][N_DIAS][SLOTS_DIA];   /* índice da oferta ou -1 */
static int turmaOc[MAX_TURMAS][N_DIAS][SLOTS_DIA];

static int usar_cor = 1, trace = 0, relaxado = 0, em_reparo = 0, reparos = 0;
static int simulado = 0, mudou = 0, fim_entrada = 0, violacoes = 0;
static char arquivo_dados[128] = "sigha_dados.json";

static const char *NOME_DIA[N_DIAS]  = {"SEG", "TER", "QUA", "QUI", "SEX"};
static const char *NOME_TURNO[3]     = {"Manhã", "Tarde", "Noite"};
static const char *SLOT_LABEL[SLOTS_DIA] = {
    "08:00-08:50", "08:50-09:40", "10:00-10:50", "10:50-11:40",
    "13:30-14:20", "14:20-15:10", "15:30-16:20", "16:20-17:10",
    "18:30-19:20", "19:20-20:10", "20:30-21:20", "21:20-22:10"};
static const char *TEXTO_MOTIVO[N_MOTIVOS] = {"",
    "todos os professores habilitados já estão ocupados nesse horário",
    "turma já ocupada nesse horário (o turno só tem 4 aulas por dia)",
    "nenhum professor habilitado tem dia em comum com a disciplina",
    "carga maior que o turno (máx. 4 aulas em sequência)"};
static const char *SUGESTAO[N_MOTIVOS] = {"",
    "Habilitar mais um professor para a disciplina ou ampliar os dias dos professores.",
    "Tirar disciplinas da turma ou usar outro turno.",
    "Habilitar outro professor ou ampliar os dias da disciplina.",
    "Dividir a disciplina: a carga não cabe em um único turno."};

/* ========================================================================== */
/* 1. ENTRADA E SAÍDA                                                         */
/* ========================================================================== */
static const int PALETA[] = {39, 208, 41, 171, 220, 45, 203, 118, 141, 214, 80, 177};
static void cor_disc(int d)    { if (usar_cor) printf("\x1b[38;5;%dm", PALETA[d % 12]); }
static void cor(const char *c) { if (usar_cor) printf("%s", c); }
#define VERMELHO "\x1b[1;31m"
#define VERDE    "\x1b[1;32m"
#define AMARELO  "\x1b[1;33m"
#define NEGRITO  "\x1b[1m"
#define CINZA    "\x1b[90m"
#define RESET    "\x1b[0m"

static void campo(const char *s, int larg)          /* imprime/trunca/preenche por caractere UTF-8 */
{
    int n = 0;
    while (*s && n < larg) {
        putchar(*s++); n++;
        while (((unsigned char)*s & 0xC0) == 0x80) putchar(*s++);
    }
    for (; n < larg; n++) putchar(' ');
}
static void repetir(const char *s, int n) { for (int i = 0; i < n; i++) printf("%s", s); }
static void barra(int v, int max, int larg)
{
    int c = max > 0 ? v * larg / max : 0;
    if (c > larg) c = larg;
    repetir("█", c); repetir("░", larg - c);
}

static int ler_linha(char *buf, int tam)
{
    if (!fgets(buf, tam, stdin)) { fim_entrada = 1; buf[0] = 0; return 0; }
    if (!strchr(buf, '\n')) { int c; while ((c = getchar()) != '\n' && c != EOF) ; }   /* descarta o excedente */
    buf[strcspn(buf, "\r\n")] = 0;
    return 1;
}
static void aparar(char *s)                         /* remove espaços nas pontas */
{
    int i = 0, n = (int)strlen(s);
    while (n > 0 && (s[n - 1] == ' ' || s[n - 1] == '\t')) s[--n] = 0;
    while (s[i] == ' ' || s[i] == '\t') i++;
    if (i) memmove(s, s + i, strlen(s + i) + 1);
}
static void ler_texto(const char *prompt, char *out, int tam)
{
    printf("%s", prompt); fflush(stdout);
    ler_linha(out, tam); aparar(out);
}
static int ler_int(const char *prompt, int min, int max)
{
    char b[32];
    for (;;) {
        printf("%s", prompt); fflush(stdout);
        if (!ler_linha(b, sizeof b)) return min;
        aparar(b);
        if (b[0] >= '0' && b[0] <= '9') { int v = atoi(b); if (v >= min && v <= max) return v; }
        printf("  Digite um número entre %d e %d.\n", min, max);
    }
}
static int confirmar(const char *pergunta)
{
    char b[16];
    printf("%s (s/n): ", pergunta); fflush(stdout);
    ler_linha(b, sizeof b); aparar(b);
    return b[0] == 's' || b[0] == 'S';
}
static int extrair_ints(const char *s, int *v, int max)   /* todos os inteiros de uma linha */
{
    int n = 0;
    while (*s && n < max) {
        if (*s >= '0' && *s <= '9') { char *e; v[n++] = (int)strtol(s, &e, 10); s = e; }
        else s++;
    }
    return n;
}
static void secao(const char *t)
{
    printf("\n"); cor(NEGRITO); repetir("═", 72); printf("\n  %s\n", t); repetir("═", 72); printf("\n"); cor(RESET);
}
static void primeiro_nome(const char *nome, char *out, int tam)
{
    int i = 0;
    while (nome[i] && nome[i] != ' ' && i < tam - 1) { out[i] = nome[i]; i++; }
    out[i] = 0;
}
static const char *curto(int t)                      /* "CC-2026.1-7A" -> "7A" */
{
    const char *h = strrchr(turmas[t].codigo, '-');
    return h && h[1] ? h + 1 : turmas[t].codigo;
}

/* ========================================================================== */
/* 2. CATÁLOGO PRÉ-CADASTRADO (professores e disciplinas)                     */
/* ========================================================================== */
static void add_disc(const char *sigla, const char *nome, int aulas, int dias, int h0, int h1, int h2)
{
    Disciplina *d = &disciplinas[n_disc];
    snprintf(d->sigla, sizeof d->sigla, "%s", sigla);
    snprintf(d->nome, sizeof d->nome, "%s", nome);
    d->aulas = aulas; d->dias = dias; d->nhab = 3;
    d->hab[0] = h0; d->hab[1] = h1; d->hab[2] = h2;
    hab_padrao[n_disc][0] = h0; hab_padrao[n_disc][1] = h1; hab_padrao[n_disc][2] = h2;
    n_disc++;
}
static void add_prof(const char *nome, int dias)
{
    Professor *p = &professores[n_profs++];
    snprintf(p->nome, sizeof p->nome, "%s", nome);
    p->dias = dias;
}
static void restaurar_hab(void)
{
    for (int d = 0; d < n_disc; d++) {
        disciplinas[d].nhab = 3;
        for (int i = 0; i < 3; i++) disciplinas[d].hab[i] = hab_padrao[d][i];
    }
}
static void carregar_catalogo(void)
{
    n_disc = n_profs = 0;
    /* Professores (ordem = enum RODRIGO..JULIA): disponibilidade só por dia */
    add_prof("Rodrigo Silva", TODOS);
    add_prof("Marcia Pantoja", DIA_SEG|DIA_QUA|DIA_SEX);
    add_prof("Diego Abreu", DIA_QUA|DIA_QUI);
    add_prof("Ana Lima", DIA_SEG|DIA_TER|DIA_QUA);
    add_prof("Lucas Moreira", DIA_TER|DIA_QUI|DIA_SEX);
    add_prof("Paulo Henrique", DIA_SEG|DIA_TER|DIA_QUA|DIA_QUI);
    add_prof("Carla Nunes", DIA_TER|DIA_QUI|DIA_SEX);
    add_prof("Fernanda Costa", TODOS);
    add_prof("Julia Ramos", DIA_TER|DIA_QUA|DIA_QUI);

    /* Disciplinas: sigla, nome, aulas/semana, dias permitidos, 3 professores habilitados (titular primeiro) */
    add_disc("MAT", "Matemática Aplicada", 4, TODOS, PAULO, ANA, RODRIGO);
    add_disc("LOG", "Lógica de Programação", 4, TODOS, CARLA, LUCAS, ANA);
    add_disc("SCO", "Sistemas Computacionais", 2, TODOS, CARLA, MARCIA, FERNANDA);
    add_disc("GTA", "Gestão de Times - Ágeis", 2, DIA_QUI|DIA_SEX, PAULO, RODRIGO, JULIA);
    add_disc("DCH", "Design Centrado no Ser Humano", 2, TODOS, PAULO, JULIA, FERNANDA);
    add_disc("ARQ", "Arquitetura de Software", 2, TODOS, DIEGO, MARCIA, RODRIGO);
    add_disc("RED", "Redes de Computadores", 4, TODOS, CARLA, MARCIA, LUCAS);
    add_disc("SOP", "Sistemas Operacionais", 4, TODOS, MARCIA, DIEGO, CARLA);
    add_disc("DBA", "Database Application", 4, TODOS, LUCAS, ANA, JULIA);
    add_disc("MOB", "Programação - Mobile Coding", 4, TODOS, LUCAS, FERNANDA, JULIA);
    add_disc("COM", "Compiladores", 4, TODOS, DIEGO, MARCIA, RODRIGO);
    add_disc("TST", "Teste de Software", 4, TODOS, MARCIA, ANA, LUCAS);
    add_disc("SEG", "Segurança da Informação", 2, TODOS, MARCIA, CARLA, DIEGO);
    add_disc("TOP", "Tópicos Integradores", 4, TODOS, DIEGO, RODRIGO, PAULO);
    add_disc("MET", "Metodologia da Pesquisa", 2, DIA_SEG|DIA_TER, PAULO, RODRIGO, JULIA);
    add_disc("MLE", "Machine Learning", 2, TODOS, FERNANDA, RODRIGO, ANA);
    add_disc("GEN", "Game Engine", 4, TODOS, FERNANDA, LUCAS, JULIA);
    add_disc("DGA", "Desenvolvimento de Games", 4, TODOS, FERNANDA, LUCAS, ANA);
    add_disc("EMP", "Empreendedorismo", 4, TODOS, RODRIGO, PAULO, FERNANDA);
    add_disc("ERQ", "Engenharia de Requisitos", 2, TODOS, RODRIGO, ANA, PAULO);
    add_disc("POO", "Programação Orientada a Objeto", 4, TODOS, ANA, LUCAS, RODRIGO);
    add_disc("ESW", "Engenharia de Software", 4, TODOS, RODRIGO, ANA, PAULO);
    add_disc("BDD", "Banco de Dados", 4, TODOS, LUCAS, ANA, JULIA);
    add_disc("EDA", "Estrutura de Dados", 4, TODOS, ANA, LUCAS, CARLA);
    add_disc("UXD", "UX/UI Design", 2, DIA_TER|DIA_QUA|DIA_QUI, JULIA, FERNANDA, ANA);
}

static void limpar_turmas(void)
{
    n_turmas = 0; relaxado = 0;
    restaurar_hab();
}
static void carregar_exemplo(void)
{
    limpar_turmas();
    static const char *cod[5]  = {"CC-2026.1-1A", "CC-2026.1-3A", "CC-2026.1-5A", "CC-2026.1-7A", "CC-2026.1-2B"};
    static const int turno[5]  = {2, 2, 0, 2, 1};
    static const int lista[5][5] = {
        {MAT, LOG, SCO, GTA, DCH}, {ARQ, RED, SOP, DBA, MOB}, {MLE, GEN, DGA, EMP, ERQ},
        {COM, TST, SEGI, TOP, MET}, {POO, ESW, BDD, EDA, UXD}};
    for (int t = 0; t < 5; t++) {
        Turma *x = &turmas[n_turmas++];
        memset(x, 0, sizeof *x);
        snprintf(x->codigo, sizeof x->codigo, "%s", cod[t]);
        x->turno = turno[t]; x->ndisc = 5;
        for (int i = 0; i < 5; i++) x->disc[i] = lista[t][i];
    }
    simulado = 0;
}

/* ========================================================================== */
/* 3. ESTADO DA SIMULAÇÃO                                                     */
/* ========================================================================== */
static void construir_ofertas(void)
{
    n_ofertas = 0;
    for (int t = 0; t < n_turmas; t++)
        for (int i = 0; i < turmas[t].ndisc; i++) {
            Oferta *o = &ofertas[n_ofertas++];
            o->turma = t; o->disc = turmas[t].disc[i]; o->prof = o->dia = o->slot = -1; o->motivo = 0;
        }
}
static void limpar_estado(void)
{
    memset(profOc, -1, sizeof profOc);
    memset(turmaOc, -1, sizeof turmaOc);
    reparos = 0;
}
static int aulas_de(int o) { return disciplinas[ofertas[o].disc].aulas; }

static int dia_ok(int disc, int p, int d)
{
    return relaxado || ((disciplinas[disc].dias & professores[p].dias) >> d & 1);
}

/* 0 = livre; 1 = professor ocupado; 2 = turma ocupada */
static int livre(int o, int p, int d, int k)
{
    for (int i = 0; i < aulas_de(o); i++) {
        if (profOc[p][d][k + i] >= 0) return 1;
        if (turmaOc[ofertas[o].turma][d][k + i] >= 0) return 2;
    }
    return 0;
}
static void colocar(int o, int p, int d, int k)
{
    ofertas[o].prof = p; ofertas[o].dia = d; ofertas[o].slot = k;
    for (int i = 0; i < aulas_de(o); i++) profOc[p][d][k + i] = turmaOc[ofertas[o].turma][d][k + i] = o;
}
static void remover(int o)
{
    Oferta *x = &ofertas[o];
    for (int i = 0; i < aulas_de(o); i++) profOc[x->prof][x->dia][x->slot + i] = turmaOc[x->turma][x->dia][x->slot + i] = -1;
    x->prof = x->dia = x->slot = -1;
}

/* Todas as posições possíveis (professor habilitado x dia permitido x início do bloco). */
static int candidatos(int o, Cand *c)
{
    int n = aulas_de(o), lo = turmas[ofertas[o].turma].turno * SLOTS_TURNO, m = 0;
    const Disciplina *d = &disciplinas[ofertas[o].disc];
    if (n > SLOTS_TURNO) return 0;
    for (int pi = 0; pi < d->nhab; pi++)
        for (int dia = 0; dia < N_DIAS; dia++) {
            if (!dia_ok(ofertas[o].disc, d->hab[pi], dia)) continue;
            for (int k = lo; k <= lo + SLOTS_TURNO - n; k++) {
                c[m].prof = d->hab[pi]; c[m].dia = dia; c[m].slot = k; c[m].ordem = pi; m++;
            }
        }
    return m;
}
static int carga(int t, int d)
{
    int n = 0;
    for (int k = 0; k < SLOTS_DIA; k++) if (turmaOc[t][d][k] >= 0) n++;
    return n;
}
static void trace_colocar(int o)
{
    char pn[32]; primeiro_nome(professores[ofertas[o].prof].nome, pn, sizeof pn);
    printf("  profOc[%s][%s][%d..%d]: livre -> oferta#%d (%s %s)\n", pn, NOME_DIA[ofertas[o].dia],
           ofertas[o].slot, ofertas[o].slot + aulas_de(o) - 1, o, curto(ofertas[o].turma), disciplinas[ofertas[o].disc].sigla);
}

/* Escolhe o melhor lugar: titular antes dos substitutos; depois espalha pelos dias. */
static int tentar(int o)
{
    Cand c[MAX_CAND];
    int m = candidatos(o, c), b = -1, bs = 0, t = ofertas[o].turma;
    for (int i = 0; i < m; i++) {
        if (livre(o, c[i].prof, c[i].dia, c[i].slot)) continue;
        int s = c[i].ordem * 1000 + carga(t, c[i].dia) * 100 + c[i].dia * 10 + c[i].slot % SLOTS_TURNO;
        if (b < 0 || s < bs) { b = i; bs = s; }
    }
    if (b < 0) return 0;
    colocar(o, c[b].prof, c[b].dia, c[b].slot);
    if (trace && !em_reparo) trace_colocar(o);
    return 1;
}

/* Reparo: libera um lugar movendo até 2 ofertas já colocadas; desfaz tudo (rollback) se não der. */
static int reparar(int o, int falar)
{
    Cand c[MAX_CAND];
    int m = candidatos(o, c), t = ofertas[o].turma;

    for (int i = 0; i < m; i++) {
        int p = c[i].prof, d = c[i].dia, k = c[i].slot, bl[8], nb = 0;
        for (int j = 0; j < aulas_de(o); j++) {
            int xs[2] = { profOc[p][d][k + j], turmaOc[t][d][k + j] };
            for (int q = 0; q < 2; q++) {
                int novo = xs[q] >= 0;
                for (int r = 0; r < nb; r++) if (bl[r] == xs[q]) novo = 0;
                if (novo) bl[nb++] = xs[q];
            }
        }
        if (nb == 0 || nb > 2) continue;

        int op[2], od[2], ok[2];
        for (int r = 0; r < nb; r++) { op[r] = ofertas[bl[r]].prof; od[r] = ofertas[bl[r]].dia; ok[r] = ofertas[bl[r]].slot; remover(bl[r]); }
        colocar(o, p, d, k);

        em_reparo = 1;
        int deu = 1;
        for (int r = 0; r < nb && deu; r++) if (!tentar(bl[r])) deu = 0;
        em_reparo = 0;

        if (deu) {
            if (falar) {
                cor(AMARELO);
                printf("  ↪ REPARO: %s %s foi para %s; moveu %d oferta(s) para abrir espaço\n",
                       curto(t), disciplinas[ofertas[o].disc].sigla, NOME_DIA[d], nb);
                cor(RESET);
            }
            reparos += nb;
            return 1;
        }
        for (int r = 0; r < nb; r++) if (ofertas[bl[r]].dia >= 0) remover(bl[r]);   /* rollback */
        remover(o);
        for (int r = 0; r < nb; r++) colocar(bl[r], op[r], od[r], ok[r]);
    }
    return 0;
}

static void fase1_gulosa(int falar)
{
    int ordem[MAX_OFERTAS], vi[MAX_OFERTAS];
    Cand tmp[MAX_CAND];
    for (int o = 0; o < n_ofertas; o++) { ordem[o] = o; vi[o] = candidatos(o, tmp); }

    for (int i = 1; i < n_ofertas; i++) {          /* insertion sort estável: razão vi/aulas crescente */
        int x = ordem[i], j = i - 1;
        while (j >= 0 && vi[ordem[j]] * aulas_de(x) > vi[x] * aulas_de(ordem[j])) { ordem[j + 1] = ordem[j]; j--; }
        ordem[j + 1] = x;
    }
    for (int k = 0; k < n_ofertas; k++) {
        int o = ordem[k];
        if (falar && trace) printf("  ▸ %s %s (%d posições viáveis, %d aulas)\n", curto(ofertas[o].turma),
                                   disciplinas[ofertas[o].disc].sigla, vi[o], aulas_de(o));
        tentar(o);
    }
    if (falar) {
        int ok = 0;
        for (int o = 0; o < n_ofertas; o++) if (ofertas[o].dia >= 0) ok++;
        printf("  Fase 1 (gulosa): %d de %d disciplinas alocadas.\n", ok, n_ofertas);
    }
}

static void classificar_motivos(void)
{
    Cand c[MAX_CAND];
    for (int o = 0; o < n_ofertas; o++) {
        if (ofertas[o].dia >= 0) continue;
        if (aulas_de(o) > SLOTS_TURNO) { ofertas[o].motivo = M_CARGA; continue; }
        int m = candidatos(o, c), c1 = 0, c2 = 0;
        if (m == 0) { ofertas[o].motivo = M_SEM_DIA; continue; }
        for (int i = 0; i < m; i++) { if (livre(o, c[i].prof, c[i].dia, c[i].slot) == 1) c1++; else c2++; }
        ofertas[o].motivo = c1 >= c2 ? M_PROF_OCUPADO : M_TURMA_OCUPADA;
    }
}

static void fase2_reparo(int falar)
{
    for (int passada = 0, prog = 1; prog && passada < 4; passada++) {
        prog = 0;
        for (int o = 0; o < n_ofertas; o++)
            if (ofertas[o].dia < 0 && (tentar(o) || reparar(o, falar))) prog = 1;
    }
    classificar_motivos();
    if (falar && reparos == 0) printf("  Fase 2 (reparo): nenhum reparo foi necessário ou possível.\n");
}

/* Validador independente: reconfere todas as regras sobre a grade final. */
static int verificar_grade(int imprimir)
{
    int viol = 0;
    static int seenP[MAX_PROFS][N_DIAS][SLOTS_DIA], seenT[MAX_TURMAS][N_DIAS][SLOTS_DIA];
    memset(seenP, 0, sizeof seenP); memset(seenT, 0, sizeof seenT);
    for (int o = 0; o < n_ofertas; o++) {
        const Oferta *x = &ofertas[o];
        if (x->dia < 0) continue;
        int n = aulas_de(o), erro = 0;
        if (x->slot / SLOTS_TURNO != turmas[x->turma].turno || (x->slot + n - 1) / SLOTS_TURNO != turmas[x->turma].turno) erro = 1;
        int habil = 0;
        for (int h = 0; h < disciplinas[x->disc].nhab; h++) if (disciplinas[x->disc].hab[h] == x->prof) habil = 1;
        if (!habil || !dia_ok(x->disc, x->prof, x->dia)) erro = 1;
        for (int i = 0; i < n; i++) {
            if (seenP[x->prof][x->dia][x->slot + i]++) erro = 1;
            if (seenT[x->turma][x->dia][x->slot + i]++) erro = 1;
        }
        if (erro) { viol++; if (imprimir) printf("  ✖ violação: %s %s\n", curto(x->turma), disciplinas[x->disc].sigla); }
    }
    return viol;
}

static void simular(int falar)
{
    construir_ofertas();
    limpar_estado();
    fase1_gulosa(falar);
    fase2_reparo(falar);
    violacoes = verificar_grade(0);
    simulado = 1;
}
static int garantir_simulacao(void)
{
    if (n_turmas == 0) { printf("\n  Nenhuma turma cadastrada. Crie turmas no menu 1 (ou carregue o exemplo no menu 9).\n"); return 0; }
    if (!simulado) simular(0);
    return 1;
}

/* ========================================================================== */
/* 4. TELAS DE RESULTADO                                                      */
/* ========================================================================== */
static int buscar(int dia, int k, int tipo, int id)    /* tipo 0 = turma, 1 = professor */
{
    for (int o = 0; o < n_ofertas; o++) {
        const Oferta *x = &ofertas[o];
        if (x->dia != dia || k < x->slot || k >= x->slot + aulas_de(o)) continue;
        if ((tipo == 0 ? x->turma : x->prof) == id) return o;
    }
    return -1;
}

static void imprimir_grade(const char *titulo, int tipo, int id, int lo, int hi)
{
    printf("\n"); cor(NEGRITO); printf("  %s\n", titulo); cor(RESET);
    printf("  "); campo("", 12);
    for (int d = 0; d < N_DIAS; d++) { printf("│ "); campo(NOME_DIA[d], 17); }
    printf("\n  "); repetir("─", 12);
    for (int d = 0; d < N_DIAS; d++) { printf("┼"); repetir("─", 18); }
    printf("\n");
    for (int k = lo; k < hi; k++) {
        for (int linha = 0; linha < 2; linha++) {
            printf("  "); campo(linha ? "" : SLOT_LABEL[k], 12);
            for (int d = 0; d < N_DIAS; d++) {
                int o = buscar(d, k, tipo, id);
                printf("│ ");
                if (o < 0) { campo("", 17); continue; }
                cor_disc(ofertas[o].disc);
                char txt[96];
                if (linha == 0) snprintf(txt, sizeof txt, "%s", disciplinas[ofertas[o].disc].nome);
                else if (tipo == 0) {
                    char pn[32]; primeiro_nome(professores[ofertas[o].prof].nome, pn, 32);
                    snprintf(txt, sizeof txt, "%s%s", pn, ofertas[o].prof != disciplinas[ofertas[o].disc].hab[0] ? " (sub)" : "");
                } else snprintf(txt, sizeof txt, "%s", curto(ofertas[o].turma));
                campo(txt, 17);
                cor(RESET);
            }
            printf("\n");
        }
    }
}
static void grade_turma(int t)
{
    char tit[96]; snprintf(tit, sizeof tit, "%s · turno %s", turmas[t].codigo, NOME_TURNO[turmas[t].turno]);
    imprimir_grade(tit, 0, t, turmas[t].turno * SLOTS_TURNO, turmas[t].turno * SLOTS_TURNO + SLOTS_TURNO);
}
static void grade_prof(int p)
{
    char tit[64]; snprintf(tit, sizeof tit, "Agenda de %s", professores[p].nome);
    imprimir_grade(tit, 1, p, 0, SLOTS_DIA);
}

static void imprimir_conflitos(void)
{
    int n = 0;
    for (int o = 0; o < n_ofertas; o++) {
        if (ofertas[o].dia >= 0) continue;
        n++;
        cor(VERMELHO);
        printf("  ✖ %s (%s): %d aulas sem horário\n", disciplinas[ofertas[o].disc].nome, turmas[ofertas[o].turma].codigo, aulas_de(o));
        cor(RESET);
        printf("      Causa:    %s\n      Sugestão: %s\n", TEXTO_MOTIVO[ofertas[o].motivo], SUGESTAO[ofertas[o].motivo]);
    }
    if (!n) { cor(VERDE); printf("  ✔ Nenhum conflito: todas as disciplinas foram alocadas.\n"); cor(RESET); }
}

static void imprimir_estatisticas(void)
{
    int tot = 0, col = 0, ofs = 0, subs = 0;
    for (int o = 0; o < n_ofertas; o++) {
        tot += aulas_de(o);
        if (ofertas[o].dia >= 0) {
            col += aulas_de(o); ofs++;
            if (ofertas[o].prof != disciplinas[ofertas[o].disc].hab[0]) subs++;
        }
    }
    printf("  Aulas alocadas:  %d de %d   ", col, tot); barra(col, tot, 30); printf(" %d%%\n", tot ? (col * 100 + tot / 2) / tot : 0);
    printf("  Disciplinas alocadas: %d de %d\n", ofs, n_ofertas);
    printf("  Com professor substituto: %d\n", subs);
    printf("  Reparos realizados (ofertas movidas): %d\n", reparos);
    printf("\n  Uso dos professores (dias usados / dias disponíveis):\n");
    for (int p = 0; p < n_profs; p++) {
        int usados = 0, aulas = 0, disp = 0;
        for (int d = 0; d < N_DIAS; d++) {
            int usa = 0;
            for (int k = 0; k < SLOTS_DIA; k++) if (profOc[p][d][k] >= 0) { usa = 1; aulas++; }
            usados += usa;
            disp += relaxado ? 1 : (professores[p].dias >> d & 1);
        }
        printf("    "); campo(professores[p].nome, 16); printf(" "); barra(usados, disp, 20);
        printf(" %d/%d dias · %d aulas\n", usados, disp, aulas);
    }
}

static void imprimir_verificacao(void)
{
    int v = verificar_grade(1);
    if (v == 0) {
        cor(VERDE);
        printf("  ✔ 0 violações: nenhuma disciplina fragmentada em vários dias, nenhum professor ou\n"
               "    turma em dois lugares ao mesmo tempo, e só professores habilitados e disponíveis.\n");
        cor(RESET);
    } else { cor(VERMELHO); printf("  ✖ %d violação(ões) encontrada(s)!\n", v); cor(RESET); }
}

static void relatorio_completo(void)
{
    if (!garantir_simulacao()) return;
    secao(relaxado ? "CENÁRIO B · restrições de dias liberadas" : "CENÁRIO A · com restrições de dias");
    printf("  %d turmas · %d professores · %d disciplinas ofertadas\n", n_turmas, n_profs, n_ofertas);
    secao("GRADES SEMANAIS POR TURMA");
    for (int t = 0; t < n_turmas; t++) grade_turma(t);
    secao("CONFLITOS NÃO RESOLVIDOS");
    imprimir_conflitos();
    secao("VERIFICAÇÃO INDEPENDENTE DAS REGRAS");
    imprimir_verificacao();
    secao("ESTATÍSTICAS");
    imprimir_estatisticas();
}

static void resumo_simulacao(void)
{
    if (n_turmas == 0) { printf("\n  Nenhuma turma cadastrada.\n"); return; }
    printf("\n"); cor(NEGRITO); printf("  Simulação · %s\n", relaxado ? "cenário B (restrições liberadas)" : "cenário A (com restrições)"); cor(RESET);
    simular(1);
    int tot = 0, col = 0, cf = 0;
    for (int o = 0; o < n_ofertas; o++) { tot += aulas_de(o); if (ofertas[o].dia >= 0) col += aulas_de(o); else cf++; }
    printf("\n  Aulas alocadas: %d de %d   ", col, tot); barra(col, tot, 24); printf(" %d%%\n", tot ? (col * 100 + tot / 2) / tot : 0);
    printf("  Conflitos: %d   Reparos: %d   Violações: ", cf, reparos);
    cor(violacoes ? VERMELHO : VERDE); printf("%d\n", violacoes); cor(RESET);
    if (cf) { printf("\n"); imprimir_conflitos(); }
}

/* ========================================================================== */
/* 5. ARQUIVO DE DADOS (JSON escrito e lido à mão)                            */
/* ========================================================================== */
static void json_str(FILE *f, const char *s)
{
    fputc('"', f);
    for (; *s; s++) {
        if (*s == '"' || *s == '\\') fputc('\\', f);
        if ((unsigned char)*s >= 32) fputc(*s, f);
    }
    fputc('"', f);
}

static int salvar_json(const char *arq)
{
    FILE *f = fopen(arq, "w");
    if (!f) return 0;
    fprintf(f, "{\n  \"versao\": 3,\n  \"rel\": %s,\n  \"hab\": {", relaxado ? "true" : "false");
    for (int d = 0; d < n_disc; d++) {
        fprintf(f, "%s\"%d\": [", d ? ", " : "", d);
        for (int i = 0; i < disciplinas[d].nhab; i++) fprintf(f, "%s%d", i ? ", " : "", disciplinas[d].hab[i]);
        fprintf(f, "]");
    }
    fprintf(f, "},\n  \"turmas\": [\n");
    for (int t = 0; t < n_turmas; t++) {
        fprintf(f, "    {\"cod\": "); json_str(f, turmas[t].codigo);
        fprintf(f, ", \"nome\": "); json_str(f, turmas[t].nome);
        fprintf(f, ", \"turno\": %d, \"discs\": [", turmas[t].turno);
        for (int i = 0; i < turmas[t].ndisc; i++) fprintf(f, "%s%d", i ? ", " : "", turmas[t].disc[i]);
        fprintf(f, "]}%s\n", t + 1 < n_turmas ? "," : "");
    }
    fprintf(f, "  ]\n}\n");
    return fclose(f) == 0;
}

typedef struct { const char *p; } Cur;
static void ws(Cur *c) { while (*c->p == ' ' || *c->p == '\n' || *c->p == '\t' || *c->p == '\r') c->p++; }
static int lit(Cur *c, char ch) { ws(c); if (*c->p != ch) return 0; c->p++; return 1; }
static int j_string(Cur *c, char *out, int tam)          /* out == NULL: só pula a string */
{
    int n = 0;
    ws(c);
    if (*c->p != '"') return 0;
    c->p++;
    while (*c->p && *c->p != '"') {
        if (*c->p == '\\' && c->p[1]) c->p++;
        if (out && n < tam - 1) out[n++] = *c->p;
        c->p++;
    }
    if (*c->p != '"') return 0;
    c->p++;
    if (out) out[n] = 0;
    return 1;
}
static int j_int(Cur *c, int *v)
{
    char *e;
    ws(c);
    long x = strtol(c->p, &e, 10);
    if (e == c->p) return 0;
    c->p = e; *v = (int)x;
    return 1;
}
static int j_skip(Cur *c)                                  /* pula qualquer valor JSON */
{
    ws(c);
    if (*c->p == '"') return j_string(c, NULL, 0);
    if (*c->p == '{' || *c->p == '[') {
        char fecha = *c->p == '{' ? '}' : ']';
        int obj = *c->p == '{';
        c->p++; ws(c);
        if (*c->p == fecha) { c->p++; return 1; }
        for (;;) {
            if (obj && (!j_string(c, NULL, 0) || !lit(c, ':'))) return 0;
            if (!j_skip(c)) return 0;
            ws(c);
            if (*c->p == ',') { c->p++; continue; }
            if (*c->p == fecha) { c->p++; return 1; }
            return 0;
        }
    }
    if (!*c->p) return 0;
    while (*c->p && *c->p != ',' && *c->p != '}' && *c->p != ']' && *c->p != ' ' && *c->p != '\n' && *c->p != '\r' && *c->p != '\t') c->p++;
    return 1;
}
static int j_int_array(Cur *c, int *v, int max, int *n)
{
    *n = 0;
    if (!lit(c, '[')) return 0;
    ws(c);
    if (*c->p == ']') { c->p++; return 1; }
    for (;;) {
        int x;
        if (!j_int(c, &x)) return 0;
        if (*n < max) v[(*n)++] = x;
        ws(c);
        if (*c->p == ',') { c->p++; continue; }
        if (*c->p == ']') { c->p++; return 1; }
        return 0;
    }
}

static int ler_turma_json(Cur *c, Turma *t)
{
    char chave[32];
    int tmp[256], n;
    memset(t, 0, sizeof *t); t->turno = -1;
    if (!lit(c, '{')) return 0;
    ws(c);
    if (*c->p == '}') { c->p++; return 1; }
    for (;;) {
        if (!j_string(c, chave, sizeof chave) || !lit(c, ':')) return 0;
        if      (!strcmp(chave, "cod"))   { if (!j_string(c, t->codigo, sizeof t->codigo)) return 0; }
        else if (!strcmp(chave, "nome"))  { if (!j_string(c, t->nome, sizeof t->nome)) return 0; }
        else if (!strcmp(chave, "turno")) { if (!j_int(c, &t->turno)) return 0; }
        else if (!strcmp(chave, "discs")) {
            if (!j_int_array(c, tmp, 256, &n)) return 0;
            for (int i = 0; i < n; i++) {                  /* ignora inválidas e repetidas */
                int ok = tmp[i] >= 0 && tmp[i] < n_disc;
                for (int j = 0; j < t->ndisc; j++) if (t->disc[j] == tmp[i]) ok = 0;
                if (ok && t->ndisc < MAX_DISC) t->disc[t->ndisc++] = tmp[i];
            }
        } else if (!j_skip(c)) return 0;
        ws(c);
        if (*c->p == ',') { c->p++; continue; }
        if (*c->p == '}') { c->p++; return 1; }
        return 0;
    }
}

/* Lê para variáveis temporárias; só altera o estado se o arquivo inteiro for válido. */
static int carregar_json(const char *arq)
{
    FILE *f = fopen(arq, "rb");
    if (!f) return 0;
    char *buf = malloc(1 << 20);
    if (!buf) { fclose(f); return 0; }
    size_t n = fread(buf, 1, (1 << 20) - 1, f);
    fclose(f);
    buf[n] = 0;

    static Turma tt[MAX_TURMAS];
    static int hab_t[MAX_DISC][MAX_PROFS], nhab_t[MAX_DISC];
    int nt = 0, rel = 0, ok = 1;
    for (int d = 0; d < MAX_DISC; d++) nhab_t[d] = 0;

    Cur c = { buf };
    char chave[32];
    if (!lit(&c, '{')) ok = 0;
    ws(&c);
    if (ok && *c.p == '}') c.p++;
    else while (ok) {
        if (!j_string(&c, chave, sizeof chave) || !lit(&c, ':')) { ok = 0; break; }
        ws(&c);
        if (!strcmp(chave, "rel")) { rel = strncmp(c.p, "true", 4) == 0; ok = j_skip(&c); }
        else if (!strcmp(chave, "turmas")) {
            if (!lit(&c, '[')) { ok = 0; break; }
            ws(&c);
            if (*c.p == ']') c.p++;
            else for (;;) {
                Turma t;
                if (!ler_turma_json(&c, &t)) { ok = 0; break; }
                if (t.codigo[0] && t.turno >= 0 && t.turno <= 2 && nt < MAX_TURMAS) tt[nt++] = t;
                ws(&c);
                if (*c.p == ',') { c.p++; continue; }
                if (*c.p == ']') { c.p++; break; }
                ok = 0; break;
            }
        } else if (!strcmp(chave, "hab")) {
            if (!lit(&c, '{')) { ok = 0; break; }
            ws(&c);
            if (*c.p == '}') c.p++;
            else for (;;) {
                char k[16]; int tmp[MAX_PROFS * 2], m;
                if (!j_string(&c, k, sizeof k) || !lit(&c, ':') || !j_int_array(&c, tmp, MAX_PROFS * 2, &m)) { ok = 0; break; }
                int d = atoi(k), u = 0, lista[MAX_PROFS];
                for (int i = 0; i < m; i++) {
                    int rep = tmp[i] < 0 || tmp[i] >= n_profs;
                    for (int j = 0; j < u; j++) if (lista[j] == tmp[i]) rep = 1;
                    if (!rep && u < MAX_PROFS) lista[u++] = tmp[i];
                }
                if (d >= 0 && d < n_disc && u >= 2) { memcpy(hab_t[d], lista, sizeof(int) * u); nhab_t[d] = u; }
                ws(&c);
                if (*c.p == ',') { c.p++; continue; }
                if (*c.p == '}') { c.p++; break; }
                ok = 0; break;
            }
        } else ok = j_skip(&c);
        if (!ok) break;
        ws(&c);
        if (*c.p == ',') { c.p++; continue; }
        if (*c.p == '}') break;
        ok = 0;
    }
    free(buf);
    if (!ok) return 0;

    n_turmas = nt;
    memcpy(turmas, tt, sizeof(Turma) * nt);
    relaxado = rel;
    restaurar_hab();
    for (int d = 0; d < n_disc; d++)
        if (nhab_t[d] >= 2) { disciplinas[d].nhab = nhab_t[d]; memcpy(disciplinas[d].hab, hab_t[d], sizeof(int) * nhab_t[d]); }
    simulado = 0;
    return 1;
}

static void exportar_csv(const char *arquivo)
{
    FILE *f = fopen(arquivo, "w");
    if (!f) { printf("  Não foi possível criar %s\n", arquivo); return; }
    fprintf(f, "turma,disciplina,professor,dia,inicio,fim,aulas\n");
    int n = 0;
    for (int o = 0; o < n_ofertas; o++) {
        const Oferta *x = &ofertas[o];
        if (x->dia < 0) continue;
        char ini[8], fim[8];
        snprintf(ini, sizeof ini, "%.5s", SLOT_LABEL[x->slot]);
        snprintf(fim, sizeof fim, "%s", SLOT_LABEL[x->slot + aulas_de(o) - 1] + 6);
        fprintf(f, "%s,\"%s\",\"%s\",%s,%s,%s,%d\n", turmas[x->turma].codigo, disciplinas[x->disc].nome,
                professores[x->prof].nome, NOME_DIA[x->dia], ini, fim, aulas_de(o));
        n++;
    }
    fclose(f);
    printf("  %d disciplinas exportadas para %s\n", n, arquivo);
}

/* ========================================================================== */
/* 6. CADASTROS (turmas, professores habilitados)                             */
/* ========================================================================== */
static int total_aulas_turma(const Turma *t)
{
    int s = 0;
    for (int i = 0; i < t->ndisc; i++) s += disciplinas[t->disc[i]].aulas;
    return s;
}
static void listar_turmas(void)
{
    if (!n_turmas) { printf("\n  Nenhuma turma cadastrada.\n"); return; }
    printf("\n  Nº  Código            Turno   Disciplinas  Aulas/sem\n");
    for (int t = 0; t < n_turmas; t++) {
        printf("  %-3d ", t + 1); campo(turmas[t].codigo, 17);
        printf(" %-7s %-12d %d\n", NOME_TURNO[turmas[t].turno], turmas[t].ndisc, total_aulas_turma(&turmas[t]));
    }
}
static void listar_disciplinas(const Turma *marca)
{
    printf("\n");
    for (int d = 0; d < n_disc; d++) {
        int sel = 0;
        if (marca) for (int i = 0; i < marca->ndisc; i++) if (marca->disc[i] == d) sel = 1;
        printf("  %s%2d) %-4s ", marca ? (sel ? "[x] " : "[ ] ") : "", d + 1, disciplinas[d].sigla);
        campo(disciplinas[d].nome, 31);
        printf(" %d aulas  ", disciplinas[d].aulas);
        for (int i = 0; i < disciplinas[d].nhab; i++) {
            char pn[32]; primeiro_nome(professores[disciplinas[d].hab[i]].nome, pn, 32);
            printf("%s%s%s%s", i ? ", " : "", i == 0 && usar_cor ? NEGRITO : "", pn, i == 0 && usar_cor ? RESET : "");
        }
        printf("\n");
    }
}
static void escolher_disciplinas(Turma *t)
{
    char b[256]; int v[64];
    for (;;) {
        printf("\n  Disciplinas da turma (%d marcadas, %d aulas/sem):", t->ndisc, total_aulas_turma(t));
        listar_disciplinas(t);
        ler_texto("\n  Números para marcar/desmarcar (ex: 1 2 5). Enter para concluir: ", b, sizeof b);
        if (!b[0]) return;
        int n = extrair_ints(b, v, 64);
        for (int i = 0; i < n; i++) {
            int d = v[i] - 1, pos = -1;
            if (d < 0 || d >= n_disc) { printf("  Número %d inválido.\n", v[i]); continue; }
            for (int j = 0; j < t->ndisc; j++) if (t->disc[j] == d) pos = j;
            if (pos >= 0) { for (int j = pos; j + 1 < t->ndisc; j++) t->disc[j] = t->disc[j + 1]; t->ndisc--; }
            else if (t->ndisc < MAX_DISC) t->disc[t->ndisc++] = d;
        }
    }
}
static void form_turma(int idx)                     /* idx < 0: nova turma */
{
    if (idx < 0 && n_turmas >= MAX_TURMAS) { printf("\n  Limite de %d turmas atingido.\n", MAX_TURMAS); return; }
    Turma t; char b[64];
    if (idx >= 0) t = turmas[idx]; else { memset(&t, 0, sizeof t); t.turno = 2; }

    printf("\n  %s\n", idx >= 0 ? "Editar turma (Enter mantém o valor atual)" : "Nova turma");
    snprintf(b, sizeof b, "  Código%s%s%s: ", idx >= 0 ? " [" : " (ex: CC-2026.1-7A)", idx >= 0 ? t.codigo : "", idx >= 0 ? "]" : "");
    char cod[sizeof t.codigo];
    ler_texto(b, cod, sizeof cod);
    if (!cod[0]) { if (idx < 0) { printf("  Cancelado.\n"); return; } }
    else {
        for (int i = 0; i < n_turmas; i++)
            if (i != idx && !strcmp(turmas[i].codigo, cod)) { printf("  Já existe uma turma com esse código.\n"); return; }
        snprintf(t.codigo, sizeof t.codigo, "%s", cod);
    }
    char nm[sizeof t.nome];
    ler_texto("  Nome (opcional): ", nm, sizeof nm);
    if (nm[0]) snprintf(t.nome, sizeof t.nome, "%s", nm);

    printf("  Turno: 1) Manhã  2) Tarde  3) Noite   [atual: %s]\n", NOME_TURNO[t.turno]);
    ler_texto("  Turno (Enter mantém): ", b, sizeof b);
    if (b[0] >= '1' && b[0] <= '3') t.turno = b[0] - '1';

    escolher_disciplinas(&t);

    if (idx >= 0) turmas[idx] = t; else turmas[n_turmas++] = t;
    mudou = 1; simulado = 0;
    printf("\n  Turma %s salva (%d disciplinas, %d aulas/semana).\n", t.codigo, t.ndisc, total_aulas_turma(&t));
}
static void menu_turmas(void)
{
    while (!fim_entrada) {
        printf("\n"); cor(NEGRITO); printf("──────── TURMAS ────────\n"); cor(RESET);
        printf(" 1) Listar\n 2) Criar\n 3) Editar\n 4) Excluir\n 0) Voltar\n");
        switch (ler_int("Opção: ", 0, 4)) {
        case 0: return;
        case 1: listar_turmas(); break;
        case 2: form_turma(-1); break;
        case 3: if (n_turmas) { listar_turmas(); form_turma(ler_int("Turma nº: ", 1, n_turmas) - 1); } else printf("\n  Nenhuma turma cadastrada.\n"); break;
        case 4:
            if (!n_turmas) { printf("\n  Nenhuma turma cadastrada.\n"); break; }
            listar_turmas();
            int i = ler_int("Turma nº: ", 1, n_turmas) - 1;
            if (confirmar("  Excluir esta turma?")) {
                for (int j = i; j + 1 < n_turmas; j++) turmas[j] = turmas[j + 1];
                n_turmas--; mudou = 1; simulado = 0; printf("  Turma excluída.\n");
            }
            break;
        }
    }
}

static void editar_habilitados(void)
{
    listar_disciplinas(NULL);
    int d = ler_int("\n  Disciplina nº (0 cancela): ", 0, n_disc) - 1;
    if (d < 0) return;
    printf("\n  Professores:\n");
    for (int p = 0; p < n_profs; p++) printf("   %d) %s\n", p + 1, professores[p].nome);
    char b[128]; int v[MAX_PROFS * 2], lista[MAX_PROFS], u = 0;
    printf("\n  %s: ", disciplinas[d].nome);
    for (int i = 0; i < disciplinas[d].nhab; i++) printf("%s%s", i ? ", " : "", professores[disciplinas[d].hab[i]].nome);
    printf("\n");
    ler_texto("  Novos professores habilitados, titular primeiro (ex: 6 4 1). Enter cancela: ", b, sizeof b);
    if (!b[0]) return;
    int n = extrair_ints(b, v, MAX_PROFS * 2);
    for (int i = 0; i < n; i++) {
        int p = v[i] - 1, rep = p < 0 || p >= n_profs;
        for (int j = 0; j < u; j++) if (lista[j] == p) rep = 1;
        if (!rep && u < MAX_PROFS) lista[u++] = p;
    }
    if (u < 2) { printf("  Cada disciplina precisa de pelo menos 2 professores (números válidos e diferentes).\n"); return; }
    disciplinas[d].nhab = u;
    memcpy(disciplinas[d].hab, lista, sizeof(int) * u);
    mudou = 1; simulado = 0;
    printf("  Professores habilitados atualizados.\n");
}
static void menu_disciplinas(void)
{
    while (!fim_entrada) {
        printf("\n"); cor(NEGRITO); printf("──────── DISCIPLINAS (pré-cadastradas) ────────\n"); cor(RESET);
        printf(" 1) Listar disciplinas e professores habilitados (titular em negrito)\n 2) Editar professores habilitados de uma disciplina\n 3) Restaurar os professores habilitados originais\n 0) Voltar\n");
        switch (ler_int("Opção: ", 0, 3)) {
        case 0: return;
        case 1: listar_disciplinas(NULL); break;
        case 2: editar_habilitados(); break;
        case 3: if (confirmar("  Restaurar a lista original de todas as disciplinas?")) { restaurar_hab(); mudou = 1; simulado = 0; printf("  Restaurado.\n"); } break;
        }
    }
}
static void listar_professores(void)
{
    printf("\n  Professores (pré-cadastrados) · disponibilidade por dia\n\n");
    for (int p = 0; p < n_profs; p++) {
        printf("  %d) ", p + 1); campo(professores[p].nome, 16);
        for (int d = 0; d < N_DIAS; d++) printf(" %s", (professores[p].dias >> d & 1) ? NOME_DIA[d] : "---");
        printf("   titular: ");
        int any = 0;
        for (int d = 0; d < n_disc; d++) if (disciplinas[d].hab[0] == p) { printf("%s%s", any++ ? "," : "", disciplinas[d].sigla); }
        if (!any) printf("-");
        printf("  substituto: ");
        any = 0;
        for (int d = 0; d < n_disc; d++)
            for (int i = 1; i < disciplinas[d].nhab; i++) if (disciplinas[d].hab[i] == p) printf("%s%s", any++ ? "," : "", disciplinas[d].sigla);
        if (!any) printf("-");
        printf("\n");
    }
}

static void menu_arquivo(void)
{
    char b[128];
    while (!fim_entrada) {
        printf("\n"); cor(NEGRITO); printf("──────── ARQUIVO ────────\n"); cor(RESET);
        printf(" 1) Salvar dados (%s)\n 2) Carregar dados\n 3) Carregar turmas de exemplo (5 turmas)\n"
               " 4) Apagar todas as turmas\n 5) Exportar grade em CSV\n 0) Voltar\n", arquivo_dados);
        switch (ler_int("Opção: ", 0, 5)) {
        case 0: return;
        case 1:
            ler_texto("  Nome do arquivo (Enter = padrão): ", b, sizeof b);
            if (b[0]) snprintf(arquivo_dados, sizeof arquivo_dados, "%s", b);
            if (salvar_json(arquivo_dados)) { mudou = 0; printf("  Dados salvos em %s\n", arquivo_dados); }
            else printf("  Não foi possível gravar %s\n", arquivo_dados);
            break;
        case 2:
            ler_texto("  Nome do arquivo (Enter = padrão): ", b, sizeof b);
            if (b[0]) snprintf(arquivo_dados, sizeof arquivo_dados, "%s", b);
            if (carregar_json(arquivo_dados)) { mudou = 0; printf("  %d turma(s) carregada(s) de %s\n", n_turmas, arquivo_dados); }
            else printf("  Arquivo não encontrado ou inválido: %s\n", arquivo_dados);
            break;
        case 3: if (!n_turmas || confirmar("  Isto substitui as turmas atuais. Continuar?")) { carregar_exemplo(); mudou = 1; printf("  Exemplo carregado.\n"); } break;
        case 4: if (confirmar("  Apagar todas as turmas?")) { limpar_turmas(); mudou = 1; simulado = 0; printf("  Turmas apagadas.\n"); } break;
        case 5:
            if (!garantir_simulacao()) break;
            ler_texto("  Nome do arquivo (Enter = grade.csv): ", b, sizeof b);
            exportar_csv(b[0] ? b : "grade.csv");
            break;
        }
    }
}

/* ========================================================================== */
/* 7. MENU PRINCIPAL                                                          */
/* ========================================================================== */
static void menu_principal(void)
{
    while (!fim_entrada) {
        printf("\n"); cor(NEGRITO); repetir("═", 56);
        printf("\n  SIGHA · %s · %d turma(s)%s\n", relaxado ? "Cenário B (liberado)" : "Cenário A", n_turmas, mudou ? " · alterações não salvas" : "");
        repetir("═", 56); printf("\n"); cor(RESET);
        printf(" 1) Turmas (criar, editar, excluir)\n 2) Disciplinas e professores habilitados\n 3) Professores\n"
               " 4) Simular e ver resumo\n 5) Grade de uma turma\n 6) Agenda de um professor\n 7) Conflitos\n"
               " 8) Relatório completo\n 9) Arquivo (salvar, carregar, exemplo, CSV)\n"
               "10) Alternar cenário (A com restrições / B liberado)\n11) Rastreio do algoritmo: %s\n 0) Sair\n", trace ? "LIGADO" : "desligado");
        switch (ler_int("Opção: ", 0, 11)) {
        case 0:
            if (mudou && confirmar("  Salvar as alterações antes de sair?")) {
                if (salvar_json(arquivo_dados)) printf("  Dados salvos em %s\n", arquivo_dados); else printf("  Não foi possível gravar %s\n", arquivo_dados);
            }
            return;
        case 1: menu_turmas(); break;
        case 2: menu_disciplinas(); break;
        case 3: listar_professores(); break;
        case 4: resumo_simulacao(); break;
        case 5:
            if (!garantir_simulacao()) break;
            listar_turmas(); grade_turma(ler_int("Turma nº: ", 1, n_turmas) - 1); break;
        case 6:
            if (!garantir_simulacao()) break;
            printf("\n"); for (int p = 0; p < n_profs; p++) printf("  %d) %s\n", p + 1, professores[p].nome);
            grade_prof(ler_int("Professor nº: ", 1, n_profs) - 1); break;
        case 7: if (garantir_simulacao()) { printf("\n"); imprimir_conflitos(); } break;
        case 8: relatorio_completo(); break;
        case 9: menu_arquivo(); break;
        case 10: relaxado = !relaxado; simulado = 0; mudou = 1; printf("\n  Agora: %s\n", relaxado ? "cenário B (restrições de dias liberadas)" : "cenário A (com restrições)"); break;
        case 11: trace = !trace; printf("\n  Rastreio %s (aparece ao usar \"Simular e ver resumo\").\n", trace ? "ligado" : "desligado"); break;
        }
    }
}

int main(int argc, char **argv)
{
    int auto_mode = 0, demo = 0;
    const char *json_out = NULL, *csv_out = NULL;
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);
    { HANDLE h = GetStdHandle(STD_OUTPUT_HANDLE); DWORD modo; if (GetConsoleMode(h, &modo)) SetConsoleMode(h, modo | 0x0004); }
#endif
    carregar_catalogo();
    limpar_turmas();

    for (int i = 1; i < argc; i++) {
        if      (!strcmp(argv[i], "--auto"))    auto_mode = 1;
        else if (!strcmp(argv[i], "--demo"))    demo = 1;
        else if (!strcmp(argv[i], "--trace"))   trace = 1;
        else if (!strcmp(argv[i], "--sem-cor")) usar_cor = 0;
        else if (!strcmp(argv[i], "--folgado")) relaxado = 1;
        else if (!strcmp(argv[i], "--arquivo") && i + 1 < argc) snprintf(arquivo_dados, sizeof arquivo_dados, "%s", argv[++i]);
        else if (!strcmp(argv[i], "--json") && i + 1 < argc) json_out = argv[++i];
        else if (!strcmp(argv[i], "--csv")  && i + 1 < argc) csv_out = argv[++i];
    }
    int forcar_folgado = relaxado;

    if (demo) carregar_exemplo();
    else if (carregar_json(arquivo_dados)) printf("Dados carregados de %s (%d turma(s)).\n", arquivo_dados, n_turmas);
    else if (auto_mode || json_out || csv_out) carregar_exemplo();
    if (forcar_folgado) relaxado = 1;

    if (json_out || csv_out) {                       /* modo silencioso: só exporta */
        usar_cor = 0;
#ifdef _WIN32
        if (!freopen("NUL", "w", stdout)) return 1;
#else
        if (!freopen("/dev/null", "w", stdout)) return 1;
#endif
        simular(0);
        if (json_out && !salvar_json(json_out)) return 1;
        if (csv_out) exportar_csv(csv_out);
        return 0;
    }
    if (auto_mode) { relatorio_completo(); return 0; }

    menu_principal();
    return 0;
}
