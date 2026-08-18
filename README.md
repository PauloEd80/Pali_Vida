# PaliVida — versão site estático

Conversão do código-fonte de `palividacodigofonte.zip` (app React Native/Expo
+ backend Node/Express) para HTML + CSS + JS puro, sem build e sem servidor.

> **Nota desta revisão:** esta versão passou por uma auditoria completa do
> fluxo pós-login antes do teste, com correção de um bug real e a adição de
> um painel de acompanhamento para a demonstração. Ver
> [seção "Revisão para o teste"](#revisão-para-o-teste-mais-recente) mais abaixo
> para o detalhamento.

## Como abrir

Baixe a pasta inteira e:

- **Mais simples:** dê duplo clique em `index.html`. Funciona offline, exceto
  pela fonte Comfortaa (via Google Fonts) — sem internet ela cai numa fonte
  padrão do sistema, mas o site continua funcionando normalmente.
- **Para publicar:** suba a pasta em qualquer host de arquivo estático
  (GitHub Pages, Netlify, Vercel, etc.) — não precisa de Node, banco de dados
  nem configuração nenhuma.

## Contas de demonstração

Senha `palivida123` para as três:

| Papel | E-mail |
|---|---|
| Paciente | paciente@palivida.local |
| Cuidador | cuidador@palivida.local |
| Administrador | admin@palivida.local |

A tela de login tem atalhos para preencher essas contas automaticamente.

## Como funciona sem servidor

`js/db.js` reimplementa cada rota de `backend/src/rotas/*.js` (mesmas
validações, mesmas regras de permissão) rodando 100% no navegador, guardando
os dados em `localStorage`. Isso significa: login, cadastro, registrar
sintomas, editar conteúdos como admin — tudo funciona de verdade, mas os
dados ficam só no seu navegador (não em um servidor real). Tem um botão
**"Restaurar dados de demonstração"** no Prontuário para voltar tudo ao
estado inicial a qualquer momento.

## Fidelidade ao código-fonte / decisões tomadas

- **Todas as 15 telas** do app foram portadas, com as cores, fontes
  (Comfortaa) e textos exatamente como no código-fonte original.
- **Dois ícones do bundle original estavam corrompidos** (`LogoClara.png` e
  `lupa.png` — não abriam nem no visualizador de imagem). Foram refeitos como
  SVG simples no mesmo espírito visual.
- **`DefinicaoSintomas`** (modo de leitura fácil) existia no código mas não
  tinha nenhum botão levando até ela — foi acrescentado um link "Ver em modo
  de leitura fácil" na tela de conteúdo, já que a tela em si estava pronta,
  só sem porta de entrada.
- **`PainelAdmin`** também não é referenciado por nenhum botão no código
  original — foi mantida assim (rota existe, mas sem link visível), fiel ao
  estado real do app.
- **Sem encaminhamento automático por intensidade** (ex.: intensidade ≥ 7 →
  tela vermelha automaticamente): o código-fonte não implementa isso — o
  README original lista isso como sugestão futura. O fluxo real é: registrar
  sintoma sempre volta para a Home; as telas de sinal (verde/amarelo/
  vermelho) só são alcançadas ao ler um conteúdo e apertar "Sinto um desses
  sinais" ou pelo botão "Não tive nenhum sintoma".
- **Testado de ponta a ponta**: a lógica do "backend" local e os fluxos de
  UI (login, cadastro, registrar sintoma, dashboard admin, CRUD de
  conteúdo/sintomas, vínculos paciente-cuidador) foram verificados com
  testes automatizados antes da entrega.

---

## Revisão para o teste (mais recente)

Esta seção documenta a auditoria feita especificamente para o teste, o que
foi encontrado e o que foi alterado. Nenhuma mudança de visual, cor, texto
ou layout foi feita — só correção de comportamento e uma adição nova
(o painel de acompanhamento).

### Método da auditoria

1. Leitura linha a linha de `router.js`, `db.js` e das 5 telas
   (`auth.js`, `principal.js`, `sintomas.js`, `perfil.js`, `admin.js`).
2. Checagem cruzada automatizada: toda classe CSS usada nas telas contra
   as classes declaradas em `styles.css`, e todo `id` consultado via
   `querySelector` contra os `id`s realmente gerados no HTML de cada tela.
3. Verificação de que as 6 imagens referenciadas nas telas
   (`Home.png`, `Question.png`, `User.png`, `seta.png`, `favicon.png`, mais
   o SVG de lupa) existem e abrem corretamente.
4. Servidor HTTP local servindo a pasta, com checagem de que todos os
   15 arquivos referenciados em `index.html` respondem HTTP 200.
5. Teste unitário isolado da lógica do novo painel de acompanhamento
   (interceptação de `PV.db.registros.criar`), rodado em Node.js.

### O que foi encontrado

A base lógica do site (roteamento, "backend" em `localStorage`, regras de
permissão) está sólida — não foi encontrado nenhum erro de JavaScript,
elemento HTML referenciado que não existe, classe CSS faltando, ou imagem
quebrada no fluxo pós-login.

O único problema real de comportamento encontrado:

- **Login — campo "E-mail" não confirmava com a tecla Enter.** Só o campo
  "Senha" tinha esse atalho; o campo de e-mail, não. Ao testar rapidamente
  parecia que o "Enter" não funcionava — na real só faltava esse atalho num
  dos dois campos. **Corrigido** em `js/screens/auth.js`: agora Enter em
  qualquer um dos dois campos (e-mail ou senha) confirma o login, igual já
  acontecia com o campo de senha.

Dois pontos foram investigados e **confirmados como comportamento
intencional do app original**, não bugs:

- As telas de "sinal" (verde/amarelo/vermelho) e "conteúdo" não têm barra de
  navegação inferior — só o botão "Voltar ao início". Isso já era assim no
  código-fonte original (ver seção acima) e está descrito no README
  original; não foi alterado.
- A tela "Você apresentou algum sintoma hoje?" desenha seu próprio rodapé de
  navegação (em vez de usar a barra do roteador) porque ela não é uma das
  3 abas principais (Início / Buscar / Prontuário) — por isso o ícone dela
  nunca aparece "ativo" na barra, diferente das 3 abas. Isso é esperado
  dado como a tela é usada (chegada tanto pelo login do paciente quanto
  pelo botão "Registrar sintomas" dentro da Home) e não afeta o
  funcionamento.
- `lupa.png` de fato está corrompido, como o README original já registrava
  — mas não é usado em lugar nenhum do app (foi substituído por SVG), então
  não tem efeito prático.

### O que foi adicionado: painel de acompanhamento (modo teste)

A pedido, foi criado um painel flutuante que mostra, **em tempo de
execução**, cada registro de intensidade de sintoma (escala de 0 a 10,
conforme relatada pelo paciente no modal já existente) feito durante a
sessão de teste.

- **Onde aparece:** um botão circular fixo no canto inferior direito da
  tela (ícone 📋), visível em qualquer tela do app. Ao clicar, abre um
  painel sobreposto com a lista de registros, mais recente primeiro —
  sintoma, nota (colorida por faixa: verde até 3, amarelo até 6, vermelho
  de 7 a 10) e horário do registro.
- **Como funciona tecnicamente:** o arquivo novo `js/relatorio-teste.js`
  intercepta a função `PV.db.registros.criar` (a mesma que o modal de
  intensidade já chamava) — deixa ela rodar exatamente como antes e, se
  desse certo, acrescenta uma linha ao painel. Nenhuma tela existente foi
  alterada para isso.
- **Persistência:** por ora, só em tela — a lista existe em memória durante
  a sessão do navegador e reinicia a cada recarregamento da página, como
  pedido para este MVP de demonstração. Os registros em si continuam sendo
  gravados no `localStorage` normalmente pelo `db.js`, então aparecem no
  Dashboard do administrador mesmo depois de fechar o painel.
- **Como remover, se não for mais necessário:** basta apagar a linha
  `<script src="js/relatorio-teste.js"></script>` do `index.html`. Nenhum
  outro arquivo depende dele.

### Arquivos alterados nesta revisão

| Arquivo | Mudança |
|---|---|
| `js/screens/auth.js` | Corrigido: Enter no campo de e-mail agora também confirma o login. |
| `js/relatorio-teste.js` | **Novo.** Painel flutuante de acompanhamento de intensidade (ver acima). |
| `index.html` | Adicionada a tag `<script>` do painel novo, depois das telas e antes de `main.js`. |

Nenhum outro arquivo (`db.js`, `router.js`, `ui.js`, `session.js`, as
demais telas, `styles.css`, imagens) foi modificado.
