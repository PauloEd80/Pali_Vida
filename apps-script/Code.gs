/**
 * PaliVida — Apps Script "backend" para as abas `conteudos` e `sintomas`.
 *
 * Este script é publicado como Web App (ver README.md nesta pasta) e serve de
 * intermediário HTTP entre o site estático (js/db.js) e a planilha do Google
 * Sheets, que passa a ser o armazenamento compartilhado dessas duas
 * entidades — as demais (pacientes, acompanhantes, administradores,
 * vinculos, registros, contatos) continuam em localStorage no site, fora do
 * escopo deste script.
 *
 * O código "oficial" vive dentro do editor de Apps Script da planilha
 * (Extensões > Apps Script). Este arquivo é uma cópia versionada no
 * repositório para revisão — ao alterar aqui, copie e cole o conteúdo de
 * volta no editor da planilha e publique uma nova implantação.
 */

/* ------------------------------------------------------------- constantes */

// Colunas esperadas em cada aba, na ordem exata do cabeçalho (linha 1).
const COLUNAS = {
  conteudos: ['id', 'titulo', 'descricao', 'texto', 'sinaissintomas', 'sinaisalerta', 'data_post'],
  sintomas: ['id', 'nome_sintoma', 'created_at'],
};

const TABELAS_VALIDAS = new Set(Object.keys(COLUNAS));

/* ------------------------------------------------------------------ doGet */

function doGet(e) {
  try {
    const acao = e.parameter.acao;
    const tabela = e.parameter.tabela;

    if (acao === 'listar') {
      validarTabela(tabela);
      return respostaJson(listarLinhas(tabela));
    }

    if (acao === 'buscar') {
      validarTabela(tabela);
      const id = e.parameter.id;
      const linha = buscarLinhaPorId(tabela, id);
      if (!linha) return respostaJson({ erro: 'Conteúdo não encontrado.' }, 404);
      return respostaJson(linha);
    }

    return respostaJson({ erro: 'Ação inválida.' }, 400);
  } catch (err) {
    return respostaJson({ erro: err.message || String(err) }, err.status || 500);
  }
}

/* ----------------------------------------------------------------- doPost */

function doPost(e) {
  try {
    const corpo = JSON.parse(e.postData.contents || '{}');
    const { acao, tabela, token, dados } = corpo;

    validarTabela(tabela);
    validarToken(token);

    if (acao === 'criar') {
      return respostaJson(criarLinha(tabela, dados || {}));
    }
    if (acao === 'atualizar') {
      const atualizado = atualizarLinha(tabela, dados || {});
      if (!atualizado) return respostaJson({ erro: 'Conteúdo não encontrado.' }, 404);
      return respostaJson(atualizado);
    }
    if (acao === 'remover') {
      const removido = removerLinha(tabela, dados && dados.id);
      if (!removido) return respostaJson({ erro: 'Conteúdo não encontrado.' }, 404);
      return respostaJson({ ok: true });
    }

    return respostaJson({ erro: 'Ação inválida.' }, 400);
  } catch (err) {
    return respostaJson({ erro: err.message || String(err) }, err.status || 500);
  }
}

/* -------------------------------------------------------------- validação */

function validarTabela(tabela) {
  if (!TABELAS_VALIDAS.has(tabela)) {
    const err = new Error('Tabela inválida.');
    err.status = 400;
    throw err;
  }
}

function validarToken(token) {
  // Proteção básica: apenas evita escrita acidental/abusiva por quem não
  // conhece a URL nem o token. NÃO é autenticação real (sem sessões, sem
  // usuário/senha) — quem pode editar o quê continua sendo decidido no site,
  // via exigirAutenticacao()/exigirPerfil() em js/db.js, antes mesmo de
  // chamar este Web App.
  const tokenEsperado = PropertiesService.getScriptProperties().getProperty('PALIVIDA_TOKEN');
  if (!tokenEsperado || token !== tokenEsperado) {
    const err = new Error('Token inválido.');
    err.status = 403;
    throw err;
  }
}

/* --------------------------------------------------------- acesso à aba */

function getAba(tabela) {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabela);
  if (!aba) {
    const err = new Error('Aba "' + tabela + '" não encontrada na planilha.');
    err.status = 500;
    throw err;
  }
  return aba;
}

// Lê a aba inteira de uma vez (getValues em lote) e devolve um array de
// objetos { coluna: valor }, já pulando a linha de cabeçalho.
function lerTodasAsLinhas(tabela) {
  const aba = getAba(tabela);
  const colunas = COLUNAS[tabela];
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];

  const valores = aba.getRange(2, 1, ultimaLinha - 1, colunas.length).getValues();
  return valores.map((linha) => {
    const obj = {};
    colunas.forEach((col, i) => (obj[col] = linha[i]));
    return obj;
  });
}

function listarLinhas(tabela) {
  return lerTodasAsLinhas(tabela).sort((a, b) => Number(a.id) - Number(b.id));
}

function buscarLinhaPorId(tabela, id) {
  const linhas = lerTodasAsLinhas(tabela);
  return linhas.find((l) => String(l.id) === String(id)) || null;
}

function proximoId(tabela) {
  const linhas = lerTodasAsLinhas(tabela);
  const maior = linhas.reduce((max, l) => Math.max(max, Number(l.id) || 0), 0);
  return maior + 1;
}

function criarLinha(tabela, dados) {
  const aba = getAba(tabela);
  const colunas = COLUNAS[tabela];
  const id = proximoId(tabela);

  const objeto = { ...dados, id };
  const linha = colunas.map((col) => (objeto[col] !== undefined ? objeto[col] : ''));

  aba.appendRow(linha);

  const resultado = {};
  colunas.forEach((col) => (resultado[col] = objeto[col] !== undefined ? objeto[col] : ''));
  return resultado;
}

function atualizarLinha(tabela, dados) {
  const aba = getAba(tabela);
  const colunas = COLUNAS[tabela];
  const id = dados.id;
  if (id === undefined || id === null || id === '') {
    const err = new Error('Informe o id do registro a atualizar.');
    err.status = 400;
    throw err;
  }

  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return null;

  const intervalo = aba.getRange(2, 1, ultimaLinha - 1, colunas.length);
  const valores = intervalo.getValues();
  const idxId = colunas.indexOf('id');

  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][idxId]) === String(id)) {
      // Mesma regra de aplicarUpdate() em js/db.js: só sobrescreve campos
      // presentes e diferentes de undefined em `dados`; ausentes/undefined
      // preservam o valor já existente na planilha.
      colunas.forEach((col, j) => {
        if (col === 'id') return;
        if (dados[col] !== undefined) {
          valores[i][j] = dados[col] === '' ? '' : dados[col];
        }
      });
      intervalo.setValues(valores);

      const resultado = {};
      colunas.forEach((col, j) => (resultado[col] = valores[i][j]));
      return resultado;
    }
  }

  return null;
}

function removerLinha(tabela, id) {
  if (id === undefined || id === null || id === '') {
    const err = new Error('Informe o id do registro a remover.');
    err.status = 400;
    throw err;
  }

  const aba = getAba(tabela);
  const colunas = COLUNAS[tabela];
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return false;

  const idxId = colunas.indexOf('id');
  const valores = aba.getRange(2, 1, ultimaLinha - 1, colunas.length).getValues();

  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][idxId]) === String(id)) {
      // +2: +1 porque getRange começa em 1, +1 porque pulamos o cabeçalho.
      aba.deleteRow(i + 2);
      return true;
    }
  }

  return false;
}

/* -------------------------------------------------------------- resposta */

function respostaJson(objeto, status) {
  // ContentService não permite definir status HTTP diretamente (Apps Script
  // Web Apps sempre respondem 200 no transporte); por isso embutimos o
  // status pretendido no corpo, e js/db.js lê `corpo.status` (ou herda 200)
  // para decidir se deve lançar ApiError. Ver comentário equivalente em
  // js/db.js, função chamarAppsScript().
  const corpo = status && status !== 200 ? { ...objeto, status } : objeto;
  return ContentService.createTextOutput(JSON.stringify(corpo)).setMimeType(ContentService.MimeType.JSON);
}
