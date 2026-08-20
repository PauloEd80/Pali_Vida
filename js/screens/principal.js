/**
 * Home / Busca / Dashboard — porta de screens/HomeScreen.tsx,
 * screens/BuscaScreen.tsx e screens/DashboardAdminScreen.tsx
 * (+ components/GraficoBarras.tsx).
 */
window.PV = window.PV || {};
window.PV.screens = window.PV.screens || {};

(function () {
  const { escaparHtml, aviso, carregando, spinner, svgLupa } = PV.ui;

  const TIPOS_CONTATO_HOME = [
    { id: 'hospital', rotulo: 'Hospital' },
    { id: 'familia', rotulo: 'Família' },
    { id: 'sac', rotulo: 'SAC' },
  ];

  /* ================================================================ Home === */
  async function home(main, ctx) {
    // Tela pensada para caber inteira na viewport, sem precisar rolar.
    main.classList.add('pv-sem-scroll');
    const alerta = ctx.query.alerta || 'padrao';
    const corFundo = {
      padrao: 'var(--alerta-padrao)', verde: 'var(--alerta-verde)',
      amarelo: 'var(--alerta-amarelo)', vermelho: 'var(--alerta-vermelho)',
    }[alerta] || 'var(--alerta-padrao)';

    main.innerHTML = `
      <div class="tela-home" style="background:${corFundo}">
        <div class="corpo">
          <h1 class="titulo" id="home-saudacao">Bem vindo!</h1>

          <button class="botao-prontuario" id="btn-prontuario" type="button">Prontuário Eletrônico</button>
          <button class="botao-duvidas" id="btn-duvidas" type="button">Entendendo os sintomas</button>
          <button class="botao-registrar" id="btn-registrar" type="button">Registrar sintomas de hoje</button>
          <button class="botao-registrar" id="btn-triagem" type="button" style="margin-top:12px">Triagem de sintomas</button>

          <div class="contatos">
            <div class="contatos-titulo">Contatos:</div>
            <div class="contatos-botoes">
              ${TIPOS_CONTATO_HOME.map((c) => `<button class="contato-botao" type="button" data-contato="${c.id}">${escaparHtml(c.rotulo)}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>`;

    main.querySelector('#btn-prontuario').addEventListener('click', () => PV.router.navegar('/perfil'));
    main.querySelector('#btn-duvidas').addEventListener('click', () => PV.router.navegar('/busca'));
    main.querySelector('#btn-registrar').addEventListener('click', () => PV.router.navegar('/menu-sintomas'));
    main.querySelector('#btn-triagem').addEventListener('click', () => PV.router.navegar('/triagem'));
    main.querySelectorAll('[data-contato]').forEach((btn) => {
      btn.addEventListener('click', () => PV.router.navegar(`/contato/${btn.dataset.contato}`));
    });

    try {
      const dados = ctx.usuario.tipo === 'acompanhante'
        ? await PV.db.acompanhantes.buscar(ctx.usuario.id)
        : await PV.db.pacientes.buscar(ctx.usuario.id);
      const nome = dados.nome_social || dados.nome || dados.nome_completo;
      const alvo = main.querySelector('#home-saudacao');
      if (nome && alvo) alvo.textContent = `Bem vindo, ${nome}!`;
    } catch {
      /* sem nome carregado a tela ainda funciona, com a saudação genérica */
    }
  }

  /* ============================================================= Contato === */
  // Cada botão da Home ("Hospital", "Família", "SAC") abre esta mesma tela,
  // parametrizada pelo tipo (ctx.sub). Ela chega preenchida com um exemplo
  // genérico (PV.db.contatos.buscar) que o usuário edita e salva — os dados
  // ficam por conta de cada paciente/cuidador (ver comentário em db.js).
  async function contato(main, ctx) {
    const tipo = ctx.sub;
    const rotulo = (TIPOS_CONTATO_HOME.find((t) => t.id === tipo) || {}).rotulo;
    if (!rotulo) { PV.router.navegar('/home'); return; }

    main.innerHTML = `<div class="pv-carregando" style="min-height:200px">${spinner()}</div>`;

    let dados;
    try {
      dados = await PV.db.contatos.buscar(tipo);
    } catch (e) {
      main.innerHTML = `<div class="tela-contato">${aviso({ tipo: 'erro', texto: e.message || 'Não foi possível carregar este contato.' })}</div>`;
      return;
    }

    function montar() {
      main.innerHTML = `
        <div class="tela-contato">
          <h1 class="titulo">Contato — ${escaparHtml(rotulo)}</h1>
          <p class="subtitulo">${dados.preenchido
            ? 'Edite os dados abaixo sempre que precisar.'
            : 'Preenchemos um exemplo para você — edite com os dados reais e salve.'}</p>

          <div class="pv-card">
            <label class="pv-campo-label" for="ct-nome">Nome</label>
            <input class="pv-campo-input" id="ct-nome" type="text" value="${escaparHtml(dados.nome)}">

            <label class="pv-campo-label" for="ct-telefone">Telefone</label>
            <input class="pv-campo-input" id="ct-telefone" type="tel" value="${escaparHtml(dados.telefone)}">

            <label class="pv-campo-label" for="ct-observacao">${tipo === 'familia' ? 'Parentesco' : tipo === 'sac' ? 'Horário de atendimento' : 'Endereço / observação'}</label>
            <input class="pv-campo-input" id="ct-observacao" type="text" value="${escaparHtml(dados.observacao)}">

            <div id="ct-aviso"></div>
            <div class="pv-contato-acoes">
              <a class="pv-botao-secundario" id="ct-ligar" href="tel:${escaparHtml(String(dados.telefone).replace(/[^0-9+]/g, ''))}">Ligar agora</a>
              <button type="button" class="pv-botao-primario" id="ct-salvar">Salvar</button>
            </div>
          </div>
        </div>`;

      const avisoEl = main.querySelector('#ct-aviso');
      const telefoneEl = main.querySelector('#ct-telefone');
      const ligarEl = main.querySelector('#ct-ligar');
      telefoneEl.addEventListener('input', () => {
        ligarEl.href = `tel:${telefoneEl.value.replace(/[^0-9+]/g, '')}`;
      });

      main.querySelector('#ct-salvar').addEventListener('click', async () => {
        const botao = main.querySelector('#ct-salvar');
        const novoForm = {
          nome: main.querySelector('#ct-nome').value.trim(),
          telefone: main.querySelector('#ct-telefone').value.trim(),
          observacao: main.querySelector('#ct-observacao').value.trim(),
        };
        botao.disabled = true;
        try {
          dados = await PV.db.contatos.salvar(tipo, novoForm);
          montar();
          main.querySelector('#ct-aviso').innerHTML = aviso({ tipo: 'sucesso', texto: 'Contato salvo!' });
        } catch (e) {
          botao.disabled = false;
          avisoEl.innerHTML = aviso({ tipo: 'erro', texto: e.message || 'Erro ao salvar.' });
        }
      });
    }

    montar();
  }

  /* =============================================================== Busca === */
  const FORM_CONTEUDO_VAZIO = { id: null, titulo: '', descricao: '', SinaisSintomas: '', SinaisAlerta: '' };

  function formatarDataConteudo(valor) {
    if (!valor) return '';
    const [ano, mes, dia] = String(valor).split('T')[0].split('-');
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : valor;
  }

  function cardConteudoHtml(c, ehAdmin) {
    return `
      <div class="pv-card-conteudo" data-id="${c.id}">
        <div class="card-titulo">${escaparHtml(c.titulo)}</div>
        <div class="divisor"></div>
        <div class="card-descricao">${escaparHtml(c.descricao)}</div>
        <div class="card-rodape">
          <button class="botao-ler" type="button" data-ler="${c.id}">Ler mais <img src="assets/img/seta.png" alt=""></button>
          <span class="data">${escaparHtml(formatarDataConteudo(c.data_post))}</span>
        </div>
        ${ehAdmin ? `
          <div class="acoes-admin">
            <button class="acao-editar" type="button" data-editar="${c.id}">Editar</button>
            <button class="acao-excluir" type="button" data-excluir="${c.id}">Excluir</button>
          </div>` : ''}
      </div>`;
  }

  async function busca(main, ctx) {
    const ehAdmin = ctx.usuario.tipo === 'administrador';
    let lista = [];
    let textoBusca = '';
    let mensagem = null;
    let form = { ...FORM_CONTEUDO_VAZIO };

    main.innerHTML = `
      <div class="tela-busca">
        <div class="busca-container">
          <input class="busca-input" id="busca-input" type="text" placeholder="Buscar por tema...">
          <button class="icone-lupa" id="btn-recarregar" type="button" aria-label="Atualizar lista">${svgLupa()}</button>
        </div>
        ${ehAdmin ? `<button class="botao-novo" id="btn-novo-conteudo" type="button">+ Novo Conteúdo</button>` : ''}
        <div class="aviso-wrap" id="busca-aviso"></div>
        <div id="busca-lista">${carregando()}</div>
      </div>

      <div class="pv-modal-overlay" id="modal-conteudo" hidden>
        <div class="pv-modal">
          <label class="modal-label">Título</label>
          <input class="modal-input" id="mc-titulo" type="text">
          <label class="modal-label">Descrição</label>
          <textarea class="modal-input" id="mc-descricao"></textarea>
          <label class="modal-label">Sinais e Sintomas</label>
          <textarea class="modal-input" id="mc-sinais-sintomas"></textarea>
          <label class="modal-label">Sinais de Alerta</label>
          <textarea class="modal-input" id="mc-sinais-alerta"></textarea>
          <div class="modal-botoes">
            <button class="botao-modal botao-cancelar" id="mc-cancelar" type="button">Cancelar</button>
            <button class="botao-modal botao-salvar" id="mc-salvar" type="button">Salvar</button>
          </div>
        </div>
      </div>`;

    const listaEl = main.querySelector('#busca-lista');
    const avisoEl = main.querySelector('#busca-aviso');
    const modalEl = main.querySelector('#modal-conteudo');

    function renderLista() {
      const filtrados = lista.filter((c) => (c.titulo || '').toLowerCase().includes(textoBusca.toLowerCase()));
      if (!filtrados.length) {
        listaEl.innerHTML = `<p class="lista-vazia">Nenhum conteúdo encontrado.</p>`;
      } else {
        listaEl.innerHTML = filtrados.map((c) => cardConteudoHtml(c, ehAdmin)).join('');
      }
      listaEl.querySelectorAll('[data-ler]').forEach((b) => b.addEventListener('click', () => PV.router.navegar('/conteudo/' + b.dataset.ler)));
      if (ehAdmin) {
        listaEl.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => abrirModal(lista.find((c) => String(c.id) === b.dataset.editar))));
        listaEl.querySelectorAll('[data-excluir]').forEach((b) => b.addEventListener('click', () => excluir(b.dataset.excluir)));
      }
    }

    async function carregar() {
      listaEl.innerHTML = carregando();
      try {
        lista = await PV.db.conteudos.listar();
        renderLista();
      } catch (e) {
        mensagem = { tipo: 'erro', texto: e.message || 'Erro ao carregar.' };
        avisoEl.innerHTML = aviso(mensagem);
        listaEl.innerHTML = '';
      }
    }

    function abrirModal(conteudo) {
      form = conteudo
        ? { id: conteudo.id, titulo: conteudo.titulo || '', descricao: conteudo.descricao || '', SinaisSintomas: conteudo.SinaisSintomas || '', SinaisAlerta: conteudo.SinaisAlerta || '' }
        : { ...FORM_CONTEUDO_VAZIO };
      main.querySelector('#mc-titulo').value = form.titulo;
      main.querySelector('#mc-descricao').value = form.descricao;
      main.querySelector('#mc-sinais-sintomas').value = form.SinaisSintomas;
      main.querySelector('#mc-sinais-alerta').value = form.SinaisAlerta;
      modalEl.hidden = false;
    }

    async function salvar() {
      const botao = main.querySelector('#mc-salvar');
      botao.disabled = true;
      botao.innerHTML = spinner(true);
      const dados = {
        titulo: main.querySelector('#mc-titulo').value,
        descricao: main.querySelector('#mc-descricao').value,
        texto: main.querySelector('#mc-descricao').value,
        SinaisSintomas: main.querySelector('#mc-sinais-sintomas').value,
        SinaisAlerta: main.querySelector('#mc-sinais-alerta').value,
        data_post: new Date().toISOString().split('T')[0],
      };
      try {
        if (form.id) await PV.db.conteudos.atualizar(form.id, dados);
        else await PV.db.conteudos.criar(dados);
        modalEl.hidden = true;
        mensagem = { tipo: 'sucesso', texto: 'Conteúdo salvo.' };
        avisoEl.innerHTML = aviso(mensagem);
        await carregar();
      } catch (e) {
        mensagem = { tipo: 'erro', texto: e.message || 'Erro ao salvar.' };
        avisoEl.innerHTML = aviso(mensagem);
      } finally {
        botao.disabled = false;
        botao.textContent = 'Salvar';
      }
    }

    async function excluir(id) {
      try {
        await PV.db.conteudos.remover(id);
        mensagem = { tipo: 'sucesso', texto: 'Conteúdo excluído.' };
        avisoEl.innerHTML = aviso(mensagem);
        await carregar();
      } catch (e) {
        mensagem = { tipo: 'erro', texto: e.message || 'Erro ao excluir.' };
        avisoEl.innerHTML = aviso(mensagem);
      }
    }

    main.querySelector('#busca-input').addEventListener('input', (e) => { textoBusca = e.target.value; renderLista(); });
    main.querySelector('#btn-recarregar').addEventListener('click', carregar);
    if (ehAdmin) main.querySelector('#btn-novo-conteudo').addEventListener('click', () => abrirModal());
    main.querySelector('#mc-cancelar').addEventListener('click', () => { modalEl.hidden = true; });
    main.querySelector('#mc-salvar').addEventListener('click', salvar);

    await carregar();
  }

  /* ======================================================= DashboardAdmin === */
  const PALETA_GRAFICO = ['#E4572E', '#F3A712', '#A8C686', '#669BBC', '#29335C', '#8E6C88', '#FF6B6B', '#4ECDC4', '#C7F464', '#556270'];
  const corPorIndice = (i) => PALETA_GRAFICO[i % PALETA_GRAFICO.length];

  function calcularEstatisticas(registros, sintomas) {
    const nomes = new Map(sintomas.map((s) => [s.id, s.nome_sintoma]));
    const porSintoma = new Map();
    registros.forEach((r) => {
      const id = Number(r.sintoma_id);
      if (!porSintoma.has(id)) porSintoma.set(id, []);
      porSintoma.get(id).push(Number(r.intensidade));
    });
    const ids = [...porSintoma.keys()];
    const barra = (id, valor, i) => ({ label: nomes.get(id) ?? `ID ${id}`, value: Number(valor), color: corPorIndice(i) });
    const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
    const variancia = (v) => { const m = media(v); return v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length; };
    const mediana = (v) => { const o = [...v].sort((a, b) => a - b); const meio = Math.floor(o.length / 2); return o.length % 2 !== 0 ? o[meio] : (o[meio - 1] + o[meio]) / 2; };

    return {
      media: ids.map((id, i) => barra(id, +media(porSintoma.get(id)).toFixed(1), i)),
      frequencia: ids.map((id, i) => barra(id, porSintoma.get(id).length, i)),
      mediana: ids.map((id, i) => barra(id, mediana(porSintoma.get(id)), i)),
      variancia: ids.map((id, i) => barra(id, +variancia(porSintoma.get(id)).toFixed(2), i)),
      desvioPadrao: ids.map((id, i) => barra(id, +Math.sqrt(variancia(porSintoma.get(id))).toFixed(2), i)),
    };
  }

  function cardGraficoHtml(titulo, dados) {
    const maximo = Math.max(...dados.map((d) => d.value), 1);
    return `
      <div class="pv-card-grafico">
        <div class="titulo-grafico">${escaparHtml(titulo)}</div>
        <div class="pv-grafico-barras">
          ${dados.map((d) => `
            <div class="pv-grafico-coluna-wrap">
              <div class="pv-grafico-coluna" style="height:${Math.max((d.value / maximo) * 200, d.value > 0 ? 4 : 0)}px;background:${d.color}"></div>
            </div>`).join('')}
        </div>
        <div class="pv-legenda">
          ${dados.map((d) => `
            <div class="pv-legenda-item">
              <span class="pv-legenda-cor" style="background:${d.color}"></span>
              <span>${escaparHtml(d.label)}: <b>${d.value}</b></span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function gerenciadorSintomasHtml() {
    return `
      <div class="pv-gerenciador" id="gerenciador">
        <button class="botao-expandir" id="ger-toggle" type="button">Gerenciar sintomas</button>
        <div class="painel pv-oculto" id="ger-painel">
          <div class="subtitulo">Lista de sintomas</div>
          <div id="ger-lista"></div>
          <button class="ver-mais pv-oculto" id="ger-vermais" type="button">Ver mais</button>
          <div class="subtitulo">Adicionar novo sintoma</div>
          <input class="input-sintoma" id="ger-novo" type="text" placeholder="Nome do sintoma">
          <button class="botao-adicionar" id="ger-adicionar" type="button">Adicionar sintoma</button>
        </div>
      </div>`;
  }

  function ligarGerenciadorSintomas(main, onAtualizar) {
    let aberto = false;
    let verTodos = false;
    let listaSintomas = [];

    const painel = main.querySelector('#ger-painel');
    const listaEl = main.querySelector('#ger-lista');
    const btnVerMais = main.querySelector('#ger-vermais');

    async function carregar() {
      try { listaSintomas = await PV.db.sintomas.listar(); } catch { listaSintomas = []; }
      render();
    }

    function render() {
      const visiveis = verTodos ? listaSintomas : listaSintomas.slice(0, 3);
      listaEl.innerHTML = visiveis.map((s) => `
        <div class="item-sintoma">
          <span class="nome-sintoma">${escaparHtml(s.nome_sintoma)}</span>
          <button class="botao-remover" type="button" data-remover="${s.id}">Remover</button>
        </div>`).join('');
      listaEl.querySelectorAll('[data-remover]').forEach((b) => b.addEventListener('click', async () => {
        await PV.db.sintomas.remover(b.dataset.remover);
        await carregar();
        onAtualizar();
      }));
      btnVerMais.classList.toggle('pv-oculto', listaSintomas.length <= 3);
      btnVerMais.textContent = verTodos ? 'Ver menos' : 'Ver mais';
    }

    main.querySelector('#ger-toggle').addEventListener('click', () => {
      aberto = !aberto;
      main.querySelector('#ger-toggle').textContent = aberto ? 'Fechar gerenciamento de sintomas' : 'Gerenciar sintomas';
      painel.classList.toggle('pv-oculto', !aberto);
      if (aberto) carregar();
    });
    btnVerMais.addEventListener('click', () => { verTodos = !verTodos; render(); });
    main.querySelector('#ger-adicionar').addEventListener('click', async () => {
      const campo = main.querySelector('#ger-novo');
      if (!campo.value.trim()) return;
      await PV.db.sintomas.criar(campo.value.trim());
      campo.value = '';
      await carregar();
      onAtualizar();
    });
  }

  async function dashboardAdmin(main, ctx) {
    main.innerHTML = carregando('Carregando...');

    let registros = [];
    let sintomas = [];
    let erro = null;
    try {
      [registros, sintomas] = await Promise.all([PV.db.registros.listar(), PV.db.sintomas.listar()]);
    } catch (e) {
      erro = e.message || 'Não foi possível carregar os dados.';
    }

    const estat = calcularEstatisticas(registros, sintomas);
    const temDados = registros.length > 0;

    main.innerHTML = `
      <div class="tela-dashboard">
        <h1 class="titulo">Dashboard</h1>
        ${erro ? `<p class="erro-texto">${escaparHtml(erro)}</p>` : ''}
        ${temDados ? `
          ${cardGraficoHtml('Média de intensidade', estat.media)}
          ${cardGraficoHtml('Frequência de registros', estat.frequencia)}
          ${cardGraficoHtml('Mediana da intensidade', estat.mediana)}
          ${cardGraficoHtml('Variância da intensidade', estat.variancia)}
          ${cardGraficoHtml('Desvio padrão da intensidade', estat.desvioPadrao)}
        ` : `<p class="vazio">Ainda não há registros de sintomas.</p>`}
        ${gerenciadorSintomasHtml()}
      </div>`;

    ligarGerenciadorSintomas(main, () => PV.router.renderizar());
  }

  PV.screens.home = home;
  PV.screens.contato = contato;
  PV.screens.busca = busca;
  PV.screens.dashboardAdmin = dashboardAdmin;
})();
