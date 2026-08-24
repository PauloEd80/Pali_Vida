# PaliVida — armazenamento em Google Sheets (`conteudos` e `sintomas`)

Este diretório documenta e versiona o script (`Code.gs`) que roda dentro de
uma planilha do Google Sheets e serve como "backend" HTTP para as entidades
`conteudos` e `sintomas` do site. As demais entidades (pacientes,
acompanhantes, administradores, vínculos, registros, contatos) continuam em
`localStorage`, sem relação com este script.

O código "oficial" precisa viver dentro do editor de Apps Script da própria
planilha — o Google não permite publicar um Web App a partir de um arquivo
externo. `Code.gs` aqui é uma cópia para revisão em code review / histórico
de git; sempre que alterar algo, copie o conteúdo de volta para o editor da
planilha e gere uma nova implantação.

## 1. Criar a planilha

1. Crie uma planilha nova no Google Sheets (drive.google.com → Novo →
   Planilha Google).
2. Renomeie a primeira aba para `conteudos` e, na linha 1, cole exatamente
   estes cabeçalhos, um por coluna:

   ```
   id | titulo | descricao | texto | sinaissintomas | sinaisalerta | data_post
   ```

3. Crie uma segunda aba chamada `sintomas` e, na linha 1, cole:

   ```
   id | nome_sintoma | created_at
   ```

Os nomes de coluna precisam bater exatamente com esses — são usados como
chave nos objetos JSON trocados entre o site e o script.

## 2. Colar o script

1. Na planilha, vá em **Extensões > Apps Script**.
2. Apague o conteúdo padrão de `Code.gs` (o arquivo `function myFunction()...`
   que vem em branco) e cole o conteúdo de `apps-script/Code.gs` deste
   repositório.
3. Salve (ícone de disquete ou Ctrl/Cmd+S).

## 3. Gerar o token de escrita

O script exige um token simples em toda escrita (criar/atualizar/remover),
guardado como "Propriedade do script" — não fica visível na planilha nem é
compartilhado por engano ao compartilhar a planilha.

1. No editor de Apps Script, vá em **Configurações do projeto** (ícone de
   engrenagem, na barra lateral esquerda).
2. Em **Propriedades do script**, clique em **Adicionar propriedade do
   script**.
3. Nome da propriedade: `PALIVIDA_TOKEN`. Valor: qualquer string longa e
   aleatória (por exemplo, gere uma com `openssl rand -hex 24` no terminal,
   ou use um gerador de senhas). Guarde esse valor — ele vai para
   `js/db.js` no passo 5.

Para trocar o token depois (ex.: se vazar), basta editar o valor dessa
mesma propriedade e atualizar `TOKEN_APPS_SCRIPT` em `js/db.js` no site.

## 4. Publicar como Web App

1. No editor de Apps Script, clique em **Implantar > Nova implantação**.
2. Em "Selecionar tipo", escolha **App da Web** (ícone de engrenagem ao
   lado de "Selecionar tipo").
3. Configuração:
   - **Executar como**: Eu (sua conta Google, dona da planilha).
   - **Quem pode acessar**: **Qualquer pessoa**.
     (A proteção real de escrita fica por conta do token do passo 3, não
     do controle de acesso do Google — leitura, por design, é aberta a
     quem tiver a URL, já que o site precisa listar conteúdos/sintomas
     sem exigir login do Google.)
4. Clique em **Implantar**. Na primeira vez, o Google vai pedir para
   autorizar o script a acessar a planilha (é a sua própria planilha —
   pode aceitar).
5. Copie a **URL do app da Web** gerada. Tem o formato:

   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

### Ao alterar o script depois

Editar `Code.gs` no editor não atualiza a URL publicada automaticamente. É
preciso ir em **Implantar > Gerenciar implantações**, editar a implantação
existente (ícone de lápis) e escolher **Nova versão**, ou criar uma nova
implantação — o que, nesse segundo caso, gera uma URL nova (é preciso
atualizar `js/db.js` de novo).

## 5. Colar a URL e o token no site

Abra `js/db.js` no repositório e edite as duas constantes no topo do
arquivo:

```js
const URL_APPS_SCRIPT = 'https://script.google.com/macros/s/AKfycb.../exec';
const TOKEN_APPS_SCRIPT = 'o-mesmo-valor-que-voce-colocou-em-PALIVIDA_TOKEN';
```

Depois disso, o site já lê e escreve `conteudos`/`sintomas` na planilha em
vez de `localStorage`.

## Testes manuais recomendados

Ver Parte 5 do prompt de implementação original — resumindo:

1. Criar um conteúdo pelo site → conferir linha nova na planilha.
2. Editar esse conteúdo → conferir que a linha foi atualizada (e aparece no
   histórico de versões do Sheets, em Arquivo > Histórico de versões).
3. Abrir o site em outra aba anônima/outro navegador → confirmar que o
   conteúdo aparece (prova de que não depende mais de localStorage local).
4. Excluir um conteúdo → conferir que a linha some da planilha.
5. Repetir 1–4 para sintomas.
6. Chamar a URL do Web App diretamente via `curl`/Postman com `acao: criar`
   sem token, ou com token errado → confirmar que retorna erro (não escreve
   nada).
7. Confirmar que as telas de paciente/acompanhante, que só leem
   conteúdos/sintomas, continuam funcionando normalmente.

## Limitações conhecidas

- O token é uma string fixa embutida no `js/db.js` do site (código público,
  visível a quem inspecionar a página) — não é segurança forte, apenas
  evita escrita casual/acidental por quem não conhece a URL nem o token.
  Quem realmente decide se um usuário pode editar conteúdo é o site (perfil
  "administrador", checado em `exigirAutenticacao()`/`exigirPerfil()` antes
  de qualquer chamada ao Apps Script).
- Leitura (`doGet`) não exige token — qualquer pessoa com a URL pode listar
  conteúdos/sintomas. Isso é intencional: essas telas (paciente,
  acompanhante) não fazem login no Google, só no site.
- Cotas do Google Apps Script se aplicam (limite de execuções/tempo por
  dia numa conta gratuita) — não deve ser um problema para o volume de uso
  esperado deste projeto, mas vale saber que existe.
