/**
 * PaliVida — Apps Script "backend" (Web App) para a planilha do Google Sheets.
 *
 * Este script é o intermediário HTTP entre o site estático (js/db.js) e a
 * planilha, que guarda TODAS as entidades compartilhadas do app:
 *
 *   conteudos, sintomas, pacientes, acompanhantes, administradores,
 *   vinculos e registros.
 *
 * (Só os "contatos" — Hospital/Família/SAC da Home — ficam no localStorage
 * do navegador, fora deste script.)
 *
 * O código "oficial" vive dentro do editor de Apps Script da planilha
 * (Extensões > Apps Script). Este arquivo é a cópia versionada no
 * repositório — ao alterar aqui, copie e cole de volta no editor e publique
 * uma nova versão da implantação (ver apps-script/README.md).
 *
 * Como o script funciona:
 *  - Orientado a CABEÇALHO: cada aba é lida pelos nomes da linha 1, não pela
 *    posição das colunas. A ordem das colunas na planilha não importa, e
 *    colunas extras criadas à mão são preservadas.
 *  - Colunas esperadas que faltem na aba (ex.: `usuario`, `alergias`,
 *    `outro_sintoma`) são acrescentadas automaticamente ao final do
 *    cabeçalho na primeira escrita — ou de uma vez, rodando
 *    `configurarPlanilha()` no editor.
 *  - Nunca devolve `senha_hash` em nenhuma resposta.
 */

/* ------------------------------------------------------------- constantes */

// Colunas esperadas em cada aba (a ordem aqui só vale para abas/cabeçalhos
// criados pelo script; abas existentes mantêm a ordem que já têm).
const COLUNAS = {
  conteudos: ['id', 'titulo', 'descricao', 'texto', 'sinaissintomas', 'sinaisalerta', 'referencias', 'data_post'],
  sintomas: ['id', 'nome_sintoma', 'created_at'],
  pacientes: [
    'id', 'usuario', 'nome', 'nome_social', 'email', 'senha_hash', 'celular', 'genero', 'data_nascimento',
    'cidade', 'estado', 'tipo_sanguineo', 'condicoes_medicas', 'medicacao', 'alergias',
    'contato_emergencia', 'unidades_de_saude', 'created_at',
  ],
  acompanhantes: [
    'id', 'usuario', 'nome_completo', 'nome_social', 'email', 'senha_hash', 'telefone', 'genero',
    'data_nascimento', 'relacionamento', 'created_at',
  ],
  administradores: [
    'id', 'usuario', 'nome', 'nome_social', 'email', 'senha_hash', 'telefone', 'genero', 'data_nascimento',
    'conselho_profissional', 'formacao', 'registro_profissional', 'especialidade', 'created_at',
  ],
  vinculos: ['id', 'paciente_id', 'acompanhante_id', 'created_at'],
  // `intensidade` é legado (a escala 0–10 foi retirada do app); a coluna é
  // mantida para não perder registros antigos, mas não é mais preenchida.
  registros: ['id', 'paciente_id', 'sintoma_id', 'outro_sintoma', 'data_registro', 'intensidade'],
};

const TABELAS_VALIDAS = new Set(Object.keys(COLUNAS));

// Abas de contas de acesso e o `tipo` que o site espera receber no login.
const TIPO_POR_TABELA_DE_CONTA = {
  pacientes: 'paciente',
  acompanhantes: 'acompanhante',
  administradores: 'administrador',
};

// Leitura (listar/buscar) dessas abas exige o token; conteudos e sintomas são
// públicos (o site os lê antes de qualquer login).
const TABELAS_COM_LEITURA_PROTEGIDA = new Set([
  'pacientes', 'acompanhantes', 'administradores', 'vinculos', 'registros',
]);

const COLUNAS_NUMERICAS = new Set(['id', 'paciente_id', 'acompanhante_id', 'sintoma_id', 'intensidade']);
const COLUNAS_SOMENTE_DATA = new Set(['data_nascimento', 'data_post']);
const COLUNAS_SECRETAS = new Set(['senha_hash']);

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Nome de usuário: 3–30 caracteres, minúsculas/números/ponto/hífen/sublinhado.
// Sem "@" — é o que diferencia um usuário de um e-mail no login.
const REGEX_USUARIO = /^[a-z0-9._-]{3,30}$/;

/* ------------------------------------------------------------------ doGet */

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const acao = p.acao;
    const tabela = p.tabela;

    // Login: leitura, não exige token (ainda não há sessão). Aceita o
    // e-mail OU o nome de usuário, em `identificador` (ou `email`, por
    // compatibilidade com versões antigas do site).
    if (acao === 'login') {
      return respostaJson(fazerLogin(p.identificador || p.email, p.senha));
    }

    if (acao === 'listar' || acao === 'buscar') {
      validarTabela(tabela);
      if (TABELAS_COM_LEITURA_PROTEGIDA.has(tabela)) validarToken(p.token);

      if (acao === 'listar') {
        return respostaJson(
          carregarTabela(tabela).registros
            .map((r) => publico(r.dados))
            .sort((a, b) => Number(a.id) - Number(b.id)),
        );
      }

      const achado = carregarTabela(tabela).registros.find((r) => String(r.dados.id) === String(p.id));
      if (!achado) return respostaJson({ erro: mensagemNaoEncontrado(tabela) }, 404);
      return respostaJson(publico(achado.dados));
    }

    return respostaJson({ erro: 'Ação inválida.' }, 400);
  } catch (err) {
    return respostaJson({ erro: err.message || String(err) }, err.status || 500);
  }
}

/* ----------------------------------------------------------------- doPost */

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const { acao, tabela, token, dados } = corpo;

    validarTabela(tabela);
    validarToken(token);

    // Uma escrita por vez: evita dois ids iguais se duas pessoas gravarem
    // no mesmo instante.
    lock.waitLock(20000);

    if (acao === 'criar') return respostaJson(criarLinha(tabela, dados || {}));
    if (acao === 'atualizar') {
      const atualizado = atualizarLinha(tabela, dados || {});
      if (!atualizado) return respostaJson({ erro: mensagemNaoEncontrado(tabela) }, 404);
      return respostaJson(atualizado);
    }
    if (acao === 'remover') {
      const removido = removerLinha(tabela, dados && dados.id);
      if (!removido) return respostaJson({ erro: mensagemNaoEncontrado(tabela) }, 404);
      return respostaJson({ ok: true });
    }
    return respostaJson({ erro: 'Ação inválida.' }, 400);
  } catch (err) {
    return respostaJson({ erro: err.message || String(err) }, err.status || 500);
  } finally {
    try { lock.releaseLock(); } catch (_) { /* lock não adquirido */ }
  }
}

/* ------------------------------------------------------------------ login */

function fazerLogin(identificador, senha) {
  const alvo = String(identificador || '').trim().toLowerCase();
  const senhaInformada = String(senha || '');
  if (!alvo || !senhaInformada) throw erroHttp('Informe o usuário ou e-mail e a senha.', 400);

  const tabelas = Object.keys(TIPO_POR_TABELA_DE_CONTA);
  for (let t = 0; t < tabelas.length; t++) {
    const registros = carregarTabela(tabelas[t]).registros;
    for (let i = 0; i < registros.length; i++) {
      const conta = registros[i].dados;
      const email = String(conta.email || '').trim().toLowerCase();
      const usuario = String(conta.usuario || '').trim().toLowerCase();
      const bate = email === alvo || (usuario !== '' && usuario === alvo);
      if (bate && String(conta.senha_hash) === senhaInformada) {
        return {
          id: conta.id,
          email: conta.email,
          usuario: conta.usuario || '',
          tipo: TIPO_POR_TABELA_DE_CONTA[tabelas[t]],
        };
      }
    }
  }
  // Mesma mensagem para "não existe" e "senha errada", para não revelar
  // quais usuários/e-mails estão cadastrados.
  throw erroHttp('Usuário/e-mail ou senha incorretos.', 401);
}

/* -------------------------------------------------------------- validação */

function erroHttp(mensagem, status) {
  const err = new Error(mensagem);
  err.status = status;
  return err;
}

function validarTabela(tabela) {
  if (!TABELAS_VALIDAS.has(tabela)) throw erroHttp('Tabela inválida.', 400);
}

function validarToken(token) {
  // Proteção básica: evita escrita/leitura acidental ou abusiva por quem não
  // conhece o token. NÃO é autenticação real — quem pode fazer o quê é
  // decidido no site (js/db.js: exigirAutenticacao()/exigirPerfil()).
  const esperado = PropertiesService.getScriptProperties().getProperty('PALIVIDA_TOKEN');
  if (!esperado || token !== esperado) throw erroHttp('Token inválido.', 403);
}

function mensagemNaoEncontrado(tabela) {
  return tabela === 'conteudos' ? 'Conteúdo não encontrado.' : 'Registro não encontrado.';
}

// Regras das abas de contas (pacientes/acompanhantes/administradores):
// formato e unicidade de e-mail e usuário (comparando nas TRÊS abas, sem
// diferenciar maiúsculas), e tamanho mínimo da senha. `dados` é alterado:
// e-mail e usuário passam para minúsculas.
function validarConta(tabela, dados, ehCriacao, idAtual) {
  const informado = (campo) => dados[campo] !== undefined && dados[campo] !== null && String(dados[campo]).trim() !== '';

  if (ehCriacao || dados.email !== undefined) {
    const email = String(dados.email || '').trim().toLowerCase();
    if (!REGEX_EMAIL.test(email)) throw erroHttp('E-mail inválido.', 400);
    dados.email = email;
  }
  if (ehCriacao || informado('usuario')) {
    const usuario = String(dados.usuario || '').trim().toLowerCase();
    if (!REGEX_USUARIO.test(usuario)) {
      throw erroHttp('Usuário inválido: use de 3 a 30 caracteres entre letras, números, ponto, hífen ou sublinhado (sem espaços nem @).', 400);
    }
    dados.usuario = usuario;
  }
  if (ehCriacao || informado('senha_hash')) {
    if (String(dados.senha_hash || '').length < 6) throw erroHttp('A senha precisa ter ao menos 6 caracteres.', 400);
  }

  const verificarEmail = dados.email !== undefined;
  const verificarUsuario = informado('usuario');
  if (!verificarEmail && !verificarUsuario) return;

  Object.keys(TIPO_POR_TABELA_DE_CONTA).forEach((outra) => {
    carregarTabela(outra).registros.forEach((r) => {
      if (outra === tabela && String(r.dados.id) === String(idAtual)) return; // a própria conta
      if (verificarEmail && String(r.dados.email || '').trim().toLowerCase() === dados.email) {
        throw erroHttp('Este e-mail já está cadastrado.', 409);
      }
      if (verificarUsuario && String(r.dados.usuario || '').trim().toLowerCase() === dados.usuario) {
        throw erroHttp('Este nome de usuário já está em uso.', 409);
      }
    });
  });
}

/* --------------------------------------------------------- acesso à aba */

function getPlanilha() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// Devolve a aba; se ainda não existir, cria (com o cabeçalho esperado).
function getAba(tabela) {
  const planilha = getPlanilha();
  let aba = planilha.getSheetByName(tabela);
  if (!aba) {
    aba = planilha.insertSheet(tabela);
    garantirColunas(aba, tabela);
  }
  return aba;
}

function lerCabecalho(aba) {
  const ultimaColuna = aba.getLastColumn();
  if (ultimaColuna < 1) return [];
  return aba.getRange(1, 1, 1, ultimaColuna).getValues()[0].map((c) => String(c).trim());
}

// Acrescenta ao final do cabeçalho as colunas esperadas que ainda não
// existem (cria o cabeçalho inteiro se a aba estiver vazia). Devolve o
// cabeçalho atualizado.
function garantirColunas(aba, tabela) {
  const cabecalho = lerCabecalho(aba);
  const faltando = COLUNAS[tabela].filter((c) => cabecalho.indexOf(c) === -1);
  if (faltando.length) {
    aba.getRange(1, cabecalho.length + 1, 1, faltando.length).setValues([faltando]);
    if (cabecalho.length === 0) aba.setFrozenRows(1);
  }
  return cabecalho.concat(faltando);
}

// Lê a aba inteira de uma vez e devolve { aba, cabecalho, registros }, onde
// cada registro é { numero (linha na planilha), dados (objeto) }.
function carregarTabela(tabela) {
  const aba = getAba(tabela);
  const cabecalho = lerCabecalho(aba);
  const registros = [];
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha >= 2 && cabecalho.length) {
    const valores = aba.getRange(2, 1, ultimaLinha - 1, cabecalho.length).getValues();
    valores.forEach((linha, i) => {
      if (linha.every((v) => v === '' || v === null)) return; // linha vazia
      registros.push({ numero: i + 2, dados: paraObjeto(tabela, cabecalho, linha) });
    });
  }
  return { aba, cabecalho, registros };
}

// Converte uma linha da planilha em objeto { coluna: valor }, normalizando
// tipos (datas viram texto, ids viram número) e incluindo as colunas
// esperadas que a aba ainda não tem (vazias).
function paraObjeto(tabela, cabecalho, linha) {
  const obj = {};
  COLUNAS[tabela].forEach((c) => { obj[c] = ''; });
  cabecalho.forEach((col, i) => {
    if (!col) return;
    obj[col] = normalizarValor(col, linha[i]);
  });
  return obj;
}

function normalizarValor(coluna, valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    if (COLUNAS_SOMENTE_DATA.has(coluna)) {
      return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    return valor.toISOString();
  }
  if (COLUNAS_NUMERICAS.has(coluna)) {
    if (valor === '') return '';
    const n = Number(valor);
    return isFinite(n) ? n : valor;
  }
  return typeof valor === 'number' ? String(valor) : valor;
}

function valorParaCelula(valor) {
  if (valor === undefined || valor === null) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') return JSON.stringify(valor);
  return valor;
}

// Remove campos secretos antes de qualquer resposta.
function publico(obj) {
  const copia = {};
  Object.keys(obj).forEach((k) => { if (!COLUNAS_SECRETAS.has(k)) copia[k] = obj[k]; });
  return copia;
}

function proximoId(registros) {
  return registros.reduce((max, r) => Math.max(max, Number(r.dados.id) || 0), 0) + 1;
}

/* ------------------------------------------------------------ escrita */

function criarLinha(tabela, dadosRecebidos) {
  const aba = getAba(tabela);
  const cabecalho = garantirColunas(aba, tabela);
  const registros = carregarTabela(tabela).registros;
  const dados = Object.assign({}, dadosRecebidos);

  if (TIPO_POR_TABELA_DE_CONTA[tabela]) validarConta(tabela, dados, true, null);

  dados.id = proximoId(registros);
  const linha = cabecalho.map((col) => valorParaCelula(dados[col]));

  const numero = aba.getLastRow() + 1;
  const faixa = aba.getRange(numero, 1, 1, cabecalho.length);
  faixa.setNumberFormat('@'); // texto puro: o Sheets não converte datas/telefones
  faixa.setValues([linha]);

  return publico(paraObjeto(tabela, cabecalho, linha));
}

function atualizarLinha(tabela, dadosRecebidos) {
  const id = dadosRecebidos.id;
  if (id === undefined || id === null || id === '') throw erroHttp('Informe o id do registro a atualizar.', 400);

  const aba = getAba(tabela);
  const cabecalho = garantirColunas(aba, tabela);
  const registros = carregarTabela(tabela).registros;
  const alvo = registros.find((r) => String(r.dados.id) === String(id));
  if (!alvo) return null;

  const dados = Object.assign({}, dadosRecebidos);
  if (TIPO_POR_TABELA_DE_CONTA[tabela]) validarConta(tabela, dados, false, id);

  // Só sobrescreve campos presentes e diferentes de undefined; ausentes
  // preservam o valor já existente na planilha (null vira célula vazia).
  const atualizado = Object.assign({}, alvo.dados);
  cabecalho.forEach((col, j) => {
    if (!col || col === 'id' || dados[col] === undefined) return;
    const valor = valorParaCelula(dados[col]);
    const celula = aba.getRange(alvo.numero, j + 1);
    celula.setNumberFormat('@');
    celula.setValue(valor);
    atualizado[col] = normalizarValor(col, valor);
  });

  return publico(atualizado);
}

function removerLinha(tabela, id) {
  if (id === undefined || id === null || id === '') throw erroHttp('Informe o id do registro a remover.', 400);
  const { aba, registros } = carregarTabela(tabela);
  const alvo = registros.find((r) => String(r.dados.id) === String(id));
  if (!alvo) return false;
  aba.deleteRow(alvo.numero);
  return true;
}

/* ----------------------------------------------------------------- setup */

// Rode UMA vez no editor (selecione `configurarPlanilha` e clique em
// Executar) para criar as abas que faltam, acrescentar as colunas novas e
// deixar as células de dados como texto puro. Não apaga nem altera dados.
function configurarPlanilha() {
  Object.keys(COLUNAS).forEach((tabela) => {
    const aba = getAba(tabela);
    const cabecalho = garantirColunas(aba, tabela);
    const linhas = Math.max(aba.getMaxRows() - 1, 1);
    aba.getRange(2, 1, linhas, cabecalho.length).setNumberFormat('@');
  });
  SpreadsheetApp.getUi().alert('Planilha configurada: abas e colunas do PaliVida conferidas.');
}

/* -------------------------------------------------------------- resposta */

function respostaJson(objeto, status) {
  // ContentService não permite definir status HTTP (Web Apps de Apps Script
  // sempre respondem 200 no transporte); por isso o status pretendido vai no
  // corpo, e js/db.js lê `corpo.status` (ausente = sucesso). Listas (arrays)
  // só são devolvidas em caso de sucesso, sem `status`.
  const corpo = status && status !== 200 ? Object.assign({}, objeto, { status: status }) : objeto;
  return ContentService.createTextOutput(JSON.stringify(corpo)).setMimeType(ContentService.MimeType.JSON);
}
