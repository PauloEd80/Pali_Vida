/**
 * "Backend" do PaliVida rodando 100% no navegador.
 *
 * Este arquivo reimplementa, uma a uma, as rotas de backend/src/rotas/*.js
 * do código-fonte original (mesmas validações, mesmas regras de permissão,
 * mesmos formatos de resposta) — só que em vez de Express + SQLite, os
 * "dados" ficam em localStorage. Isso existe porque um site estático não tem
 * servidor: é a forma de manter a demonstração funcional (login, cadastro,
 * registrar sintomas, editar conteúdos...) sem precisar hospedar uma API.
 *
 * Import ante: a "senha_hash" aqui é texto puro (não há bcrypt no navegador
 * por padrão, e não faz sentido "proteger" dados que o próprio visitante
 * está gerando no próprio navegador). Não é assim que o backend real
 * funciona — ver backend/src/schema.sql e utils.js no código-fonte.
 */
window.PV = window.PV || {};

(function () {
  const CHAVE_BANCO = 'palivida_db_v1';

  // URL do Web App do Google Apps Script que armazena `conteudos` e
  // `sintomas` numa planilha do Google Sheets (ver apps-script/README.md
  // para como gerar essa URL). Troque este valor sempre que a implantação
  // do Web App for republicada (uma nova implantação gera uma nova URL do
  // tipo https://script.google.com/macros/s/XXXXX/exec).
  const URL_APPS_SCRIPT = 'https://script.google.com/macros/s/AKfycbzDy--AnNvPVeAGIjh-eomguU9cKqsj-qqLkvVVNsUKfDKmqmxkzsawbjrJdG65EUPw/exec';

  // Token compartilhado enviado em toda escrita (criar/atualizar/remover)
  // para o Apps Script — precisa ser o mesmo valor salvo em
  // PropertiesService.getScriptProperties() no script (chave
  // PALIVIDA_TOKEN). É uma proteção básica contra escrita
  // acidental/abusiva por quem descobrir a URL, não uma autenticação real:
  // quem pode editar o quê continua sendo decidido aqui no site, por
  // exigirAutenticacao()/exigirPerfil(), antes mesmo de chamar o Apps Script.
  const TOKEN_APPS_SCRIPT = 'immense-educate-element';

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }

  const erro = (msg, status) => {
    throw new ApiError(msg, status);
  };

  function atraso(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms ?? 220 + Math.random() * 200));
  }

  /* ------------------------------------------------ cliente Apps Script */
  // `conteudos` e `sintomas` passaram a viver numa planilha do Google
  // Sheets, lida/escrita através deste Web App em vez do array em memória +
  // localStorage usado pelas demais entidades. Mantemos `await atraso()`
  // nas funções de sintomas/conteudos por consistência de UX com o resto do
  // arquivo (mesmo "delay" percebido em todas as telas) — a latência real da
  // requisição HTTP ao Apps Script já soma a isso, então esse atraso
  // artificial poderia ser removido sem problema; optamos por mantê-lo para
  // não alterar a sensação de carregamento das telas nesta migração.

  async function chamarAppsScriptGet(params) {
    const url = new URL(URL_APPS_SCRIPT);
    Object.entries(params).forEach(([chave, valor]) => url.searchParams.set(chave, valor));

    let resposta;
    try {
      resposta = await fetch(url.toString());
    } catch {
      erro('Não foi possível conectar ao armazenamento. Verifique sua conexão.', 503);
    }
    return tratarRespostaAppsScript(resposta);
  }

  async function chamarAppsScriptPost(corpo) {
    let resposta;
    try {
      // O Apps Script Web App exige este content-type "simples" para evitar
      // preflight CORS (que ele não responde); o corpo em si continua sendo
      // JSON serializado normalmente.
      resposta = await fetch(URL_APPS_SCRIPT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...corpo, token: TOKEN_APPS_SCRIPT }),
      });
    } catch {
      erro('Não foi possível conectar ao armazenamento. Verifique sua conexão.', 503);
    }
    return tratarRespostaAppsScript(resposta);
  }

  async function tratarRespostaAppsScript(resposta) {
    let corpo;
    try {
      corpo = await resposta.json();
    } catch {
      erro('Resposta inválida do armazenamento.', 502);
    }
    // O Apps Script Web App sempre responde HTTP 200 no transporte; o status
    // HTTP "pretendido" (400/403/404/...) vem embutido em corpo.status,
    // conforme respostaJson() em apps-script/Code.gs. Um corpo sem `status`
    // (ou status 200) é sucesso.
    if (corpo && corpo.status && corpo.status !== 200) {
      erro(corpo.erro || 'Erro ao acessar o armazenamento.', corpo.status);
    }
    return corpo;
  }

  /* --------------------------------------------------------------- store */

  // Nota sobre o escopo desta migração: `banco.sintomas` e `banco.conteudos`
  // abaixo continuam existindo (populados só no seed inicial) porque
  // `registros` (fora do escopo) ainda referencia esse `banco` como
  // container único, mas eles NÃO são mais a fonte de verdade — quem lê e
  // escreve sintomas/conteudos de fato é o Apps Script (ver blocos
  // `sintomas`/`conteudos` mais abaixo). Esses arrays em `banco` ficam
  // "congelados" no que foi semeado na primeira carga de cada navegador.
  function bancoInicial() {
    const seed = window.PALIVIDA_SEED;
    const agora = new Date().toISOString();
    const hoje = agora.split('T')[0];

    const banco = {
      proximoId: { pacientes: 1, acompanhantes: 1, administradores: 1, vinculos: 1, sintomas: 1, registros: 1, conteudos: 1, contatos: 1 },
      pacientes: [],
      acompanhantes: [],
      administradores: [],
      vinculos: [],
      sintomas: [],
      registros: [],
      conteudos: [],
      contatos: [],
    };

    const proximo = (tabela) => banco.proximoId[tabela]++;

    seed.sintomas.forEach((nome) => {
      banco.sintomas.push({ id: proximo('sintomas'), nome_sintoma: nome, created_at: agora });
    });

    seed.conteudos.forEach((c) => {
      banco.conteudos.push({
        id: proximo('conteudos'),
        titulo: c.titulo,
        descricao: c.descricao,
        texto: c.descricao,
        sinaissintomas: c.sinaissintomas,
        sinaisalerta: c.sinaisalerta,
        data_post: hoje,
      });
    });

    const u = seed.usuarios;
    banco.administradores.push({
      id: proximo('administradores'),
      nome: u.administrador.nome,
      nome_social: null,
      email: u.administrador.email,
      senha_hash: u.administrador.senha,
      telefone: null,
      genero: null,
      data_nascimento: null,
      conselho_profissional: u.administrador.conselho_profissional,
      formacao: u.administrador.formacao,
      registro_profissional: null,
      especialidade: null,
      created_at: agora,
    });
    banco.pacientes.push({
      id: proximo('pacientes'),
      nome: u.paciente.nome,
      nome_social: null,
      email: u.paciente.email,
      senha_hash: u.paciente.senha,
      celular: null,
      genero: null,
      data_nascimento: null,
      cidade: u.paciente.cidade,
      estado: u.paciente.estado,
      tipo_sanguineo: u.paciente.tipo_sanguineo,
      condicoes_medicas: null,
      medicacao: null,
      contato_emergencia: null,
      unidades_de_saude: null,
      created_at: agora,
    });
    banco.acompanhantes.push({
      id: proximo('acompanhantes'),
      nome_completo: u.acompanhante.nome_completo,
      nome_social: null,
      email: u.acompanhante.email,
      senha_hash: u.acompanhante.senha,
      telefone: null,
      genero: null,
      data_nascimento: null,
      relacionamento: u.acompanhante.relacionamento,
      created_at: agora,
    });

    banco.vinculos.push({
      id: proximo('vinculos'),
      paciente_id: banco.pacientes[0].id,
      acompanhante_id: banco.acompanhantes[0].id,
      created_at: agora,
    });

    const idsSintomas = banco.sintomas.slice(0, 4).map((s) => s.id);
    seed.registrosIniciais.forEach((intensidade, i) => {
      banco.registros.push({
        id: proximo('registros'),
        paciente_id: banco.pacientes[0].id,
        sintoma_id: idsSintomas[i % idsSintomas.length],
        intensidade,
        data_registro: agora,
      });
    });

    return banco;
  }

  let banco = carregar();

  function carregar() {
    try {
      const bruto = localStorage.getItem(CHAVE_BANCO);
      if (bruto) {
        const b = JSON.parse(bruto);
        // Migração leve: quem já tinha um banco salvo antes da entidade
        // "contatos" existir ganha a tabela vazia em vez de travar.
        if (!Array.isArray(b.contatos)) b.contatos = [];
        if (!b.proximoId) b.proximoId = {};
        if (!b.proximoId.contatos) b.proximoId.contatos = 1;
        return b;
      }
    } catch {
      /* localStorage indisponível ou dado corrompido: recomeça do zero */
    }
    const inicial = bancoInicial();
    persistir(inicial);
    return inicial;
  }

  function persistir(b) {
    try {
      localStorage.setItem(CHAVE_BANCO, JSON.stringify(b));
    } catch {
      /* modo privado / quota cheia: a sessão continua funcionando em memória */
    }
  }

  function salvar() {
    persistir(banco);
  }

  function resetarDados() {
    banco = bancoInicial();
    salvar();
  }

  /* ------------------------------------------------------------- helpers */

  function semSenha(registro) {
    if (!registro) return registro;
    const { senha_hash, senha, ...resto } = registro;
    return resto;
  }

  function sessaoAtual() {
    const s = window.PV.session.lerSessao();
    return s ? s.usuario : null;
  }

  function exigirAutenticacao() {
    const usuario = sessaoAtual();
    if (!usuario) erro('Sessão expirada. Entre novamente.', 401);
    return usuario;
  }

  function exigirPerfil(usuario, ...perfis) {
    if (!usuario || !perfis.includes(usuario.tipo)) {
      erro('Você não tem permissão para esta ação.', 403);
    }
  }

  function podeVerPaciente(usuario, pacienteId) {
    if (!usuario) return false;
    pacienteId = Number(pacienteId);
    if (usuario.tipo === 'administrador') return true;
    if (usuario.tipo === 'paciente') return Number(usuario.id) === pacienteId;
    if (usuario.tipo === 'acompanhante') {
      return banco.vinculos.some(
        (v) => Number(v.paciente_id) === pacienteId && Number(v.acompanhante_id) === Number(usuario.id),
      );
    }
    return false;
  }

  function ehODono(usuario, id) {
    return usuario.tipo === 'administrador' || Number(usuario.id) === Number(id);
  }

  function aplicarUpdate(alvo, campos, corpo) {
    campos.forEach((campo) => {
      if (corpo[campo] !== undefined) {
        alvo[campo] = corpo[campo] === '' ? null : corpo[campo];
      }
    });
  }

  function gerarToken(usuario) {
    // Token "de brinquedo": só existe para o front ter algo para guardar e
    // mandar de volta. Não há segredo de servidor para assinar/validar aqui.
    return btoa(unescape(encodeURIComponent(JSON.stringify({ ...usuario, t: Date.now() }))));
  }

  const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

  /* ------------------------------------------------------------------ api */
  // Mesma superfície pública de frontend/src/services/api.ts, para que as
  // telas chamem PV.db.auth.login(...), PV.db.conteudos.listar()... como no
  // app original chamava api.auth.login(...), api.conteudos.listar()...

  function normalizarConteudo(bruto) {
    return {
      ...bruto,
      SinaisSintomas: bruto?.SinaisSintomas ?? bruto?.sinaissintomas ?? '',
      SinaisAlerta: bruto?.SinaisAlerta ?? bruto?.sinaisalerta ?? '',
    };
  }

  const auth = {
    async login(email, senha) {
      await atraso();
      if (!emailValido(email)) erro('E-mail inválido.', 400);
      if (!senha) erro('Informe a senha.', 400);

      const alvo = String(email).trim().toLowerCase();
      const tabelas = [
        ['pacientes', 'paciente'],
        ['acompanhantes', 'acompanhante'],
        ['administradores', 'administrador'],
      ];
      let encontrado = null;
      for (const [tabela, tipo] of tabelas) {
        const registro = banco[tabela].find((r) => r.email.toLowerCase() === alvo);
        if (registro) {
          encontrado = { ...registro, tipo };
          break;
        }
      }

      if (!encontrado || encontrado.senha_hash !== senha) {
        erro('E-mail ou senha incorretos.', 401);
      }

      const user = { id: encontrado.id, email: encontrado.email, tipo: encontrado.tipo };
      return { success: true, token: gerarToken(user), user };
    },

    async recuperarSenha(_email) {
      await atraso();
      return {
        success: true,
        message: 'Se este e-mail estiver cadastrado, enviaremos as instruções de redefinição.',
      };
    },
  };

  const sintomas = {
    // `sintomas` agora vive na planilha do Google Sheets (aba `sintomas`),
    // acessada via Apps Script — ver comentário "cliente Apps Script" acima.
    // As validações de quem pode escrever continuam aqui no site, antes do
    // fetch, como faziam antes de acessar `banco.sintomas` diretamente.
    async listar() {
      await atraso();
      const linhas = await chamarAppsScriptGet({ acao: 'listar', tabela: 'sintomas' });
      return [...linhas].sort((a, b) => Number(a.id) - Number(b.id));
    },
    async criar(nome_sintoma) {
      await atraso();
      const usuario = exigirAutenticacao();
      exigirPerfil(usuario, 'administrador');
      const nome = String(nome_sintoma || '').trim();
      if (!nome) erro('Informe o nome do sintoma.', 400);

      const existentes = await chamarAppsScriptGet({ acao: 'listar', tabela: 'sintomas' });
      if (existentes.some((s) => s.nome_sintoma === nome)) {
        erro('Este sintoma já está cadastrado.', 409);
      }

      const sintoma = await chamarAppsScriptPost({
        acao: 'criar',
        tabela: 'sintomas',
        dados: { nome_sintoma: nome, created_at: new Date().toISOString() },
      });
      return { sintoma };
    },
    async remover(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      exigirPerfil(usuario, 'administrador');
      await chamarAppsScriptPost({ acao: 'remover', tabela: 'sintomas', dados: { id } });
    },
  };

  const registros = {
    async listar() {
      await atraso();
      const usuario = exigirAutenticacao();
      let lista;
      if (usuario.tipo === 'administrador') {
        lista = [...banco.registros];
      } else if (usuario.tipo === 'paciente') {
        lista = banco.registros.filter((r) => Number(r.paciente_id) === Number(usuario.id));
      } else {
        const pacientesVinculados = new Set(
          banco.vinculos.filter((v) => Number(v.acompanhante_id) === Number(usuario.id)).map((v) => v.paciente_id),
        );
        lista = banco.registros.filter((r) => pacientesVinculados.has(r.paciente_id));
      }
      return lista.sort((a, b) => new Date(b.data_registro) - new Date(a.data_registro));
    },
    async criar({ paciente_id, sintoma_id, intensidade }) {
      await atraso();
      const usuario = exigirAutenticacao();
      paciente_id = Number(paciente_id);
      sintoma_id = Number(sintoma_id);
      intensidade = Number(intensidade);
      const valido =
        Number.isInteger(paciente_id) && paciente_id > 0 &&
        Number.isInteger(sintoma_id) && sintoma_id > 0 &&
        Number.isInteger(intensidade) && intensidade >= 0 && intensidade <= 10;
      if (!valido) erro('Dados inválidos: informe paciente, sintoma e intensidade (0 a 10).', 400);
      if (!podeVerPaciente(usuario, paciente_id)) {
        erro('Você não pode registrar sintomas para este paciente.', 403);
      }
      // `sintomas` migrou para a planilha (ver bloco `sintomas` acima);
      // `registros` continua em localStorage, fora do escopo desta
      // migração, mas precisa validar o sintoma_id contra a fonte atual.
      const sintomasAtuais = await chamarAppsScriptGet({ acao: 'listar', tabela: 'sintomas' });
      if (!sintomasAtuais.some((s) => Number(s.id) === sintoma_id)) erro('Sintoma não encontrado.', 404);

      const registro = {
        id: banco.proximoId.registros++,
        paciente_id,
        sintoma_id,
        intensidade,
        data_registro: new Date().toISOString(),
      };
      banco.registros.push(registro);
      salvar();
      return { registro };
    },
  };

  const conteudos = {
    // `conteudos` agora vive na planilha do Google Sheets (aba `conteudos`),
    // acessada via Apps Script — ver comentário "cliente Apps Script" acima.
    // normalizarConteudo() continua sendo aplicado do lado do site (não do
    // Apps Script), para manter o mesmo contrato que as telas já consomem.
    async listar() {
      await atraso();
      const linhas = await chamarAppsScriptGet({ acao: 'listar', tabela: 'conteudos' });
      return [...linhas].sort((a, b) => Number(a.id) - Number(b.id)).map(normalizarConteudo);
    },
    async buscar(id) {
      await atraso();
      const conteudo = await chamarAppsScriptGet({ acao: 'buscar', tabela: 'conteudos', id });
      return normalizarConteudo(conteudo);
    },
    async criar(dados) {
      await atraso();
      const usuario = exigirAutenticacao();
      exigirPerfil(usuario, 'administrador');
      if (!dados.titulo) erro('Informe o título do conteúdo.', 400);
      await chamarAppsScriptPost({
        acao: 'criar',
        tabela: 'conteudos',
        dados: {
          titulo: dados.titulo,
          descricao: dados.descricao ?? null,
          texto: dados.texto ?? dados.descricao ?? null,
          sinaissintomas: dados.SinaisSintomas ?? dados.sinaissintomas ?? null,
          sinaisalerta: dados.SinaisAlerta ?? dados.sinaisalerta ?? null,
          data_post: dados.data_post ?? new Date().toISOString().split('T')[0],
        },
      });
    },
    async atualizar(id, dados) {
      await atraso();
      const usuario = exigirAutenticacao();
      exigirPerfil(usuario, 'administrador');
      // Mesma regra de aplicarUpdate(): campos ausentes/undefined não devem
      // apagar o valor já existente. O Apps Script replica essa regra do
      // lado da planilha (ver atualizarLinha() em apps-script/Code.gs), mas
      // aqui já filtramos os `undefined` para não mandar chave nenhuma nesse
      // caso, deixando explícito o que está de fato sendo alterado.
      const camposEnviados = {
        titulo: dados.titulo,
        descricao: dados.descricao,
        texto: dados.texto ?? dados.descricao,
        sinaissintomas: dados.SinaisSintomas ?? dados.sinaissintomas,
        sinaisalerta: dados.SinaisAlerta ?? dados.sinaisalerta,
        data_post: dados.data_post,
      };
      const normalizado = { id };
      Object.entries(camposEnviados).forEach(([campo, valor]) => {
        if (valor !== undefined) normalizado[campo] = valor;
      });

      const atualizado = await chamarAppsScriptPost({ acao: 'atualizar', tabela: 'conteudos', dados: normalizado });
      return normalizarConteudo(atualizado);
    },
    async remover(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      exigirPerfil(usuario, 'administrador');
      await chamarAppsScriptPost({ acao: 'remover', tabela: 'conteudos', dados: { id } });
    },
  };

  /* Contatos de apoio (Hospital, Família, SAC) mostrados na Home. São
     pessoais de cada paciente/cuidador (cada um vê e edita os seus) — por
     isso ficam amarrados a dono_tipo+dono_id, e não a paciente_id: o
     cuidador pode ter contatos próprios, diferentes dos do paciente que
     acompanha. Cada card começa com um exemplo genérico (ver EXEMPLOS_CONTATO
     abaixo) que o usuário edita e salva; nada é enviado a ninguém, é só um
     atalho para os números que a própria pessoa cadastrou. */
  const TIPOS_CONTATO = new Set(['hospital', 'familia', 'sac']);

  const EXEMPLOS_CONTATO = {
    hospital: { nome: 'Hospital / UBS de referência', telefone: '(00) 0000-0000', observacao: 'Endereço ou setor de referência' },
    familia: { nome: 'Nome do familiar ou cuidador', telefone: '(00) 00000-0000', observacao: 'Grau de parentesco' },
    sac: { nome: 'Central de atendimento do plano/serviço', telefone: '0800 000 0000', observacao: 'Horário de atendimento' },
  };

  function normalizarContato(tipo, registro) {
    const exemplo = EXEMPLOS_CONTATO[tipo];
    if (!registro) return { tipo, preenchido: false, ...exemplo };
    return {
      tipo,
      preenchido: true,
      nome: registro.nome ?? exemplo.nome,
      telefone: registro.telefone ?? exemplo.telefone,
      observacao: registro.observacao ?? exemplo.observacao,
    };
  }

  const contatos = {
    async buscar(tipo) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!TIPOS_CONTATO.has(tipo)) erro('Tipo de contato inválido.', 400);
      const registro = banco.contatos.find(
        (c) => c.tipo === tipo && c.dono_tipo === usuario.tipo && Number(c.dono_id) === Number(usuario.id),
      );
      return normalizarContato(tipo, registro);
    },
    async salvar(tipo, dados) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!TIPOS_CONTATO.has(tipo)) erro('Tipo de contato inválido.', 400);
      if (!String(dados.nome || '').trim()) erro('Informe um nome para o contato.', 400);
      if (!String(dados.telefone || '').trim()) erro('Informe um telefone para o contato.', 400);

      let registro = banco.contatos.find(
        (c) => c.tipo === tipo && c.dono_tipo === usuario.tipo && Number(c.dono_id) === Number(usuario.id),
      );
      if (registro) {
        aplicarUpdate(registro, ['nome', 'telefone', 'observacao'], dados);
      } else {
        registro = {
          id: banco.proximoId.contatos++,
          tipo,
          dono_tipo: usuario.tipo,
          dono_id: usuario.id,
          nome: dados.nome,
          telefone: dados.telefone,
          observacao: dados.observacao ?? null,
        };
        banco.contatos.push(registro);
      }
      salvar();
      return normalizarContato(tipo, registro);
    },
  };

  const CAMPOS_PACIENTE = [
    'nome', 'nome_social', 'email', 'celular', 'genero', 'data_nascimento',
    'cidade', 'estado', 'tipo_sanguineo', 'condicoes_medicas', 'medicacao',
    'contato_emergencia', 'unidades_de_saude',
  ];

  const pacientes = {
    async criar(dados) {
      await atraso();
      if (!String(dados.nome || '').trim()) erro('Informe o nome.', 400);
      if (!emailValido(dados.email)) erro('E-mail inválido.', 400);
      if (!dados.senha || String(dados.senha).length < 6) erro('A senha precisa ter ao menos 6 caracteres.', 400);

      const email = String(dados.email).trim().toLowerCase();
      if (banco.pacientes.some((p) => p.email.toLowerCase() === email)) {
        erro('Já existe um cadastro com este e-mail.', 409);
      }

      const paciente = { id: banco.proximoId.pacientes++, senha_hash: dados.senha, created_at: new Date().toISOString() };
      CAMPOS_PACIENTE.forEach((c) => (paciente[c] = c === 'email' ? email : dados[c] ?? null));
      banco.pacientes.push(paciente);
      salvar();
      return semSenha(paciente);
    },
    async buscar(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!podeVerPaciente(usuario, id)) erro('Você não tem permissão para ver este paciente.', 403);
      const paciente = banco.pacientes.find((p) => Number(p.id) === Number(id));
      if (!paciente) erro('Paciente não encontrado.', 404);
      return semSenha(paciente);
    },
    async atualizar(id, dados) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!podeVerPaciente(usuario, id)) erro('Você não tem permissão para editar este paciente.', 403);
      const paciente = banco.pacientes.find((p) => Number(p.id) === Number(id));
      if (!paciente) erro('Paciente não encontrado.', 404);
      aplicarUpdate(paciente, CAMPOS_PACIENTE, dados);
      if (dados.senha) paciente.senha_hash = dados.senha;
      salvar();
      return semSenha(paciente);
    },
    async acompanhantes(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!podeVerPaciente(usuario, id)) erro('Você não tem permissão para ver estes vínculos.', 403);
      const idsVinculados = banco.vinculos
        .filter((v) => Number(v.paciente_id) === Number(id))
        .map((v) => v.acompanhante_id);
      const lista = banco.acompanhantes
        .filter((a) => idsVinculados.includes(a.id))
        .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo))
        .map(semSenha);
      return lista;
    },
  };

  const CAMPOS_ACOMPANHANTE = ['nome_completo', 'nome_social', 'email', 'telefone', 'genero', 'data_nascimento', 'relacionamento'];

  const acompanhantes = {
    async criar(dados) {
      await atraso();
      if (!String(dados.nome_completo || '').trim()) erro('Informe o nome completo.', 400);
      if (!emailValido(dados.email)) erro('E-mail inválido.', 400);
      if (!dados.senha || String(dados.senha).length < 6) erro('A senha precisa ter ao menos 6 caracteres.', 400);

      const email = String(dados.email).trim().toLowerCase();
      if (banco.acompanhantes.some((a) => a.email.toLowerCase() === email)) {
        erro('Já existe um cadastro com este e-mail.', 409);
      }

      const acompanhante = { id: banco.proximoId.acompanhantes++, senha_hash: dados.senha, created_at: new Date().toISOString() };
      CAMPOS_ACOMPANHANTE.forEach((c) => (acompanhante[c] = c === 'email' ? email : dados[c] ?? null));
      banco.acompanhantes.push(acompanhante);
      salvar();
      return semSenha(acompanhante);
    },
    async buscar(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!ehODono(usuario, id)) erro('Você não tem permissão para ver este cadastro.', 403);
      const acompanhante = banco.acompanhantes.find((a) => Number(a.id) === Number(id));
      if (!acompanhante) erro('Acompanhante não encontrado.', 404);
      return semSenha(acompanhante);
    },
    async atualizar(id, dados) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!ehODono(usuario, id)) erro('Você não tem permissão para editar este cadastro.', 403);
      const acompanhante = banco.acompanhantes.find((a) => Number(a.id) === Number(id));
      if (!acompanhante) erro('Acompanhante não encontrado.', 404);
      aplicarUpdate(acompanhante, CAMPOS_ACOMPANHANTE, dados);
      if (dados.senha) acompanhante.senha_hash = dados.senha;
      salvar();
      return semSenha(acompanhante);
    },
    async pacientes(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!ehODono(usuario, id)) erro('Você não tem permissão para ver estes vínculos.', 403);
      const idsVinculados = banco.vinculos
        .filter((v) => Number(v.acompanhante_id) === Number(id))
        .map((v) => v.paciente_id);
      const lista = banco.pacientes
        .filter((p) => idsVinculados.includes(p.id))
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map(semSenha);
      return lista;
    },
  };

  const CAMPOS_ADMIN = [
    'nome', 'nome_social', 'email', 'telefone', 'genero', 'data_nascimento',
    'conselho_profissional', 'formacao', 'registro_profissional', 'especialidade',
  ];

  const administradores = {
    async listar() {
      await atraso();
      const usuario = exigirAutenticacao();
      exigirPerfil(usuario, 'administrador');
      return [...banco.administradores].sort((a, b) => a.nome.localeCompare(b.nome)).map(semSenha);
    },
    async buscar(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      exigirPerfil(usuario, 'administrador');
      const admin = banco.administradores.find((a) => Number(a.id) === Number(id));
      if (!admin) erro('Administrador não encontrado.', 404);
      return semSenha(admin);
    },
    async atualizar(id, dados) {
      await atraso();
      const usuario = exigirAutenticacao();
      exigirPerfil(usuario, 'administrador');
      if (Number(usuario.id) !== Number(id)) erro('Você só pode editar o seu próprio cadastro.', 403);
      const admin = banco.administradores.find((a) => Number(a.id) === Number(id));
      if (!admin) erro('Administrador não encontrado.', 404);
      aplicarUpdate(admin, CAMPOS_ADMIN, dados);
      if (dados.senha) admin.senha_hash = dados.senha;
      salvar();
      return semSenha(admin);
    },
  };

  const vinculos = {
    async criar(paciente_id) {
      await atraso();
      const usuario = exigirAutenticacao();
      paciente_id = Number(paciente_id);
      if (!paciente_id) erro('Informe o código do paciente.', 400);

      const acompanhanteId = usuario.tipo === 'acompanhante' ? usuario.id : undefined;
      if (!acompanhanteId) erro('Informe o acompanhante.', 400);
      if (usuario.tipo === 'paciente') erro('Somente o cuidador ou o administrador pode criar vínculos.', 403);
      if (!banco.pacientes.some((p) => Number(p.id) === paciente_id)) {
        erro('Paciente não encontrado. Confira o código informado.', 404);
      }
      if (banco.vinculos.some((v) => Number(v.paciente_id) === paciente_id && Number(v.acompanhante_id) === Number(acompanhanteId))) {
        erro('Este vínculo já existe.', 409);
      }

      banco.vinculos.push({ id: banco.proximoId.vinculos++, paciente_id, acompanhante_id: acompanhanteId, created_at: new Date().toISOString() });
      salvar();
    },
    async remover(acompanhante_id, paciente_id) {
      await atraso();
      const usuario = exigirAutenticacao();
      acompanhante_id = Number(acompanhante_id);
      paciente_id = Number(paciente_id);
      if (!paciente_id || !acompanhante_id) erro('Informe paciente e acompanhante.', 400);

      const autorizado =
        usuario.tipo === 'administrador' ||
        (usuario.tipo === 'paciente' && Number(usuario.id) === paciente_id) ||
        (usuario.tipo === 'acompanhante' && Number(usuario.id) === acompanhante_id);
      if (!autorizado) erro('Você não pode remover este vínculo.', 403);

      const antes = banco.vinculos.length;
      banco.vinculos = banco.vinculos.filter(
        (v) => !(Number(v.paciente_id) === paciente_id && Number(v.acompanhante_id) === acompanhante_id),
      );
      if (banco.vinculos.length === antes) erro('Vínculo não encontrado.', 404);
      salvar();
    },
  };

  window.PV.db = {
    ApiError,
    auth,
    sintomas,
    registros,
    conteudos,
    contatos,
    pacientes,
    acompanhantes,
    administradores,
    vinculos,
    resetarDados,
  };
})();
