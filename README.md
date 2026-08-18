# PaliVida — versão site estático

Conversão do código-fonte de `palividacodigofonte.zip` (app React Native/Expo
+ backend Node/Express) para HTML + CSS + JS puro, sem build e sem servidor.

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
