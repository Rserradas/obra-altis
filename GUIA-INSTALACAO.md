# Controlo de Obra ALTIS: guia de instalação

A aplicação tem duas partes:

1. **Os dados** (atividades, vistorias, fotografias, contas): ficam no **Firebase**, um serviço da Google. O plano gratuito chega para esta obra.
2. **A aplicação** (os ficheiros desta pasta): fica alojada num endereço web, por exemplo no **Netlify**, também gratuito.

Cada pessoa abre o endereço no telemóvel ou no computador, entra com email e palavra-passe e, se quiser, instala-a como app ("Adicionar ao ecrã principal"). Depois do primeiro acesso, funciona sem rede: as alterações ficam guardadas no aparelho e são enviadas quando houver ligação.

Enquanto o passo 1 não estiver feito, a aplicação abre em **modo de demonstração**, com os dados reais do cronograma, mas guardando tudo só no aparelho.

---

## Passo 1. Criar o projeto Firebase (cerca de 10 minutos)

1. Entre em https://console.firebase.google.com com uma conta Google e clique em **Criar projeto**. Nome sugerido: `obra-altis`. Pode desligar o Google Analytics.
2. **Base de dados**: no menu, *Criação* > *Firestore Database* > **Criar base de dados**. Localização: `europe-west1` (Bélgica) ou outra na Europa. Escolha **modo de produção**.
3. **Regras de acesso**: ainda no Firestore, abra o separador **Regras**, apague o que lá está, cole o conteúdo do ficheiro `firestore.rules` desta pasta e clique em **Publicar**.
   As regras já têm o email do dono de obra (`rodrigo.serradas@haegergroup.com`). Se quiser outro, troque-o neste ficheiro e no `config.js`.
4. **Contas**: *Criação* > *Authentication* > **Começar** > escolha **Email/palavra-passe** > ative > Guardar.
   No separador **Utilizadores**, clique em **Adicionar utilizador** e crie a sua conta (o email do dono de obra e uma palavra-passe).
5. **Ligar a aplicação ao projeto**: na página inicial do projeto, clique no ícone **</>** (Web), dê um nome (`app-obra`) e clique em Registar. Aparece um bloco `firebaseConfig = { apiKey: ..., ... }`.
   Abra o ficheiro `config.js` desta pasta num editor de texto (Bloco de Notas serve) e substitua `firebase: null,` por esse bloco, assim:

   ```js
   firebase: {
     apiKey: "AIza...",
     authDomain: "obra-altis.firebaseapp.com",
     projectId: "obra-altis",
     storageBucket: "obra-altis.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   },
   ```

## Passo 2. Pôr a aplicação online (cerca de 3 minutos)

1. Entre em https://app.netlify.com/drop (pode criar conta com o Google).
2. Arraste a pasta `app` inteira para a página.
3. O Netlify dá-lhe um endereço do tipo `https://nome-aleatorio.netlify.app`. Em *Site configuration* > *Change site name* pode trocar para algo como `obra-altis.netlify.app`.

**Como está instalado agora:** a aplicação está no repositório GitHub `Rserradas/obra-altis` (público) e o site `obra-altis.netlify.app` está ligado a esse repositório. Cada alteração enviada para o ramo `main` é publicada sozinha pelo Netlify em cerca de um minuto; o estado vê-se em *Project overview* > *Activity*. Se uma versão correr mal, em *Deploys* escolhe-se uma publicação anterior e clica-se em *Publish deploy* para voltar a ela.

Os dados da obra não estão no repositório: estão no Firebase e não são afetados pelas atualizações. O `config.js` só diz à aplicação qual é o projeto Firebase; a proteção dos dados é feita pelas contas e pelas regras (`firestore.rules`). Quando as regras mudam, é preciso colá-las de novo no Firebase (*Firestore* > *Regras* > *Publicar*).

## Passo 3. Primeiro arranque

1. Abra o endereço e entre com a sua conta.
2. A aplicação mostra **Importar cronograma**. Clique uma vez: carrega as 1.604 atividades extraídas do Excel.
3. Vá a **Definições**, separador **Acessos**, e adicione o empreiteiro e o fiscal (nome, email, palavra-passe inicial e perfil). A conta fica criada logo.
4. Envie a cada um o endereço, o email e a palavra-passe. Em "Esqueci-me da palavra-passe" podem definir uma nova.

## Passo 4. Validar a sequência

Em **Sequência** está uma proposta de ordem entre especialidades (por exemplo, louças sanitárias só depois de azulejos WC e teto falso) e uma duração padrão por fração, tirada da coluna "Dias STD" do Excel quando existia. Reveja e ajuste: cada alteração recalcula de imediato todas as datas da obra.

---

## O que cada perfil faz

| Perfil | Pode |
|---|---|
| Dono de obra | Ver tudo, definir a sequência e as durações, criar especialidades, eliminar atividades, gerir os acessos, e tudo o que os outros fazem |
| Empreiteiro | Iniciar e concluir atividades, atualizar a percentagem, indicar nova data e motivo, ligar atividades entre si, acrescentar atividades |
| Fiscal | Fazer vistorias por apartamento (percentagem por especialidade, nota e fotografias) |

## Apartamento: lista de atividades

No ecrã de cada apartamento, o separador **Atividades** mostra uma atividade por linha: um ponto com a cor do estado (com aro vermelho se estiver atrasada), o nome, de que está à espera, a barra no tempo, as datas previstas, o desvio e as percentagens do empreiteiro (E) e do fiscal (F). Passe o rato por cima para ver o detalhe; clique para abrir a ficha.

**Esconder concluídas**, ligado por defeito, deixa só o que falta fazer nessa fração (também na Vistoria do fiscal). Desligue para ver o histórico completo.

## Vistoria: fotografias e comentários

* **Juntar fotografias:** o botão da máquina fotográfica abre um menu com duas opções: **Tirar fotografia** (abre logo a câmara do telemóvel) ou **Escolher fotografias** (da galeria do telemóvel ou de uma pasta do computador, várias de uma vez).
* **Antes de guardar:** as fotografias aparecem em miniatura por baixo da especialidade; o × vermelho retira a que estiver a mais.
* **Comentários:** cada especialidade tem o botão de comentário para escrever o que viu (por exemplo, "falta selar junta do lavatório"). Pode guardar só um comentário, sem percentagem. A nota geral do topo junta-se a todas as especialidades da vistoria. O último comentário fica visível na vistoria seguinte e na ficha da atividade.
* **Ver as fotografias de uma especialidade:** quando uma especialidade já tem fotografias, aparece na linha (na Vistoria e no separador Atividades) um botão com o ícone de imagem e o número de fotografias. Abre-as em ecrã inteiro: setas (ou deslizar o dedo) para passar à seguinte, e o botão Apagar fotografia, com confirmação.
* **Apagar fotografias guardadas:** no fundo da Vistoria (e no separador Fotografias e na ficha da atividade), cada fotografia tem um ×. Pede confirmação antes de apagar. O fiscal e o empreiteiro apagam só as suas; o dono de obra pode apagar qualquer uma.

## A minha semana (empreiteiro)

O empreiteiro entra diretamente em **A minha semana**: o que está em curso (com quantas acabam esta semana), o que deve começar nos próximos 7 dias e o que está à espera de outras atividades, com o motivo. Pode filtrar por equipa e por bloco. Os botões **Iniciar**, **+10%** e **Concluir** gravam logo, sem abrir a ficha, e podem ser anulados.

## Ficha da atividade

A ficha abre em separadores: **Estado** (datas, execução ou vistoria), **Ligações** (de que depende e o que espera por ela), **Fotografias** e **Histórico**. Para o fiscal, a vistoria aparece em primeiro lugar.


**Navegar entre atividades:** no topo da ficha, **‹ Anterior** abre a atividade de que esta depende e **Seguinte ›** a que espera por ela. Se houver mais do que uma, o número aparece no botão e abre-se uma lista para escolher. **↩ Voltar** regressa à atividade que estava a ver antes.

**Trocar a atividade seguinte:** no separador Ligações, em "Atividades que esperam por esta", cada uma tem **Trocar** (escolhe a fração e a atividade que passa a esperar por esta, e a anterior deixa de esperar), **×** (deixa de esperar) e, no fim, **+ Acrescentar atividade seguinte**, de qualquer fração. A aplicação não mostra opções que criariam um ciclo. Tudo pode ser anulado.
## Painel: esta semana, datas por confirmar e relatório

* **Esta semana:** quantas atividades foram concluídas e iniciadas, quantas previsões mudaram, quantas vistorias e fotografias foram registadas nos últimos 7 dias, e quanto o fim previsto da obra mudou face à semana anterior. A aplicação guarda o fim previsto uma vez por dia, quando o dono de obra abre o Painel, por isso a comparação começa a aparecer uma semana depois do primeiro dia de uso.
* **Datas por confirmar:** as atividades que nunca tiveram data no Excel recebem a primeira data possível, o que torna o fim previsto otimista. O Painel avisa quantas são e o botão **Rever datas** abre-as nos Trabalhos (estado "Datas por confirmar"). Em cada uma, corrija a data com Editar datas ou carregue em **Confirmar**; também há **Confirmar as mostradas**, de uma vez.
* **Relatório para reunião:** no topo do Painel. Mostra o ponto de situação (fim previsto, totais, avanço por bloco, maiores atrasos por especialidade, situação de cada fração com a última vistoria, e os últimos comentários da fiscalização). **Imprimir ou guardar em PDF** usa a impressão do navegador; **Descarregar para Excel** gera um ficheiro com todas as atividades, que abre diretamente no Excel.

## Pesquisa rápida

No topo do menu lateral (no telemóvel, a lupa no topo). Escreva parte do código de uma fração (por exemplo "b-f503" ou "bf503") ou o nome de uma atividade ("louças", "pintura final"). Enter abre o primeiro resultado. No computador, a tecla / leva logo à pesquisa.

## Ajudas no dia a dia

* **Anular:** depois de cada alteração (datas, percentagens, vistorias, atividades criadas, sequência), a mensagem em baixo tem o botão **Anular** durante alguns segundos. As fotografias não são anuladas por aqui; apagam-se com o ×.
* **Guia rápido:** na primeira vez que cada pessoa entra, aparece um guia de três passos para o seu perfil. Pode voltar a vê-lo em **Ajuda** (no telemóvel, o "?" no topo).
* **Definições:** a sequência e as durações, as equipas de trabalho (dono e empreiteiro) e os acessos (só o dono de obra) estão juntos em **Definições**.
* **Vistoria:** a percentagem marca-se com botões grandes (0, 25, 50, 75, 100) e ajusta-se de 5 em 5 com − e +. Os cartões dos apartamentos mostram a data da última vistoria e há o filtro "Só as por vistoriar há mais de 7 dias". Dentro de cada apartamento, os botões ‹ e › passam ao anterior ou ao seguinte; depois de guardar a vistoria, a mensagem oferece ir logo para o seguinte.
* **Painel:** os maiores atrasos aparecem agrupados por especialidade, com o número de frações e o maior atraso; tocar leva aos Trabalhos já filtrados. Passe o rato sobre um atraso ou sobre "Atrasadas" para ver a explicação.
* **Gantt:** o botão **Hoje** volta a mostrar o dia de hoje.

## Repor filtros

O botão **Repor filtros** (no menu lateral; no telemóvel, "Repor" na barra de cima, que aparece quando há filtros aplicados) volta todos os ecrãs ao estado com que a aplicação abre: Trabalhos (todos os blocos, todas as atividades, fração, atividade e equipa em "Todas", pesquisa vazia, "Só atrasadas" desligado, "Esconder concluídas" ligado, sem ordenação e sem modo de edição), Gantt (todos os blocos fechados, escala em semanas), Apartamentos e mapa do Painel (todos os blocos). Também há um botão **Repor filtros** dentro dos Trabalhos e do Gantt quando há algum filtro aplicado. As vistorias que o fiscal ainda não guardou não se perdem.

## Trabalhos: filtros e datas

* **Filtros:** por bloco (A, B, C, D ou Geral, que reúne as atividades gerais e de exteriores), por estado (todas, próximas 2 semanas, não iniciadas, em curso, bloqueadas, atrasadas, concluídas), por tipo de fração (apartamentos, lojas, zonas comuns, geral), por apartamento ou fração, por atividade e por equipa, além da pesquisa livre. A lista de apartamentos acompanha o bloco escolhido. No ecrã de cada apartamento, o botão **Ver nos trabalhos** abre a lista já filtrada nessa fração. Cada estado mostra quantas atividades tem com os filtros escolhidos. "Só atrasadas" combina com qualquer estado, por exemplo "não iniciadas e atrasadas".
* **Esconder concluídas:** ligado por defeito, tira da lista tudo o que já está 100% concluído, para ver só o que falta fazer. Combina com os outros filtros. Para voltar a ver tudo, desligue a opção ou carregue em "mostrar". No estado "Concluídas" não se aplica.
* **Ordenar:** clique no título de qualquer coluna (Fração, Atividade, Estado, Início, Fim, Atraso, %). O segundo clique inverte a ordem e o terceiro volta à ordem normal. No Atraso e na percentagem, o primeiro clique mostra os maiores primeiro.
* **Editar datas:** o botão **Editar datas** (dono de obra e empreiteiro) transforma as colunas de início e fim em campos de data. Cada alteração fica guardada logo e as atividades que dependem dela acertam-se sozinhas.
  * Atividade por iniciar: o início é a nova previsão. Se as anteriores só acabarem mais tarde, a aplicação avisa e usa essa data. Um início igual ou anterior a hoje marca a atividade como iniciada. O fim define a duração, que se mantém se o início for empurrado.
  * Atividade em curso: o início corrige a data real em que começou e o fim é a nova previsão de conclusão.
  * Atividade concluída: as duas datas corrigem as datas reais.

## Equipas de trabalho

Em **Definições**, separador **Equipas de trabalho**, estão as equipas que fazem os trabalhos (mosaicos, pintura, carpintaria...). O dono de obra e o empreiteiro podem criá-las e editá-las. As equipas que vieram do Excel aparecem logo, marcadas "do Excel".

* **Criar ou editar:** nome, responsável, telefone, especialidades habituais e notas. Ao escolher as especialidades habituais, pode atribuir já a equipa a todos os trabalhos por fazer dessas especialidades que ainda não têm equipa. Se mudar o nome, os trabalhos da equipa ficam com o nome novo.
* **Cada cartão** mostra quantos trabalhos a equipa tem por fazer, em curso, atrasados e concluídos, e qual é o próximo. **Ver trabalhos** abre os Trabalhos filtrados nessa equipa.
* **Eliminar:** no fundo da edição. Os trabalhos da equipa ficam sem equipa ou passam para outra, à escolha.
* **Atribuir a um trabalho:** na ficha do trabalho, no campo **Equipa**. Também se pode criar uma equipa nova a partir daí.
* **Atribuir a vários de uma vez:** em **Trabalhos**, toque em **Atribuir equipa**. Aparece uma caixa de escolha em cada linha. Use os filtros (por exemplo Atividade "Azulejos WC" e Equipa "Sem equipa"), escolha as linhas ou **Escolher as N da lista**, escolha a equipa e toque em **Atribuir**. Também dá para retirar a equipa.
* O filtro **Equipa** dos Trabalhos tem a opção **Sem equipa**, e em **A minha semana** o empreiteiro filtra pela sua equipa.

## Criar e eliminar frações

Só o dono de obra.

* **Criar:** no ecrã Apartamentos, botão **+ Nova fração**. Escolha o tipo (apartamento, loja ou zona comum), o bloco e o piso; a aplicação sugere o código seguinte livre (por exemplo A-F701), que pode alterar. Pode criar a fração já com as especialidades padrão (todas ou só algumas), copiar as atividades de outra fração, ou deixá-la vazia. Com um início previsto, as datas ficam logo calculadas pela sequência e pelas durações.
* **Eliminar:** dentro da fração, botão **Eliminar fração**. Há três passos: primeiro diz o que vai ser apagado (número de atividades, quantas já concluídas e ligações de outras frações) e pede confirmação; depois pergunta de novo se tem a certeza; por fim, só elimina depois de escrever o código da fração. Pode cancelar em qualquer passo. As fotografias e o histórico ficam guardados.

## Ligar atividades entre apartamentos

Além da sequência por especialidade (dentro de cada apartamento), qualquer atividade pode ficar à espera de outra atividade específica, de qualquer fração.

* Na ficha da atividade, em **+ Ligar a outra atividade**, escolha a fração e a atividade. Ao mudar de fração, a aplicação sugere logo a mesma especialidade (por exemplo, pintura final do B-F504 depois da pintura final do B-F503).
* **Tipo de ligação:** "só começa quando a outra acabar" (o normal) ou "pode começar quando a outra começar" (trabalhos em paralelo).
* Não aparecem as atividades que já dependem desta, para não criar ciclos.
* Na lista "Depende de", as ligações a outras frações aparecem marcadas como **outra fração** e podem ser retiradas no ×.
* Ao criar uma **Nova atividade**, em "Ligar também a uma atividade específica", pode pôr todas as atividades criadas à espera de uma atividade concreta (por exemplo, a limpeza final de todos os apartamentos só depois do hall de entrada do bloco).

## Editar datas em qualquer ecrã

O dono de obra e o empreiteiro podem mudar datas em todo o lado, e a regra é sempre a mesma (ver acima):

* **Ficha da atividade:** abre a partir do Painel, do mapa, dos Apartamentos, dos Trabalhos e do Gantt. No topo, as datas da previsão (ou as reais, se já estiver concluída) são campos editáveis.
* **Apartamento:** no separador Atividades, o botão **Editar datas** mostra o início e o fim de cada atividade dessa fração para alterar.
* **Trabalhos:** botão **Editar datas**.
* **Gantt:** com o rato, arraste uma barra para mudar a data ou puxe a ponta direita para mudar o fim. No telemóvel, toque na barra e altere as datas no painel que aparece por cima.

## Gantt

O ecrã **Gantt** mostra cada atividade como uma barra entre o início e o fim previstos, com a cor do estado e um traço vermelho no dia de hoje. As setas ligam cada atividade às que dependem dela.

* **Filtros:** bloco (A, B, C, D ou geral), apartamento ou fração, e atividade. "Esconder concluídas" deixa só o que falta fazer.
* **Escala:** dias, semanas ou meses.
* **Abrir nível a nível:** o Gantt começa com uma linha por bloco (percentagem feita, fim previsto e número de atividades atrasadas). Toque num bloco para ver os seus apartamentos, lojas e zonas comuns, cada um com a sua linha-resumo. Toque num apartamento para ver as atividades. Volte a tocar para fechar.
* **Mostrar:** os botões **Blocos**, **Frações** e **Tudo** abrem ou fecham todos os níveis de uma vez. Escolher um bloco nos filtros abre esse bloco; escolher um apartamento abre logo as suas atividades.
* **Cadeia de dependências:** toque numa barra. A tarefa fica destacada, as setas da sua cadeia ficam a azul, as de que ela depende ficam marcadas a laranja e as que dependem dela a azul. Um painel por cima diz quantas são no total, de que está à espera e quantas ficam fora dos filtros (por exemplo, a mesma equipa noutro apartamento). Toque no nome à esquerda para abrir a ficha.
* No ecrã de cada apartamento há o botão **Ver no Gantt**, que abre o Gantt já filtrado nessa fração.

## Acrescentar atividades

No ecrã **Trabalhos**, botão **+ Nova atividade** (dono de obra e empreiteiro). Numa só ficha escolhe:

* **O que é:** uma especialidade que já existe ou uma atividade nova, com o nome que quiser. O dono de obra pode guardá-la como nova especialidade, e então ela passa a aparecer no ecrã Sequência e no mapa dos apartamentos.
* **Onde:** todos os apartamentos (pode limitar a alguns blocos), todas as lojas, as zonas comuns, o geral, ou frações escolhidas uma a uma.
* **Quando:** dias por fração, início previsto (opcional) e, se for a mesma equipa a fazer tudo, a opção de fazer uma fração de cada vez, encadeadas.
* **Só começa depois de:** as especialidades de que depende, dentro de cada fração.

Antes de criar, a ficha diz quantas atividades vão ser criadas. Dentro de um apartamento há também o botão **+ Nova atividade nesta fração**, e no ecrã Sequência o botão **+ Nova especialidade**.

Cada criação forma um lote (N1, N2...). Se houver um engano, o dono de obra abre uma das atividades e, no fundo da ficha, elimina só essa ou o lote inteiro.

## Previsão e atraso

Cada atividade tem duas linhas de datas na ficha: a **previsão** (início e fim previstos) e o **real** (quando de facto começou e acabou). Ambas se editam na ficha. Escrever o início real dá a atividade como iniciada; escrever o fim real dá-a como concluída nessa data; apagar o fim real reabre-a.

O **atraso** (os "+12 d" a vermelho) é sempre a diferença para a previsão de fim:

* **Atividade concluída:** data real de fim menos a previsão de fim. Se acabou mais cedo, aparece a verde com os dias de avanço.
* **Atividade por concluir:** se a previsão de fim já passou, hoje menos a previsão de fim. Se ainda não passou, está no prazo.

Uma atividade está **atrasada** quando a previsão de fim já passou e ainda não está concluída. A ficha mostra também o atraso de início: quantos dias depois do previsto começou, ou há quantos dias devia ter começado.

## Como as datas se recalculam

* Uma atividade só pode começar quando as anteriores estiverem concluídas (pela sequência por especialidade, pelas ligações que vieram do Excel e pelas que forem acrescentadas na ficha da atividade).
* A previsão não anda sozinha: fica na data prevista até alguém a mudar ou até as atividades anteriores a empurrarem.
* Quando uma atividade passa a previsão de fim sem estar concluída, as seguintes passam a contar com ela acabar a partir de hoje (hoje mais os dias que faltam, pela percentagem feita) e andam para a frente. No Gantt, esse prolongamento aparece como uma cauda riscada a vermelho a seguir à barra.
* **Data de início antes de a anterior acabar:** se escrever uma previsão de início antes de a atividade anterior acabar, a aplicação avisa ("Não pode começar a 10 nov") e diz qual é a atividade anterior e quando acaba. Pode começar na primeira data possível, abrir a atividade anterior para a rever (o botão Voltar regressa a esta), deixar de depender dela, ou cancelar.
* **Iniciar antes de a anterior acabar:** ao escrever o início real (ou tocar em Iniciar) com uma atividade anterior por acabar, a aplicação avisa e deixa ver essa atividade, iniciar mesmo assim, ou cancelar.
* **Mudar o fim de uma atividade:** quando o fim anda para a frente ou para trás e há atividades seguintes por iniciar, a aplicação mostra quantas são e pergunta. Para a frente: andam todas os mesmos dias, ou só as que ficariam a começar antes de esta acabar. Para trás: são puxadas todas os mesmos dias, ou ficam onde estão. Vale para a ficha, para os Trabalhos e para o arrastar no Gantt, e um único Anular desfaz tudo.
* O fim previsto de cada fração e da obra conta com este prolongamento, por isso é realista mesmo quando há previsões já ultrapassadas.
* A percentagem que conta é a do fiscal, se a vistoria for mais recente do que a atualização do empreiteiro.

## Custos e limites

* Firebase, plano gratuito (Spark): 1 GB de dados, 50.000 leituras e 20.000 escritas por dia. As fotografias são comprimidas (cerca de 200 a 400 KB cada), o que dá para alguns milhares. Se um dia faltar espaço, basta passar ao plano Blaze (paga só o que exceder).
* Netlify, plano gratuito: chega à vontade para três utilizadores.

## Ficheiros desta pasta

* `index.html`, `app.js`, `styles.css`, `engine.js` (motor de datas), `store.js` (dados e sincronização), `firebase.js` (biblioteca Firebase), `sw.js` (funcionamento offline), `manifest.webmanifest` e ícones: a aplicação.
* `config.js`: a configuração (o único ficheiro que tem de editar).
* `seed.json`: o cronograma extraído do Excel.
* `firestore.rules`: as regras de segurança da base de dados.
* `ferramentas/extrair.py`: o script que lê o Excel e gera o `seed.json`, se for preciso voltar a importar.
