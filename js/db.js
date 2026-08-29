/**
 * "Backend" do PaliVida.
 *
 * Este arquivo reimplementa, uma a uma, as rotas de backend/src/rotas/*.js
 * do código-fonte original (mesmas validações, mesmas regras de permissão,
 * mesmos formatos de resposta). Desde a migração para o Apps Script, as
 * entidades compartilhadas (conteudos, sintomas, pacientes, acompanhantes,
 * administradores, vinculos, registros) vivem numa planilha do Google
 * Sheets, acessada via HTTP (ver "cliente Apps Script" abaixo e
 * apps-script/README.md); só `contatos` (Hospital/Família/SAC da Home)
 * continua em localStorage, por ser um dado pessoal de pouco valor
 * compartilhar entre navegadores.
 *
 * Importante: a "senha_hash" aqui é texto puro (não há bcrypt disponível
 * neste ambiente, e não faz sentido "proteger" dados que o próprio
 * visitante está gerando no próprio navegador). Não é assim que o backend
 * real funciona — ver backend/src/schema.sql e utils.js no código-fonte.
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
  // conteudos, sintomas, pacientes, acompanhantes, administradores,
  // vinculos e registros vivem numa planilha do Google Sheets, lida/
  // escrita através deste Web App — só `contatos` (Hospital/Família/SAC da
  // Home) continua em localStorage puro. Mantemos `await atraso()` nas
  // funções que chamam o Apps Script por consistência de UX com o resto do
  // arquivo (mesmo "delay" percebido em todas as telas) — a latência real
  // da requisição HTTP já soma a isso, então esse atraso artificial
  // poderia ser removido sem problema; optamos por mantê-lo para não
  // alterar a sensação de carregamento das telas nesta migração.

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

  // Desde a migração de sintomas/conteudos/pacientes/acompanhantes/
  // administradores/vinculos/registros para o Apps Script (planilha do
  // Google Sheets — ver apps-script/Code.gs e apps-script/README.md),
  // `banco` só guarda `contatos` (Hospital/Família/SAC da Home), que
  // continua em localStorage por ser um dado pessoal de pouco valor
  // compartilhar entre navegadores. `window.PALIVIDA_SEED` (js/data.js)
  // deixou de alimentar este `banco`: ele agora documenta os dados que
  // precisam ser colados manualmente nas abas da planilha na primeira
  // configuração (sintomas, conteudos e os 3 usuários de teste) — ver
  // apps-script/README.md, seção "Dados iniciais (seed)".
  function bancoInicial() {
    return {
      proximoId: { contatos: 1 },
      contatos: [],
    };
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

  // Assíncrona desde a migração de `vinculos` para a planilha (ver bloco
  // `vinculos` mais abaixo) — precisa consultar o Apps Script para saber se
  // o acompanhante está de fato vinculado ao paciente. Todo chamador foi
  // atualizado para `await`.
  async function podeVerPaciente(usuario, pacienteId) {
    if (!usuario) return false;
    pacienteId = Number(pacienteId);
    if (usuario.tipo === 'administrador') return true;
    if (usuario.tipo === 'paciente') return Number(usuario.id) === pacienteId;
    if (usuario.tipo === 'acompanhante') {
      const todosVinculos = await chamarAppsScriptGet({ acao: 'listar', tabela: 'vinculos' });
      return todosVinculos.some(
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

  // Referências bibliográficas chegam da planilha como uma única célula de
  // texto (uma referência por linha, mesmo padrão de "; " usado em
  // SinaisSintomas/SinaisAlerta na tela de Triagem — ver js/screens/
  // triagem.js). Aqui viram array para as telas iterarem direto.
  function dividirReferencias(texto) {
    return String(texto || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function normalizarConteudo(bruto) {
    return {
      ...bruto,
      SinaisSintomas: bruto?.SinaisSintomas ?? bruto?.sinaissintomas ?? '',
      SinaisAlerta: bruto?.SinaisAlerta ?? bruto?.sinaisalerta ?? '',
      Referencias: dividirReferencias(bruto?.Referencias ?? bruto?.referencias ?? ''),
    };
  }

  const auth = {
    async login(email, senha) {
      await atraso();
      if (!emailValido(email)) erro('E-mail inválido.', 400);
      if (!senha) erro('Informe a senha.', 400);

      // pacientes/acompanhantes/administradores vivem na planilha (ver
      // apps-script/Code.gs, ação 'login' de doGet) — essa ação não exige
      // token de escrita (é leitura), mas também nunca devolve senha_hash,
      // só confirma se a senha bate e já devolve o registro com `tipo`.
      const encontrado = await chamarAppsScriptGet({ acao: 'login', email, senha });

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
    // "Prontuário": histórico de sintomas registrados por cada paciente.
    // Vive na planilha (aba `registros`, ver apps-script/Code.gs) desde
    // esta migração — antes ficava em `banco.registros` (localStorage), o
    // que impedia, por exemplo, um administrador ver o histórico de um
    // paciente a partir de outro navegador/dispositivo.
    async listar() {
      await atraso();
      const usuario = exigirAutenticacao();
      const todos = await chamarAppsScriptGet({ acao: 'listar', tabela: 'registros' });
      let lista;
      if (usuario.tipo === 'administrador') {
        lista = todos;
      } else if (usuario.tipo === 'paciente') {
        lista = todos.filter((r) => Number(r.paciente_id) === Number(usuario.id));
      } else {
        const todosVinculos = await chamarAppsScriptGet({ acao: 'listar', tabela: 'vinculos' });
        const pacientesVinculados = new Set(
          todosVinculos.filter((v) => Number(v.acompanhante_id) === Number(usuario.id)).map((v) => Number(v.paciente_id)),
        );
        lista = todos.filter((r) => pacientesVinculados.has(Number(r.paciente_id)));
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
      if (!(await podeVerPaciente(usuario, paciente_id))) {
        erro('Você não pode registrar sintomas para este paciente.', 403);
      }
      const sintomasAtuais = await chamarAppsScriptGet({ acao: 'listar', tabela: 'sintomas' });
      if (!sintomasAtuais.some((s) => Number(s.id) === sintoma_id)) erro('Sintoma não encontrado.', 404);

      const registro = await chamarAppsScriptPost({
        acao: 'criar',
        tabela: 'registros',
        dados: { paciente_id, sintoma_id, intensidade, data_registro: new Date().toISOString() },
      });
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
          referencias: Array.isArray(dados.Referencias)
            ? dados.Referencias.join('\n')
            : dados.Referencias ?? dados.referencias ?? null,
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
      const referenciasEnviadas = dados.Referencias ?? dados.referencias;
      const camposEnviados = {
        titulo: dados.titulo,
        descricao: dados.descricao,
        texto: dados.texto ?? dados.descricao,
        sinaissintomas: dados.SinaisSintomas ?? dados.sinaissintomas,
        sinaisalerta: dados.SinaisAlerta ?? dados.sinaisalerta,
        referencias: Array.isArray(referenciasEnviadas) ? referenciasEnviadas.join('\n') : referenciasEnviadas,
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

  // pacientes/acompanhantes/administradores/vinculos vivem na planilha (ver
  // apps-script/Code.gs) desde esta migração — antes ficavam em `banco`
  // (localStorage). As validações de permissão continuam aqui no site,
  // antes de qualquer chamada ao Apps Script, exatamente como já acontecia
  // para `sintomas`/`conteudos`.

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
      const registro = { email, senha_hash: dados.senha, created_at: new Date().toISOString() };
      CAMPOS_PACIENTE.forEach((c) => { if (c !== 'email') registro[c] = dados[c] ?? null; });

      // criarLinha('pacientes', ...) valida e-mail único e senha mínima de
      // novo no Apps Script (validarCadastro()) — dupla checagem, já que
      // esta é uma ação de escrita pública (sem token), diferente das
      // demais chamadas deste arquivo.
      const criado = await chamarAppsScriptPost({ acao: 'criar', tabela: 'pacientes', dados: registro });
      return criado;
    },
    async buscar(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!(await podeVerPaciente(usuario, id))) erro('Você não tem permissão para ver este paciente.', 403);
      const paciente = await chamarAppsScriptGet({ acao: 'buscar', tabela: 'pacientes', id });
      return semSenha(paciente);
    },
    async atualizar(id, dados) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!(await podeVerPaciente(usuario, id))) erro('Você não tem permissão para editar este paciente.', 403);
      const camposEnviados = { id };
      CAMPOS_PACIENTE.forEach((c) => { if (dados[c] !== undefined) camposEnviados[c] = dados[c]; });
      if (dados.senha) camposEnviados.senha_hash = dados.senha;
      const atualizado = await chamarAppsScriptPost({ acao: 'atualizar', tabela: 'pacientes', dados: camposEnviados });
      if (!atualizado) erro('Paciente não encontrado.', 404);
      return semSenha(atualizado);
    },
    async acompanhantes(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!(await podeVerPaciente(usuario, id))) erro('Você não tem permissão para ver estes vínculos.', 403);
      const [todosVinculos, todosAcompanhantes] = await Promise.all([
        chamarAppsScriptGet({ acao: 'listar', tabela: 'vinculos' }),
        chamarAppsScriptGet({ acao: 'listar', tabela: 'acompanhantes' }),
      ]);
      const idsVinculados = todosVinculos
        .filter((v) => Number(v.paciente_id) === Number(id))
        .map((v) => Number(v.acompanhante_id));
      const lista = todosAcompanhantes
        .filter((a) => idsVinculados.includes(Number(a.id)))
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
      const registro = { email, senha_hash: dados.senha, created_at: new Date().toISOString() };
      CAMPOS_ACOMPANHANTE.forEach((c) => { if (c !== 'email') registro[c] = dados[c] ?? null; });

      const criado = await chamarAppsScriptPost({ acao: 'criar', tabela: 'acompanhantes', dados: registro });
      return criado;
    },
    async buscar(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!ehODono(usuario, id)) erro('Você não tem permissão para ver este cadastro.', 403);
      const acompanhante = await chamarAppsScriptGet({ acao: 'buscar', tabela: 'acompanhantes', id });
      return semSenha(acompanhante);
    },
    async atualizar(id, dados) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!ehODono(usuario, id)) erro('Você não tem permissão para editar este cadastro.', 403);
      const camposEnviados = { id };
      CAMPOS_ACOMPANHANTE.forEach((c) => { if (dados[c] !== undefined) camposEnviados[c] = dados[c]; });
      if (dados.senha) camposEnviados.senha_hash = dados.senha;
      const atualizado = await chamarAppsScriptPost({ acao: 'atualizar', tabela: 'acompanhantes', dados: camposEnviados });
      if (!atualizado) erro('Acompanhante não encontrado.', 404);
      return semSenha(atualizado);
    },
    async pacientes(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      if (!ehODono(usuario, id)) erro('Você não tem permissão para ver estes vínculos.', 403);
      const [todosVinculos, todosPacientes] = await Promise.all([
        chamarAppsScriptGet({ acao: 'listar', tabela: 'vinculos' }),
        chamarAppsScriptGet({ acao: 'listar', tabela: 'pacientes' }),
      ]);
      const idsVinculados = todosVinculos
        .filter((v) => Number(v.acompanhante_id) === Number(id))
        .map((v) => Number(v.paciente_id));
      const lista = todosPacientes
        .filter((p) => idsVinculados.includes(Number(p.id)))
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
      const lista = await chamarAppsScriptGet({ acao: 'listar', tabela: 'administradores' });
      return [...lista].sort((a, b) => a.nome.localeCompare(b.nome)).map(semSenha);
    },
    async buscar(id) {
      await atraso();
      const usuario = exigirAutenticacao();
      exigirPerfil(usuario, 'administrador');
      const admin = await chamarAppsScriptGet({ acao: 'buscar', tabela: 'administradores', id });
      return semSenha(admin);
    },
    async atualizar(id, dados) {
      await atraso();
      const usuario = exigirAutenticacao();
      exigirPerfil(usuario, 'administrador');
      if (Number(usuario.id) !== Number(id)) erro('Você só pode editar o seu próprio cadastro.', 403);
      const camposEnviados = { id };
      CAMPOS_ADMIN.forEach((c) => { if (dados[c] !== undefined) camposEnviados[c] = dados[c]; });
      if (dados.senha) camposEnviados.senha_hash = dados.senha;
      const atualizado = await chamarAppsScriptPost({ acao: 'atualizar', tabela: 'administradores', dados: camposEnviados });
      if (!atualizado) erro('Administrador não encontrado.', 404);
      return semSenha(atualizado);
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

      const [todosPacientes, todosVinculos] = await Promise.all([
        chamarAppsScriptGet({ acao: 'listar', tabela: 'pacientes' }),
        chamarAppsScriptGet({ acao: 'listar', tabela: 'vinculos' }),
      ]);
      if (!todosPacientes.some((p) => Number(p.id) === paciente_id)) {
        erro('Paciente não encontrado. Confira o código informado.', 404);
      }
      if (todosVinculos.some((v) => Number(v.paciente_id) === paciente_id && Number(v.acompanhante_id) === Number(acompanhanteId))) {
        erro('Este vínculo já existe.', 409);
      }

      await chamarAppsScriptPost({
        acao: 'criar',
        tabela: 'vinculos',
        dados: { paciente_id, acompanhante_id: acompanhanteId, created_at: new Date().toISOString() },
      });
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

      const todosVinculos = await chamarAppsScriptGet({ acao: 'listar', tabela: 'vinculos' });
      const alvo = todosVinculos.find(
        (v) => Number(v.paciente_id) === paciente_id && Number(v.acompanhante_id) === acompanhante_id,
      );
      if (!alvo) erro('Vínculo não encontrado.', 404);
      await chamarAppsScriptPost({ acao: 'remover', tabela: 'vinculos', dados: { id: alvo.id } });
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
