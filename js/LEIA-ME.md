# Como o código está organizado

A aplicação abre em `app.js`, que só arranca o resto. O código de cada ecrã está num ficheiro desta pasta.

| Ficheiro | O que tem | Linhas |
|---|---|---|
| `ajuda.js` | Ajuda de cada ecrã e guia de primeira utilização. | 99 |
| `base.js` | Utilidades: datas, texto, ícones, filtros guardados, avisos (toast), permissões. | 247 |
| `calculo.js` | Cálculo do estado da obra a partir dos dados. | 80 |
| `definicoes.js` | Definições: sequência, simulação, acessos e cópia de segurança. | 522 |
| `equipas.js` | Equipas de trabalho e plano das equipas. | 719 |
| `estado.js` | Estado partilhado pela aplicação. Só se muda através das funções set...(), para todos os módulos verem o valor novo. | 19 |
| `ficha.js` | Ficha da atividade. | 407 |
| `gantt.js` | Gantt e caminho crítico. | 465 |
| `nova.js` | Criar e eliminar frações; nova atividade. | 427 |
| `nucleo.js` | Arranque, versão, desenho principal da página e login. | 355 |
| `painel.js` | Precisa de atenção e Painel. | 158 |
| `pendentes.js` | Pendentes: regras, lista, formulários e o ecrã Pendentes. | 335 |
| `plano.js` | Trabalhos: lista, escolha em massa, datas e gravação com as seguintes. | 895 |
| `previsao.js` | Fim da obra. | 242 |
| `segurar.js` | O que está a segurar a obra. | 202 |
| `semana.js` | A minha semana, relatório para reunião e pesquisa rápida. | 206 |
| `unidades.js` | Apartamentos, página da fração, vistoria e fotografias. | 534 |
| `vistorias.js` | Relatórios de vistoria. | 258 |

Fora desta pasta:

- `engine.js`: o motor de datas (dependências, filas das equipas, previsões e simulações).
- `store.js`: onde os dados são lidos e gravados (Firebase na app real, o próprio dispositivo na demo).
- `styles.css`: o aspeto.
- `sw.js`: guarda a aplicação no dispositivo para abrir sem rede. Um ficheiro novo em `js/` tem de entrar na lista `FILES`.

## Regras

- O estado partilhado (`S`, `store` e outros) está em `estado.js` e só se muda com as funções `set...()`.
- Para usar uma função de outro ficheiro, junte o nome ao `import` do topo.
- A versão muda em três sítios: `VERSAO` em `base.js`, `versao.json` e `CACHE` em `sw.js`.
