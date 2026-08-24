# PaliVida — guia de manutenção

Este documento explica **como o sistema funciona por dentro**, para quem for
dar manutenção, corrigir bugs ou adicionar funcionalidades no futuro sem
precisar reconstruir esse entendimento do zero. Para o histórico de decisões
de versões anteriores (o que foi unificado, corrigido ou substituído em cada
rodada de ajustes), veja a seção **"Histórico de mudanças"** ao final.

## 1. O que é este projeto, em uma frase

Um site estático (HTML + CSS + JavaScript puro, sem build, sem framework)
que simula um aplicativo de celular para acompanhamento de sintomas em
cuidados paliativos, com três perfis de usuário (Paciente, Cuidador,
Administrador) e um "banco de dados" inteiro rodando no `localStorage` do
navegador — não existe servidor, API externa nem banco de dados de verdade.

Isso foi uma escolha deliberada: como é uma demonstração/protótipo, hospedar
em qualquer servidor de arquivos estáticos (GitHub Pages, Netlify, Vercel,
ou até abrindo o `index.html` direto no navegador) já é suficiente para o
app funcionar por completo, dados incluídos.

## 2. Como abrir e testar

Duas opções:

1. **Duplo clique em `index.html`** — funciona offline. A única dependência
   externa é a fonte "Comfortaa" do Google Fonts (se não houver internet, o
   navegador usa uma fonte de sistema parecida e o layout não quebra).
2. **Subir a pasta inteira para qualquer host estático.** Não precisa de
   nenhuma etapa de build — é servir os arquivos como estão.

### Contas de demonstração

Senha `palivida123` para as três (a tela de login tem atalhos para
preencher automaticamente):

| Perfil | E-mail |
|---|---|
| Paciente | `paciente@palivida.local` |
| Cuidador | `cuidador@palivida.local` |
| Administrador | `admin@palivida.local` |

### Resetando os dados de teste

Os dados ficam em `localStorage` sob a chave `palivida_db_v1`. Para voltar
ao estado inicial (os dados de semente definidos em `js/data.js`), tem um
botão "Restaurar dados de demonstração" na tela de Prontuário, ou basta
apagar essa chave manualmente no DevTools do navegador
(Application → Local Storage) e recarregar a página.

## 3. Mapa geral da arquitetura

Não existe framework (nada de React/Vue) nem processo de build (nada de
Webpack/Vite) — é tudo `<script>` clássico carregado em sequência pelo
`index.html`, cada arquivo se registrando dentro de um único objeto global
`window.PV`, dividido em "módulos" por responsabilidade:

```
window.PV
├── session   (js/session.js)   → quem está logado agora (localStorage)
├── db        (js/db.js)        → "banco de dados" + regras de negócio
├── ui        (js/ui.js)        → pedaços de HTML/SVG reutilizáveis
├── router    (js/router.js)    → decide qual tela mostrar
└── screens   (js/screens/*.js) → uma função por tela, monta o HTML dela
```

A ordem de carregamento dos `<script>` no `index.html` importa, porque cada
arquivo depende do anterior já ter rodado e populado `window.PV`:

```
data.js → session.js → db.js → ui.js → router.js → screens/*.js → main.js
```

`js/main.js` é o ponto de entrada: só espera o DOM carregar e chama
`PV.router.renderizar()` uma primeira vez. Daí em diante, o próprio roteador
escuta o evento `hashchange` do navegador e se redesenha sozinho.

### 3.1 Por que hash-routing (`#/rota`) em vez de URLs de verdade

Um site 100% estático não tem servidor para configurar rewrites (o tipo de
regra que faz `/perfil` carregar `index.html` mesmo sem esse arquivo
existir de verdade no disco). Usar `#/perfil` resolve isso: o navegador
nunca manda essa parte da URL para o servidor, então qualquer host estático
funciona sem configuração nenhuma. `js/router.js` é quem interpreta o hash
atual e decide o que renderizar — ver seção 5.

### 3.2 Por que um "banco de dados" no navegador

Sem servidor, não tem onde guardar dados entre sessões a não ser no próprio
navegador. `js/db.js` reimplementa, com Promises e um atraso artificial
(`atraso()`, simulando latência de rede), a mesma superfície de uma API real
— login, CRUD de sintomas, registros, contatos etc. — mas gravando tudo em
`localStorage` (chave `palivida_db_v1`) em vez de conversar com um backend.
Trocar isso por uma API de verdade no futuro significa, em teoria, reescrever
só `js/db.js` mantendo a mesma "assinatura" de funções (`PV.db.auth.login(...)`,
`PV.db.registros.criar(...)` etc.) — as telas não precisariam mudar.

## 4. Estrutura de arquivos

```
PaliVida/
├── index.html              — casca da página (app-shell) + lista de <script>
├── README.md                — este arquivo
├── css/
│   └── styles.css           — todo o CSS do site, em um único arquivo
├── assets/img/               — ícones PNG do rodapé, logo, favicon
└── js/
    ├── data.js               — dados de semente (sintomas, conteúdos, usuários demo)
    ├── session.js             — sessão do usuário logado (localStorage)
    ├── db.js                  — "backend": banco de dados + regras de negócio
    ├── ui.js                  — cabeçalho, rodapé, ícones SVG, avisos, chips...
    ├── router.js               — roteador por hash + guarda de autenticação
    ├── main.js                 — ponto de entrada
    └── screens/
        ├── auth.js             — Login, Recuperar senha, Cadastro (paciente/cuidador)
        ├── principal.js        — Home, Contato, Busca de conteúdos, Dashboard admin
        ├── sintomas.js         — Menu de Sintomas, modal de intensidade, painel do
        │                         dia, conteúdo educativo por sintoma, tela de sinal
        ├── triagem.js          — Triagem por busca de sintomas + Laudo em PDF
        ├── perfil.js           — Prontuário (wizard de cadastro em etapas)
        └── admin.js            — Painel administrativo alternativo (sem acesso direto)
```

## 5. O roteador (`js/router.js`)

Cada navegação (mudar o hash da URL, ou chamar `PV.router.navegar('/rota')`)
dispara `renderizar()`, que faz, nesta ordem:

1. **Interpreta o hash** (`analisar()`): separa rota, sub-parâmetro de rota
   (ex.: `#/sinal/vermelho` → rota `sinal`, sub `vermelho`) e query string
   (`#/login?email=...` → `{ email: '...' }`).
2. **Verifica autenticação.** Se não há sessão válida e a rota não é
   `login`/`cadastro`, redireciona para `#/login`. Isso é o único "guard" de
   acesso do sistema — não há verificação de permissão adicional nas telas
   (essa fica a cargo de `js/db.js`, na camada de dados — ver seção 6).
3. **Monta cabeçalho e rodapé globais.** Eles vivem fora da área rolável da
   tela (`#app-header` e `#app-footer`, ambos irmãos de `#app-main` dentro
   de `.app-shell` — ver `index.html`), montados uma única vez por
   navegação. Isso é o que garante que os 3 ícones do rodapé (Início /
   Triagem ou Busca / Prontuário) **fiquem sempre visíveis**, mesmo se o
   conteúdo da tela for mais alto que a viewport e precisar rolar por
   dentro. Em `login`/`cadastro` os dois ficam escondidos (`hidden = true`),
   e cada uma dessas duas telas desenha seu próprio cabeçalho de marca (ver
   `PV.ui.headerLogin()`).
4. **Despacha para a função de tela certa** via `switch (rota)`, chamando
   algo como `PV.screens.perfil(main, ctx)`. `ctx` é um objeto simples que
   toda tela recebe, com `{ sub, query, sessao, usuario }`.
5. Se a função de tela lançar uma exceção, cai no `catch` e mostra uma
   mensagem de erro genérica dentro de `#app-main`, sem quebrar o app
   inteiro.

Um detalhe importante para quem for mexer aqui: como as telas são
`async function`, existe uma variável `geracaoAtual`/`minhaGeracao` que
evita uma corrida (race condition) — se o usuário navegar de novo enquanto
uma tela anterior ainda está esperando uma chamada assíncrona (ex.: um
`fetch` simulado), a renderização antiga desiste de continuar mexendo no
DOM assim que percebe que uma navegação mais nova já assumiu.

**Adicionando uma rota nova:** basta (a) criar a função da tela em algum
arquivo de `js/screens/`, (b) registrá-la em `window.PV.screens = {...}` no
fim daquele arquivo, e (c) adicionar um `case 'nome-da-rota':` no `switch`
de `router.js` chamando essa função.

## 6. A camada de dados (`js/db.js`)

Pense nela como se fosse uma API REST real, só que as "rotas" são funções
JavaScript em vez de endpoints HTTP. Cada entidade tem seu próprio objeto
com métodos assíncronos:

```js
PV.db.auth.login(email, senha)
PV.db.sintomas.listar() / .criar(nome) / .remover(id)
PV.db.registros.listar() / .criar({ paciente_id, sintoma_id, intensidade })
PV.db.conteudos.listar() / .buscar(id) / .criar(...) / .atualizar(...) / .remover(...)
PV.db.contatos.buscar(tipo) / .salvar(tipo, dados)
PV.db.pacientes.criar/buscar/atualizar/acompanhantes(id)
PV.db.acompanhantes.criar/buscar/atualizar/pacientes(id)
PV.db.administradores.listar/buscar/atualizar
PV.db.vinculos.criar(paciente_id) / .remover(acompanhante_id, paciente_id)
PV.db.resetarDados()
```

Todas seguem o mesmo padrão internamente:

1. `await atraso()` — espera um tempo aleatório (~220–420ms) só para
   simular latência de rede e a UI mostrar estados de carregamento de
   forma realista.
2. `exigirAutenticacao()` — lê a sessão atual (`PV.session.lerSessao()`) e
   lança uma `ApiError` (status 401) se não houver ninguém logado.
3. `exigirPerfil(usuario, ...perfis)` — lança erro 403 se o tipo de usuário
   logado não é um dos permitidos para aquela ação (ex.: só administrador
   pode criar/remover sintomas e conteúdos).
4. Valida os dados recebidos "na mão" (sem biblioteca de validação) e lança
   `ApiError` com uma mensagem amigável em português quando algo está errado
   — essas mensagens são as mesmas que acabam aparecendo na tela via
   `PV.ui.aviso({ tipo: 'erro', texto: e.message })`.
5. Mexe no objeto `banco` (em memória) e chama `salvar()`, que serializa
   tudo para JSON e grava em `localStorage`.

**Por que isso importa para manutenção:** qualquer regra de "quem pode ver
o quê" mora aqui, não nas telas. Por exemplo, `podeVerPaciente(usuario, id)`
decide se um cuidador pode ver os dados de um paciente específico
(baseado na tabela `banco.vinculos`), e é usada tanto por `pacientes.buscar`
quanto por `registros.listar`. Se um bug de permissão aparecer ("cuidador
está vendo dados de paciente errado", "paciente consegue editar conteúdo
educativo"), o primeiro lugar a olhar é esta função e as chamadas de
`exigirPerfil`/`podeVerPaciente` dentro de `db.js` — não as telas.

### 6.1 Onde ficam os dados de semente

`js/data.js` define `window.PALIVIDA_SEED`: a lista de 12 sintomas, alguns
conteúdos educativos de exemplo, os três usuários de demonstração e alguns
registros iniciais de sintoma. `js/db.js` usa isso só na primeira vez que o
app roda num navegador (quando não existe ainda nada salvo em
`localStorage`), na função `bancoInicial()`. Depois disso, o app sempre lê o
que já está salvo — mudar `data.js` não afeta quem já tem dados salvos, só
quem for abrir o app pela primeira vez (ou usar "Restaurar dados de
demonstração").

## 7. Perfis de usuário e o que cada um pode fazer

O sistema tem três tabelas de "gente" completamente separadas no banco —
`pacientes`, `acompanhantes` (cuidadores) e `administradores` — cada uma com
seus próprios campos. O tipo do usuário logado (`usuario.tipo`, um de
`'paciente' | 'acompanhante' | 'administrador'`) é o que o roteador e o
`db.js` usam para decidir o que mostrar e permitir.

- **Paciente e Cuidador** (tratados quase sempre da mesma forma, exceto que
  o cuidador só enxerga pacientes aos quais está vinculado via
  `banco.vinculos`):
  - Home (`principal.js` → `home()`): atalhos para Prontuário, Busca/Triagem
    de sintomas, registrar sintomas do dia, e contatos de apoio.
  - Menu de Sintomas (`sintomas.js` → `menuSintomas()`): grade de sintomas
    predefinidos; tocar em um abre o modal de intensidade (slider de
    arrastar, 0 a 10); há também um ícone discreto no cabeçalho que abre o
    painel "Sintomas de hoje" — ver seção 8 para o funcionamento completo
    desse fluxo.
  - Triagem (`triagem.js` → `triagem()`): busca por texto/voz sobre um
    conjunto de condições clínicas, com definição, sinais/sintomas e sinais
    de alerta — puramente informativo, não grava nada no banco.
  - Laudo digital (`triagem.js` → `laudoDigital()`): permite escolher um
    PDF já salvo no aparelho do usuário e visualizá-lo dentro do app (não
    envia o arquivo a lugar nenhum — fica só na memória da aba aberta).
  - Prontuário (`perfil.js` → `perfil()`): formulário de cadastro em
    etapas (wizard), usado tanto pelo próprio paciente quanto por um
    cuidador preenchendo os dados de um paciente vinculado.
- **Administrador**:
  - Ao entrar em `#/home`, vê o Dashboard (`principal.js` →
    `dashboardAdmin()`) em vez da Home normal — estatísticas agregadas de
    todos os registros de sintomas (média, frequência, mediana, variância,
    desvio padrão), calculadas em `calcularEstatisticas()`.
  - Busca (`principal.js` → `busca()`): aqui funciona como um CRUD de
    conteúdos educativos e sintomas, não como triagem — só o administrador
    tem acesso a essa rota. `#/triagem` é bloqueada para administrador
    (redireciona para `/home`), e `#/busca` é a rota que ele usa no lugar
    da Triagem no menu inferior. Ver `atalhosPara()` em `ui.js`.
  - `painel-admin` (`admin.js`): uma tela extra que existe no código mas não
    tem link de acesso direto em nenhum menu — ver comentário no topo do
    próprio arquivo `admin.js` para o motivo.

## 8. Fluxo de registro de sintomas + painel "sintomas de hoje"

Este é um dos fluxos mais prováveis de precisar de manutenção futura, então
vale detalhar como as peças se conectam (tudo dentro de
`js/screens/sintomas.js`):

1. `menuSintomas(main, ctx)` monta a tela: grade de sintomas
   (`montarListaSintomas`), o modal de intensidade (`montarModalIntensidade`)
   e o painel do dia (`montarPainelHoje`) — os dois últimos ficam ocultos
   até serem abertos.
2. Tocar em um card de sintoma chama `modal.abrir(sintoma)`, que mostra o
   modal com um **slider de arrastar** (`.pv-slider-track`/`.pv-slider-thumb`,
   controlado via Pointer Events, não `<input type="range">`) para escolher
   a intensidade de 0 a 10.
3. Ao confirmar, o modal chama `PV.db.registros.criar(...)`. **Importante:**
   depois de registrar, o modal **não navega para nenhuma outra tela** — só
   fecha a si mesmo e chama o callback `aoRegistrar()`, que foi passado por
   `menuSintomas()` na hora de montar o modal. Isso existe de propósito,
   para permitir registrar vários sintomas em sequência sem sair da tela.
   Se essa navegação for reintroduzida no futuro (ex.: `PV.router.navegar('/home')`
   dentro do `.then()` do `criar`), o efeito colateral vai ser o mesmo bug
   que já existiu antes: interromper o fluxo de registro múltiplo.
4. O ícone discreto no cabeçalho da tela (`#btn-relatorio-hoje`, o SVG
   `PV.ui.svgRelatorio()`) chama `painelHoje.abrir()`, que busca
   `PV.db.registros.listar()` e `PV.db.sintomas.listar()`, filtra só os
   registros cujo `data_registro` cai no dia de hoje
   (`new Date(r.data_registro).toDateString() === hojeChave`), e desenha
   cada um com nome do sintoma, intensidade (numa pílula colorida:
   verde ≤3, amarelo 4–6, vermelho ≥7 — função `corPorIntensidade()`) e
   horário.
5. O `aoRegistrar()` do passo 3 chama `painelHoje.atualizar()` — que só
   recarrega a lista **se o painel já estiver aberto** no momento
   (`atualizarSeAberto`), evitando trabalho desnecessário quando ele está
   fechado.

Se no futuro for pedido, por exemplo, "mostrar os sintomas de ontem também"
ou "permitir editar um registro já feito", é aqui — em `montarPainelHoje` e
em `PV.db.registros` — que essa lógica deve entrar; hoje `db.js` não tem
método de `atualizar`/`remover` para registros, só `criar`/`listar`.

## 9. UI compartilhada (`js/ui.js`)

Peças reaproveitadas em várias telas, para não duplicar HTML/lógica:

- **`header()` / `headerLogin()`**: cabeçalho global — ver seção 5.
- **`footerConteudo(tipoUsuario, rotaAtiva)`**: gera os botões do rodapé,
  variando conforme o perfil (`atalhosPara()`) e marcando o botão da rota
  atual com a classe `ativo`. `footer()`/`tabbar()` são só apelidos mantidos
  por compatibilidade com código mais antigo que ainda os chamava
  diretamente — todo código novo deveria usar `footerConteudo` (chamado
  centralmente pelo roteador; as telas não precisam chamar nada disso).
- **`aviso({ tipo, texto })`**: caixa de mensagem de sucesso/erro, usada
  depois de praticamente toda chamada a `PV.db.*` que pode falhar.
- **`spinner()` / `carregando()`**: indicador de carregamento.
- **`chips(...)` / `ligarChips(...)`**: grupo de botões de seleção única
  (ex.: gênero, tipo sanguíneo no cadastro).
- **Ícones SVG** (`svgLogo`, `svgLupa`, `svgMic`, `svgRelatorio`): todos
  desenhados à mão como SVG inline (sem biblioteca de ícones), no mesmo
  estilo minimalista de traço fino. Para adicionar um ícone novo no mesmo
  espírito, copie o padrão de qualquer um desses (`viewBox="0 0 24 24"`,
  `stroke="currentColor"`, sem `fill`) e registre a função no objeto
  exportado em `window.PV.ui` no fim do arquivo.

## 10. Estilo visual (`css/styles.css`)

Um único arquivo, dividido em seções por comentários (`/* === NomeDaTela === */`)
que seguem a mesma ordem das telas em `js/screens/`. Alguns pontos que
ajudam a não quebrar o layout ao mexer:

- **Variáveis de cor** ficam no topo do arquivo (`:root`), com nomes como
  `--azul`, `--creme`, `--verde-escuro`, `--laranja`. Sempre reutilize essas
  variáveis em vez de escrever cores fixas novas — é o que mantém a
  identidade visual consistente entre telas.
- **`.app-shell`** é o "corpo do celular": `height: 100dvh` (não `100vh` —
  `dvh` se ajusta à altura real visível em navegadores mobile, que escondem/
  mostram barras de endereço) e `max-width: 480px`, centralizado. Em telas
  largas (desktop/tablet, media query `min-width: 640px`) ganha uma moldura
  preta arredondada simulando um celular.
- **`#app-header` / `#app-footer`** ficam fora de `#app-main` (que é a
  única área com `overflow-y: auto`), garantindo que fiquem sempre visíveis
  independente do tamanho do conteúdo da tela — ver seção 5.
- **`.pv-sem-scroll`**: classe aplicada via JS (`main.classList.add(...)`)
  em telas que foram desenhadas para caber inteiras na viewport sem
  rolagem (ex.: Menu de Sintomas, Home) — usa `flex`/`clamp()`/unidades
  relativas (`vw`, `%`) em vez de tamanhos fixos em pixels, para que o
  conteúdo se redimensione conforme o espaço disponível em vez de
  transbordar. Ao criar uma tela nova que também deva caber sem scroll,
  siga o mesmo padrão: `main.classList.add('pv-sem-scroll')` na função da
  tela, e CSS com `flex: 1`/`min-height: 0`/`clamp()` em vez de alturas
  fixas.
- **Modais** (`.pv-modal-overlay`, `.pv-painel-hoje-overlay`) seguem o
  mesmo padrão: `position: fixed`/`absolute` cobrindo a tela, fundo
  escurecido (`rgba(0,0,0,...)`), `hidden` como atributo HTML nativo para
  esconder (não uma classe CSS customizada) — então em JS basta
  `elemento.hidden = true/false` para abrir/fechar.

## 11. Convenções gerais do código

- **Português para tudo que é do domínio do negócio**: nomes de função,
  variáveis, comentários, mensagens de erro mostradas ao usuário — tudo em
  português. Termos técnicos (`callback`, `overlay`, `router`) aparecem em
  inglês quando é o termo padrão da área. Mantenha essa consistência ao
  adicionar código novo.
- **IIFE + objeto global**: cada arquivo é uma função autoexecutável
  (`(function () { ... })()`) que só expõe o que precisa via
  `window.PV.algumaCoisa = {...}` no final, mantendo o resto (funções
  auxiliares internas) fora do escopo global. Siga o mesmo padrão em
  arquivos novos.
- **Sem dependências externas** além da fonte do Google Fonts. Nenhum
  `npm install`, nenhum bundler. Se uma funcionalidade nova realmente
  precisar de uma biblioteca, ela precisa ser incluída como um `<script>`
  de CDN direto no `index.html`, mantendo o site 100% estático.
- **Erros de negócio são exceções (`ApiError`)**, capturadas nas telas com
  `try/catch` e mostradas via `PV.ui.aviso({ tipo: 'erro', texto: e.message })`
  — a mensagem que o usuário vê é literalmente `e.message`, então sempre
  escreva mensagens de erro pensando em quem for lê-las na tela, não só em
  quem for debugar.

## 12. Limitações conhecidas (por ser um protótipo sem backend real)

Vale ter em mente ao dar manutenção, para não tratar como "bug" algo que é
uma limitação intencional da arquitetura atual:

- **Senhas em texto puro** dentro do `localStorage` (`senha_hash` não é de
  fato um hash). Aceitável só porque não existe um servidor real recebendo
  ou guardando esses dados — tudo fica no próprio navegador de quem está
  usando. Isso precisaria mudar por completo (e um backend de verdade
  precisaria existir) antes de qualquer uso em produção com dados reais de
  pacientes.
- **Dados não sincronizam entre dispositivos/navegadores.** Cada navegador
  tem o seu próprio `localStorage` isolado — um cuidador que usa o app no
  celular e no computador veria dois "bancos" diferentes.
- **`PV.db.registros` não tem `atualizar`/`remover`.** Um sintoma
  registrado por engano não pode ser editado ou apagado pela interface
  atual — só criar novos registros.
- **O token de autenticação (`gerarToken`) não protege nada de verdade** —
  é só uma string codificada em base64 para o front ter algo para guardar,
  sem assinatura nem validação de servidor por trás.

---

## Histórico de mudanças

Registro das principais decisões tomadas em rodadas anteriores de ajuste,
mantido para contexto — não é necessário para entender o funcionamento
atual do sistema (seções 1–12 acima cobrem isso).

### Unificação de dois projetos em um só

Esta versão nasceu da fusão de dois projetos que existiam em paralelo: um
site com login/perfis/prontuário/dashboard (a base do que existe hoje) e um
portal de triagem de sintomas com busca por texto/voz (hoje é a tela de
Triagem, `js/screens/triagem.js`). Entre as redundâncias identificadas e
corrigidas nessa fusão:

- Prontuário e "Carteirinha" eram a mesma coisa com dois nomes — ficou só
  Prontuário, com preenchimento em etapas (wizard). A rota antiga
  `#/carteirinha` continua funcionando por compatibilidade, redirecionando
  para `#/perfil`.
- Ícones do rodapé apareciam duplicados na tela de Triagem (ela montava o
  rodapé no próprio HTML, e o roteador também inseria o dele).
- A aba "Entendendo os sintomas" (ícone de interrogação) duplicava o
  propósito da aba de Triagem para paciente/cuidador — foi removida do
  menu inferior desses dois perfis; a rota `#/busca` continua existindo,
  mas hoje é exclusiva do administrador (que a usa como CRUD de conteúdos).
- Emojis nos cards de condição clínica da Triagem foram substituídos por
  texto simples (sem ícone decorativo).
- Um índice de rolagem horizontal duplicado na Triagem foi removido.
- Botões de Contatos (Hospital/Família/SAC), que antes eram decorativos,
  passaram a abrir uma tela própria editável e persistida por usuário
  (`PV.db.contatos`).

### Reestruturação de header/footer e correção de telas com rolagem

Nas primeiras versões, cada tela montava seu próprio `header()`/`footer()`
dentro do HTML da própria tela — o que causava o rodapé "sumir" (ficar
visível só depois de rolar até o fim) em telas com bastante conteúdo, e
algumas telas (Perfil, Home, Dashboard admin, Busca) sequer tinham rodapé
nenhum. Isso foi corrigido movendo cabeçalho e rodapé para fora da área
rolável, montados centralmente pelo roteador (ver seção 5 acima) — mudança
que já está refletida na arquitetura atual, não é mais um problema em aberto.

Duas telas (Menu de Sintomas e Home) também foram reformuladas para caber
inteiras na viewport sem precisar de rolagem, trocando dimensões fixas em
pixels por `flex`/`clamp()`/unidades relativas — ver `.pv-sem-scroll` na
seção 10.


### Painel de "sintomas de hoje"

Existia um arquivo `js/relatorio-teste.js`, explicitamente marcado no
próprio código como temporário/de teste: um painel flutuante fixo sobre
qualquer tela do site (inclusive a de login), fora da identidade visual do
restante do app. Ele foi removido e substituído pelo fluxo descrito na
seção 8 acima — um ícone discreto integrado ao cabeçalho da tela de Menu de
Sintomas, que abre um painel deslizante (drawer) com os sintomas do dia,
usando a mesma linguagem visual dos demais modais do site. Nessa mesma
mudança, o registro de um sintoma deixou de navegar automaticamente de
volta para a Home, permitindo registrar vários sintomas em sequência sem
interrupção — e um bug lateral (botão "Confirmar" ficando travado ao tentar
registrar um segundo sintoma na mesma sessão do modal) foi corrigido junto.
