/**
 * Fluxo de sintomas — porta de screens/MenuSintomasScreen.tsx,
 * components/ListaSintomas.tsx, components/ModalIntensidade.tsx,
 * screens/ConteudoDetalheScreen.tsx, screens/DefinicaoSintomasScreen.tsx
 * e screens/sinais.tsx + screens/TelaSinal.tsx.
 */
window.PV = window.PV || {};
window.PV.screens = window.PV.screens || {};

(function () {
  const { escaparHtml, header, footer, aviso, carregando, spinner, ligarNavegacaoInferior } = PV.ui;

  /* ===================================================== ListaSintomas === */
  function gradeVaziaHtml(msg) {
    return `<p class="lista-vazia" style="text-align:center;color:var(--marrom);margin-top:20px">${escaparHtml(msg)}</p>`;
  }

  async function montarListaSintomas(container, onSelecionar) {
    container.innerHTML = carregando();
    let lista = [];
    let erro = null;
    try {
      lista = await PV.db.sintomas.listar();
    } catch (e) {
      erro = e.message || 'Erro ao carregar sintomas.';
    }

    container.innerHTML = `
      <div class="pv-lista-sintomas">
        <div class="pv-grade-sintomas">
          ${lista.length ? lista.map((s) => `<button type="button" class="pv-card-sintoma" data-sintoma="${s.id}">${escaparHtml(s.nome_sintoma)}</button>`).join('') : gradeVaziaHtml(erro || 'Não há sintomas cadastrados.')}
        </div>
        <button type="button" class="pv-botao-sem-sintoma" id="btn-sem-sintoma">Não tive nenhum desses sintomas</button>
      </div>`;

    container.querySelectorAll('[data-sintoma]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = lista.find((x) => String(x.id) === btn.dataset.sintoma);
        onSelecionar(s);
      });
    });
    container.querySelector('#btn-sem-sintoma').addEventListener('click', () => PV.router.navegar('/sinal/verde'));
  }

  /* =================================================== ModalIntensidade === */
  function montarModalIntensidade(root, ctx) {
    const overlay = document.createElement('div');
    overlay.className = 'pv-modal-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="pv-modal-intensidade">
        <div class="titulo">Qual é a intensidade do sintoma?</div>
        <div class="sintoma" id="mi-sintoma"></div>
        <div id="mi-aviso"></div>
        <div class="pv-escala" id="mi-escala">
          ${Array.from({ length: 11 }, (_, v) => `<button type="button" class="pv-botao-escala" data-valor="${v}">${v}</button>`).join('')}
        </div>
        <div class="acoes">
          <button type="button" class="botao cancelar" id="mi-cancelar">Cancelar</button>
          <button type="button" class="botao confirmar" id="mi-confirmar">Confirmar</button>
        </div>
      </div>`;
    root.appendChild(overlay);

    let sintomaAtual = null;
    let intensidade = null;

    function fechar() {
      overlay.hidden = true;
      intensidade = null;
      overlay.querySelector('#mi-aviso').innerHTML = '';
      overlay.querySelectorAll('.pv-botao-escala').forEach((b) => b.classList.remove('selecionado'));
    }

    overlay.querySelectorAll('.pv-botao-escala').forEach((btn) => {
      btn.addEventListener('click', () => {
        intensidade = Number(btn.dataset.valor);
        overlay.querySelectorAll('.pv-botao-escala').forEach((b) => b.classList.toggle('selecionado', b === btn));
      });
    });
    overlay.querySelector('#mi-cancelar').addEventListener('click', fechar);
    overlay.querySelector('#mi-confirmar').addEventListener('click', async () => {
      const avisoEl = overlay.querySelector('#mi-aviso');
      if (intensidade === null) {
        avisoEl.innerHTML = aviso({ tipo: 'erro', texto: 'Selecione uma intensidade antes de confirmar.' });
        return;
      }
      const botao = overlay.querySelector('#mi-confirmar');
      botao.disabled = true;
      botao.innerHTML = spinner(true);
      try {
        await PV.db.registros.criar({ paciente_id: ctx.usuario.id, sintoma_id: sintomaAtual.id, intensidade });
        PV.session.marcarSintomaRegistradoHoje();
        fechar();
        PV.router.navegar('/home');
      } catch (e) {
        avisoEl.innerHTML = aviso({ tipo: 'erro', texto: e.message || 'Não foi possível registrar o sintoma.' });
        botao.disabled = false;
        botao.textContent = 'Confirmar';
      }
    });

    return {
      abrir(sintoma) {
        sintomaAtual = sintoma;
        overlay.querySelector('#mi-sintoma').textContent = sintoma ? sintoma.nome_sintoma : '';
        overlay.hidden = false;
      },
    };
  }

  /* ======================================================= MenuSintomas === */
  async function menuSintomas(main, ctx) {
    main.innerHTML = `
      ${header()}
      <div class="tela-menu-sintomas">
        <h1 class="titulo">Você apresentou algum desses sintomas hoje?</h1>
        <div id="lista-sintomas-slot"></div>
      </div>
      ${footer(ctx.usuario.tipo)}`;

    ligarNavegacaoInferior(main);
    const modal = montarModalIntensidade(main, ctx);
    await montarListaSintomas(main.querySelector('#lista-sintomas-slot'), (sintoma) => modal.abrir(sintoma));
  }

  /* ==================================================== ConteudoDetalhe === */
  async function conteudoDetalhe(main, ctx) {
    main.innerHTML = `<div class="pv-carregando" style="min-height:100vh;background:var(--areia-clara)">${PV.ui.spinner()}<span>Carregando informações...</span></div>`;

    let conteudo = null;
    let erro = null;
    try {
      conteudo = await PV.db.conteudos.buscar(ctx.sub);
    } catch (e) {
      erro = e.message || 'Erro ao carregar conteúdo.';
    }

    if (!conteudo) {
      main.innerHTML = `<div class="pv-carregando" style="min-height:100vh;background:var(--areia-clara)"><span>${escaparHtml(erro || 'Conteúdo não encontrado.')}</span></div>`;
      return;
    }

    main.innerHTML = `
      ${header()}
      <div class="tela-conteudo-detalhe">
        <div class="cabecalho">
          <h1 class="titulo-principal">${escaparHtml(conteudo.titulo)}</h1>
          <div class="barra-titulo"></div>
        </div>

        <div class="card">
          <div class="label-secao">O que é?</div>
          <p class="texto-corpo">${escaparHtml(conteudo.descricao || conteudo.texto)}</p>
        </div>

        <div class="card borda-laranja">
          <div class="label-secao" style="color:var(--laranja-escuro)">Sinais e Sintomas</div>
          <p class="texto-corpo">${escaparHtml(conteudo.SinaisSintomas)}</p>
          <button type="button" class="botao-laranja" id="btn-amarelo">Sinto um desses sinais</button>
        </div>

        <div class="card borda-vermelha">
          <div class="label-secao" style="color:var(--perigo-claro)">Sinais de Alerta</div>
          <p class="texto-corpo">${escaparHtml(conteudo.SinaisAlerta)}</p>
          <button type="button" class="botao-vermelho" id="btn-vermelho">Sinto um desses sinais de alerta</button>
        </div>

        <button type="button" class="link-leitura-facil" id="btn-leitura-facil">Ver em modo de leitura fácil</button>
        <button type="button" class="botao-voltar" id="btn-voltar">Voltar ao início</button>
      </div>`;

    main.querySelector('#btn-amarelo').addEventListener('click', () => PV.router.navegar('/sinal/amarelo'));
    main.querySelector('#btn-vermelho').addEventListener('click', () => PV.router.navegar('/sinal/vermelho'));
    main.querySelector('#btn-voltar').addEventListener('click', () => PV.router.navegar('/home'));
    // Link extra: a tela DefinicaoSintomas existe no código-fonte original mas não tinha
    // nenhum botão que levasse até ela — ver README do site.
    main.querySelector('#btn-leitura-facil').addEventListener('click', () => PV.router.navegar('/definicao/' + conteudo.id));
  }

  /* ================================================== DefinicaoSintomas === */
  async function definicaoSintomas(main, ctx) {
    main.innerHTML = `<div class="pv-carregando" style="min-height:100vh;background:var(--areia)">${PV.ui.spinner()}<span>Carregando...</span></div>`;

    let conteudo = null;
    try {
      if (ctx.sub) conteudo = await PV.db.conteudos.buscar(ctx.sub);
    } catch {
      conteudo = null;
    }

    if (!conteudo) {
      main.innerHTML = `<div class="pv-carregando" style="min-height:100vh;background:var(--areia)"><span>Conteúdo não encontrado.</span></div>`;
      return;
    }

    main.innerHTML = `
      <div class="tela-definicao">
        ${header()}
        <div class="conteudo">
          <h1 class="titulo">${escaparHtml(conteudo.titulo)}</h1>
          <div class="sublinhado"></div>

          <div class="titulo-definicao">Definição: <span class="peso-normal">${escaparHtml(conteudo.descricao || conteudo.texto)}</span></div>

          <div class="secao">
            <div class="titulo-secao">Sinais e Sintomas: </div>
            <div class="texto-secao">${escaparHtml(conteudo.SinaisSintomas)}</div>
          </div>

          <button type="button" class="botao-laranja" id="btn-amarelo">Sinto um ou mais
dos sinais e sintomas</button>

          <div class="secao">
            <div class="titulo-secao">Sinais de Alerta: </div>
            <div class="texto-secao">${escaparHtml(conteudo.SinaisAlerta)}</div>
          </div>

          <button type="button" class="botao-vermelho" id="btn-vermelho">Sinto um ou mais
dos sinais de alerta</button>
        </div>
        ${footer(ctx.usuario.tipo)}
      </div>`;

    main.querySelector('#btn-amarelo').addEventListener('click', () => PV.router.navegar('/sinal/amarelo'));
    main.querySelector('#btn-vermelho').addEventListener('click', () => PV.router.navegar('/sinal/vermelho'));
    ligarNavegacaoInferior(main);
  }

  /* ============================================================= Sinal === */
  const SINAIS = {
    verde: {
      fundo: 'var(--verde)', corTitulo: 'var(--verde)',
      aviso: 'Tudo certo por hoje', titulo: 'Ótima notícia! Nenhum sintoma hoje',
      descricao: 'Ficamos felizes em saber que você está sem sintomas no momento. Em cuidados paliativos, cada dia de estabilidade é uma vitória. Continue seguindo as orientações da equipe de saúde e mantendo seus cuidados diários. Qualquer alteração deverá buscar atendimento médico.',
    },
    amarelo: {
      fundo: 'var(--amarelo)', corTitulo: 'var(--amarelo)',
      aviso: 'Atenção', titulo: 'Alguns sintomas exigem cuidado',
      descricao: 'Observamos sinais que merecem atenção. É importante monitorar qualquer mudança e comunicar a equipe de saúde. Comunique seu médico.',
    },
    vermelho: {
      fundo: 'var(--vermelho)', corTitulo: 'var(--vermelho)',
      aviso: 'Atenção', titulo: 'Sintomas podem indicar agravamento',
      descricao: 'Os sinais relatados indicam que seu estado de saúde pode estar se agravando. Procure atendimento médico!',
    },
  };

  async function sinal(main, ctx) {
    const conteudo = SINAIS[ctx.sub] || SINAIS.verde;
    main.innerHTML = `
      <div class="tela-sinal" style="background:${conteudo.fundo}">
        ${header()}
        <div class="conteudo-scroll">
          <div class="aviso-topo" style="color:${conteudo.corTitulo}">${escaparHtml(conteudo.aviso)}</div>
          <div class="card">
            <div class="titulo">${escaparHtml(conteudo.titulo)}</div>
            <p class="descricao">${escaparHtml(conteudo.descricao)}</p>
          </div>
          <button type="button" class="botao-voltar" id="btn-voltar">Voltar ao início</button>
        </div>
      </div>`;

    main.querySelector('#btn-voltar').addEventListener('click', () => PV.router.navegar('/home?alerta=' + (ctx.sub || 'verde')));
  }

  PV.screens.menuSintomas = menuSintomas;
  PV.screens.conteudoDetalhe = conteudoDetalhe;
  PV.screens.definicaoSintomas = definicaoSintomas;
  PV.screens.sinal = sinal;
})();
