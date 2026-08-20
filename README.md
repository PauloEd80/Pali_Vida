# PaliVida — versão combinada (estética A + funcionalidades A+B)

Esta versão une os dois projetos que vocês tinham em paralelo:

- **Projeto A** (`Pali_Vida-main`) — site estático completo, com login de
  três perfis (Paciente, Cuidador, Administrador), "backend" em
  `localStorage`, prontuário, dashboard administrativo e o fluxo original
  de registro de sintomas. **A estética (cores, fonte Comfortaa, layout de
  telefone) e o sistema de login foram mantidos como base.**
- **Projeto B** (`PaliVida — App — Qualify`) — portal de triagem de
  sintomas com busca (inclusive por voz), medidor de nível de atenção,
  identificação em formulário de várias etapas e visualizador de laudo em
  PDF. **Essas funcionalidades foram portadas para dentro do app-shell do
  projeto A**, com o mesmo visual do restante do site.

## Ajustes de unificação (revisão mais recente)

Depois da primeira combinação dos dois projetos, foram identificadas e
corrigidas as seguintes redundâncias:

- **Prontuário e Carteirinha eram a mesma coisa com dois nomes.** Ficou só
  **"Prontuário"**, mas usando o preenchimento em etapas (wizard, com barra
  de progresso, um passo de cada vez) que antes só existia na Carteirinha —
  ver `js/screens/perfil.js`, função `montarWizardProntuario`. A rota antiga
  `#/carteirinha` continua funcionando: ela só redireciona para `#/perfil`
  (ver `js/router.js`).
- **Ícones do rodapé duplicados na tela de Triagem.** A tela chamava
  `footer()` no próprio HTML e o roteador também inseria a `tabbar()` por
  baixo — as duas fazem a mesma coisa (mesmo componente visual), então uma
  delas sobrava. Foi removida a chamada extra dentro de `triagem.js`.
- **Aba "?" (Entendendo os sintomas) duplicava o propósito da aba de
  Triagem.** Para Paciente e Cuidador, essa aba foi removida do menu
  inferior — a Triagem já cobre a mesma necessidade (informação sobre
  sintomas e sinais de alerta). A rota `#/busca` continua existindo só para
  o Administrador, que a usa para gerenciar conteúdos (CRUD) e não tem
  acesso à Triagem.
- **Emojis e figurinhas removidos dos cards de condição clínica.** Os cards
  da Triagem (e o índice de rolagem rápida no topo) mostravam um emoji por
  condição (🚽😔😰🤕🤢🫁🔋💧); numa primeira correção eles foram trocados por
  SVGs, mas alguns ainda desenhavam a mesma figura do emoji (um rosto triste
  para "Tristeza", um vaso para "Constipação") e continuavam parecendo
  figurinha. A versão atual não usa ícone nenhum — só o título da condição,
  em texto. O emoji de microfone (🎤) da busca por voz continua substituído
  por um ícone de linha minimalista (`PV.ui.svgMic`), já que ali o ícone
  tem função (indicar o botão de gravar), não é decorativo.
- **Índice de rolagem lateral da Triagem removido.** A tela tinha uma faixa
  de atalhos com scroll horizontal no topo (uma "aba" por condição) que
  não rolava direito e duplicava a lista completa logo abaixo — bastava
  rolar a tela para ver a mesma coisa. A faixa (`.pv-triagem-indice`) e a
  função que a gerava (`indiceHtml`) foram removidas; a busca por texto/voz
  no topo continua funcionando normalmente para pular direto a uma condição.
- **Botões de Contatos (Hospital / Família / SAC) agora funcionam.** Antes
  eram só três botões decorativos, sem ação nenhuma ao tocar. Agora cada um
  abre uma tela própria (`#/contato/hospital`, `#/contato/familia`,
  `#/contato/sac` — ver `PV.screens.contato` em `js/screens/principal.js`)
  já preenchida com um exemplo genérico (nome, telefone e um terceiro campo
  que muda por tipo: endereço para Hospital, parentesco para Família,
  horário de atendimento para SAC). O usuário edita com os dados reais e
  salva; os dados ficam guardados por conta de cada paciente/cuidador
  (`PV.db.contatos`, nova entidade em `js/db.js`) e continuam preenchidos
  da próxima vez que a tela for aberta.

## Como abrir

Igual ao projeto A original: duplo clique em `index.html` (funciona
offline, exceto a fonte Comfortaa via Google Fonts), ou suba a pasta para
qualquer host estático (GitHub Pages, Netlify, Vercel...).

## Contas de demonstração

Senha `palivida123` para as três:

| Papel | E-mail |
|---|---|
| Paciente | paciente@palivida.local |
| Cuidador | cuidador@palivida.local |
| Administrador | admin@palivida.local |

A tela de login tem atalhos para preencher essas contas automaticamente.

## O que cada perfil pode fazer

- **Paciente** e **Cuidador**: fluxo original de A (Início, Registrar
  sintomas de hoje, Prontuário) **+** a nova aba **Triagem**, com:
  - Busca de sintomas (por texto ou por voz, se o navegador suportar) sobre
    8 condições clínicas com definição, sinais/sintomas, sinais de alerta e
    referências bibliográficas.
  - Medidor de "nível de atenção" que reage em tempo real aos sintomas e
    sinais de alerta marcados.
  - Tela para abrir um PDF já salvo no aparelho (ex.: um laudo).
  - O menu inferior desses dois perfis tem 3 abas: Início, Triagem,
    Prontuário — a antiga aba "Entendendo os sintomas" (ícone de
    interrogação) foi removida por duplicar o propósito da Triagem.
- **Prontuário** (Paciente e Cuidador): preenchimento dos dados em etapas
  (wizard) — dados pessoais, contato e acesso, saúde/diagnóstico, equipe de
  saúde e emergência — com barra de progresso, um passo de cada vez. É o
  mesmo cadastro usado no restante do site (`PV.db.pacientes`), não um
  documento à parte.
- **Administrador**: continua exatamente como no projeto A — Dashboard de
  estatísticas de sintomas (média, frequência, mediana, variância, desvio
  padrão) e gerenciador de conteúdos/sintomas (acessado pela aba "Entendendo
  os sintomas", que só ele vê). Não tem acesso à aba de Triagem (nem por
  link direto — a rota redireciona para a Home caso o admin tente acessá-la).

## O que foi adicionado tecnicamente

- **Nova tela** `js/screens/triagem.js`: contém as telas de Triagem e Laudo
  Digital portadas de B, com os mesmos dados clínicos do projeto B,
  reescritas para usar os componentes visuais já existentes em A
  (`.pv-card`, `botao-enviar`, `.campo`, `header()`/`footer()`...). Os
  ícones das condições vêm de `PV.ui.iconeTriagem(id)` (SVG), não de emoji.
- **`js/screens/perfil.js`**: a tela de Prontuário agora inclui o wizard de
  preenchimento por etapas (`montarWizardProntuario`), reaproveitado tanto
  para o próprio paciente quanto para um acompanhante editar os dados de um
  paciente vinculado.
- **`css/styles.css`**: acrescentada uma seção nova (Triagem / Laudo) ao
  final do arquivo, com nomes de classe próprios (`.pv-triagem-*`,
  `.pv-carteirinha-*`, `.pv-laudo-*`, reaproveitadas agora também dentro do
  Prontuário) para não colidir com nada existente. Nenhuma regra do CSS
  original de A foi alterada.
- **`js/router.js`**: rotas `#/triagem` e `#/laudo`, bloqueadas para o
  perfil `administrador` (redireciona para `/home`); `#/carteirinha`
  redireciona para `/perfil` (compatibilidade com links antigos).
- **`js/ui.js`**: a barra inferior (`tabbar`/`footer`) mostra 3 abas para
  todos os perfis — Início/Triagem/Prontuário para paciente e cuidador,
  Início/Entendendo os sintomas/Prontuário para administrador — nunca 4,
  evitando tanto a duplicação de ícones quanto a redundância de propósito
  entre abas.
- **`js/screens/principal.js`**: um botão a mais na Home ("Triagem de
  sintomas"), visível para todos os perfis que acessam essa tela
  (paciente/cuidador — o administrador vai para o Dashboard, que não foi
  alterado).
- **`assets/img/triagem.png`**: ícone novo, desenhado no mesmo estilo
  minimalista (32×32, tom azul) dos ícones já existentes (`Home.png`,
  `Question.png`, `User.png`).
- **Correção de bug pré-existente**: o painel flutuante de acompanhamento
  do modo teste (`js/relatorio-teste.js`, mesmo de A) tinha uma regra CSS
  que fazia o painel continuar clicável mesmo escondido
  (`display:flex` sobrepondo o atributo `hidden`). Foi corrigida com uma
  regra `#pv-relatorio-painel[hidden] { display: none; }`.

Nenhum arquivo do fluxo original de A (`db.js`, `session.js`,
`router.js` nas rotas antigas, `auth.js`, `sintomas.js`, `admin.js`,
`data.js`) teve sua lógica de negócio alterada — só o roteador, a tabbar e
a tela de Prontuário aprenderam a lidar com o fluxo unificado.


## Testes realizados nesta revisão

Verificação estática completa (sem navegador disponível neste ambiente):

- Sintaxe válida (`node --check`) em todos os arquivos `.js`.
- Todas as rotas chamadas pelo roteador têm tela correspondente definida
  (e vice-versa) — nenhuma referência solta a `carteirinha`.
- Todas as chaves usadas via `PV.ui.*` nas telas conferem com o que
  `ui.js` exporta.
- CSS com chaves balanceadas; nenhuma regra colidindo com o restante do
  site.
- `tabbar()` verificada diretamente (fora do navegador): 3 botões para
  paciente/cuidador (Início, Triagem, Prontuário) e 3 para administrador
  (Início, Entendendo os sintomas, Prontuário) — nunca duplicados.
- Nenhum emoji restante em código executável ou texto exibido ao usuário
  (os únicos emojis remanescentes estão em comentários de código,
  documentando o que foi substituído).
- Todos os SVGs novos validados como XML bem-formado.

Recomenda-se um teste manual rápido no navegador antes de publicar, cobrindo
o preenchimento do wizard de Prontuário até salvar (como paciente e como
cuidador editando um paciente vinculado) e a navegação completa
Home → Triagem → Prontuário → Laudo.

## Atualização — painel de "sintomas de hoje" integrado (substituindo o painel de teste)

O antigo `js/relatorio-teste.js` — um painel flutuante fixo, solto por cima
de qualquer tela (inclusive o login), fora da estética do app — foi
removido. Em seu lugar, o Menu de Sintomas ganhou:

- Um ícone discreto (prancheta) no canto superior direito do próprio
  cabeçalho da tela, que abre um painel deslizante (drawer) com os
  sintomas já registrados hoje: nome, intensidade (com cor: verde ≤3,
  amarelo 4–6, vermelho ≥7) e horário do registro, do mais recente para o
  mais antigo.
- O modal de intensidade não navega mais para `/home` depois de confirmar
  um registro — a pessoa continua na tela de sintomas e pode marcar vários
  sintomas em sequência. Um bug lateral foi corrigido nesse ponto: o botão
  "Confirmar" ficava travado (desabilitado, com o spinner do registro
  anterior) ao tentar registrar um segundo sintoma na mesma sessão do
  modal — `fechar()` agora sempre restaura o botão.
- O painel usa a mesma linguagem visual dos demais modais do app (overlay
  escurecido, paleta azul/creme, mesma tipografia), então nada da estética
  aprovada foi alterado — só a forma de acessar o resumo do dia.
