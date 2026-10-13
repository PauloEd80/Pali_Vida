# PaliVida — armazenamento em Google Sheets (todas as entidades)

Este diretório versiona o script (`Code.gs`) que roda dentro de uma planilha
do Google Sheets e serve como "backend" HTTP do site. A planilha guarda **sete
abas**: `conteudos`, `sintomas`, `pacientes`, `acompanhantes`,
`administradores`, `vinculos` e `registros`. Só os "contatos" (Hospital /
Família / SAC da Home) continuam em `localStorage`, fora deste script.

O código "oficial" precisa viver dentro do editor de Apps Script da própria
planilha — o Google não permite publicar um Web App a partir de um arquivo
externo. `Code.gs` aqui é a cópia versionada; sempre que alterar algo, copie
o conteúdo de volta para o editor da planilha e publique uma nova versão.

## Arquivos de apoio

- `Code.gs` — o script completo (substitui qualquer versão anterior).
- `PaliVida_planilha_completa.xlsx` — modelo da planilha com as 7 abas, os
  cabeçalhos corretos, os dados iniciais de demonstração e uma aba `LEIA-ME`.

## 1. Criar a planilha

**Opção A — planilha nova (recomendado para começar do zero):**
no Google Drive, *Novo > Upload de arquivo* com `PaliVida_planilha_completa.xlsx`,
abra o arquivo e escolha *Abrir com > Planilhas Google* (ou, numa planilha
vazia, *Arquivo > Importar > Upload*, "Substituir planilha").

**Opção B — manter a planilha que já está em uso:** não precisa recriar
nada. O novo `Code.gs` acrescenta sozinho as colunas que faltam
(`usuario`, `alergias`, `outro_sintoma`, `referencias`…) e cria abas
ausentes; a ordem das colunas existentes não importa e os dados são
preservados.

Em qualquer das duas, os nomes da linha 1 de cada aba precisam bater com
os esperados (veja `COLUNAS` no topo de `Code.gs`).

## 2. Colar o script

1. Na planilha, vá em **Extensões > Apps Script**.
2. Apague todo o conteúdo do arquivo `Code.gs` do editor e cole o conteúdo
   de `apps-script/Code.gs` deste repositório. Salve.
3. Selecione a função **`configurarPlanilha`** na barra superior e clique em
   **Executar** (autorize quando o Google pedir). Ela confere abas e
   colunas, acrescenta as que faltarem e deixa as células como texto puro.
   Não apaga nem altera dados.

## 3. Definir o token

O script exige um token em toda escrita e na leitura das abas de pessoas,
vínculos e registros. Ele fica como "Propriedade do script" (não aparece na
planilha).

1. No editor de Apps Script: **Configurações do projeto** (engrenagem) >
   **Propriedades do script** > **Adicionar propriedade**.
2. Nome: `PALIVIDA_TOKEN`. Valor: uma string longa e aleatória
   (ex.: `openssl rand -hex 24`). O **mesmo valor** vai em
   `TOKEN_APPS_SCRIPT` no `js/db.js` do site.

Para trocar o token depois, edite a propriedade e a constante do site.

## 4. Publicar como Web App

1. **Implantar > Nova implantação > Tipo: App da Web**.
2. **Executar como:** Eu. **Quem pode acessar:** Qualquer pessoa.
3. **Implantar** e copie a URL (`https://script.google.com/macros/s/…/exec`).

**Ao alterar o script depois:** *Implantar > Gerenciar implantações >*
lápis *> Nova versão*. Isso mantém a mesma URL. Criar uma "nova
implantação" gera URL nova — aí é preciso atualizar `URL_APPS_SCRIPT` em
`js/db.js`.

## 5. Colar a URL e o token no site

No topo de `js/db.js`:

```js
const URL_APPS_SCRIPT = 'https://script.google.com/macros/s/AKfycb.../exec';
const TOKEN_APPS_SCRIPT = 'o-mesmo-valor-de-PALIVIDA_TOKEN';
```

## O que o script faz

| Ação | Como | Token |
|---|---|---|
| `GET ?acao=login&identificador=…&senha=…` | procura nas 3 abas de contas por **e-mail ou usuário** + senha; devolve `id`, `email`, `usuario`, `tipo` | não |
| `GET ?acao=listar/buscar&tabela=conteudos\|sintomas` | leitura pública | não |
| `GET ?acao=listar/buscar&tabela=pacientes\|acompanhantes\|administradores\|vinculos\|registros` | leitura protegida | sim |
| `POST {acao: criar\|atualizar\|remover, tabela, dados}` | escrita (uma por vez, com trava) | sim |

Regras aplicadas nas abas de contas (`pacientes`, `acompanhantes`,
`administradores`):

- **E-mail** único entre as três abas (sem diferenciar maiúsculas).
- **Usuário** único entre as três abas (sem diferenciar maiúsculas), com 3 a
  30 caracteres entre letras, números, ponto, hífen ou sublinhado, e sem
  `@` — é isso que diferencia usuário de e-mail na tela de login. Contas
  antigas sem usuário continuam entrando pelo e-mail; para dar um usuário a
  elas, basta o próprio dono preencher "Nome de usuário" no Prontuário (ou
  digitar na coluna `usuario` da planilha).
- **Senha** com ao menos 6 caracteres.
- Nenhuma resposta do script inclui `senha_hash`.

## Testes manuais recomendados

1. Cadastrar um paciente pelo site com um usuário novo → conferir a linha em
   `pacientes` (usuário em minúsculas). Cadastrar outro com o mesmo usuário →
   deve recusar ("Este nome de usuário já está em uso.").
2. Entrar pelo usuário e pelo e-mail → ambos devem funcionar.
3. Registrar um sintoma e um "Outro sintoma" → conferir as linhas em
   `registros` (`sintoma_id` vazio e `outro_sintoma` preenchido no segundo).
4. Salvar o Prontuário com "Alergias ou contraindicações medicamentosas" →
   conferir a coluna `alergias`.
5. Chamar a URL do Web App sem token (ou com token errado) numa escrita ou
   na leitura de `pacientes` → deve responder erro 403.
6. Abrir o site em outro navegador → os dados aparecem (não dependem do
   `localStorage`).

## Limitações conhecidas

- O token fica no `js/db.js` (código público): não é segurança forte, só
  evita acesso casual. Quem decide as permissões de cada perfil é o site.
- Senhas ficam em texto puro na coluna `senha_hash` (protótipo). Para uso
  real com dados de pacientes isso precisa mudar.
- Cotas do Apps Script (execuções/tempo por dia) se aplicam.
