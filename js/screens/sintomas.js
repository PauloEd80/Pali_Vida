/**
 * Fluxo de sintomas — porta de screens/MenuSintomasScreen.tsx,
 * components/ListaSintomas.tsx, components/ModalIntensidade.tsx,
 * screens/ConteudoDetalheScreen.tsx, screens/DefinicaoSintomasScreen.tsx
 * e screens/sinais.tsx + screens/TelaSinal.tsx.
 */
window.PV = window.PV || {};
window.PV.screens = window.PV.screens || {};

(function () {
  const { escaparHtml, aviso, carregando, spinner, ligarNavegacaoInferior, svgRelatorio } = PV.ui;

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

  /* =================================================== ModalIntensidade ===
     A escala de 11 botões numerados foi substituída por uma barra em
     gradiente (verde -> vermelho) que o usuário arrasta lateralmente com o
     dedo/mouse para escolher a intensidade de 0 a 10 — sem precisar acertar
     um alvo pequeno nem rolar a tela.

     `aoRegistrar` é chamado após um registro ser salvo com sucesso, para que
     quem montou o modal (menuSintomas) possa, por exemplo, atualizar o
     painel de "sintomas de hoje" — o próprio modal não navega mais para
     outra tela: fechar aqui só esconde o modal e devolve o foco para a
     grade de sintomas, permitindo registrar vários sintomas em sequência
     sem sair da tela. */
  function montarModalIntensidade(root, ctx, aoRegistrar) {
    const overlay = document.createElement('div');
    overlay.className = 'pv-modal-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="pv-modal-intensidade">
        <div class="titulo">Qual é a intensidade do sintoma?</div>
        <div class="sintoma" id="mi-sintoma"></div>
        <div id="mi-aviso"></div>
        <div class="pv-slider-intensidade" id="mi-slider">
          <div class="pv-slider-valor" id="mi-slider-valor">–</div>
          <div class="pv-slider-track" id="mi-slider-track">
            <div class="pv-slider-thumb" id="mi-slider-thumb"></div>
          </div>
          <div class="pv-slider-marcadores"><span>0</span><span>5</span><span>10</span></div>
        </div>
        <div class="acoes">
          <button type="button" class="botao cancelar" id="mi-cancelar">Cancelar</button>
          <button type="button" class="botao confirmar" id="mi-confirmar">Confirmar</button>
        </div>
      </div>`;
    root.appendChild(overlay);

    let sintomaAtual = null;
    let intensidade = null;

    const track = overlay.querySelector('#mi-slider-track');
    const thumb = overlay.querySelector('#mi-slider-thumb');
    const valorEl = overlay.querySelector('#mi-slider-valor');

    function aplicarValor(v) {
      intensidade = Math.max(0, Math.min(10, Math.round(v)));
      thumb.style.left = (intensidade / 10) * 100 + '%';
      valorEl.textContent = String(intensidade);
    }

    function valorApartirDoPonto(clientX) {
      const rect = track.getBoundingClientRect();
      const fracao = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
      return fracao * 10;
    }

    let arrastando = false;
    function iniciarArraste(clientX) {
      arrastando = true;
      aplicarValor(valorApartirDoPonto(clientX));
    }
    function moverArraste(clientX) {
      if (!arrastando) return;
      aplicarValor(valorApartirDoPonto(clientX));
    }
    function pararArraste() {
      arrastando = false;
    }

    track.addEventListener('pointerdown', (e) => {
      track.setPointerCapture(e.pointerId);
      iniciarArraste(e.clientX);
    });
    track.addEventListener('pointermove', (e) => moverArraste(e.clientX));
    track.addEventListener('pointerup', pararArraste);
    track.addEventListener('pointercancel', pararArraste);

    // Suporte a teclado (acessibilidade): setas esquerda/direita ajustam o valor.
    track.setAttribute('tabindex', '0');
    track.setAttribute('role', 'slider');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '10');
    track.addEventListener('keydown', (e) => {
      const atual = intensidade === null ? 0 : intensidade;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { aplicarValor(atual + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { aplicarValor(atual - 1); e.preventDefault(); }
    });

    function fechar() {
      overlay.hidden = true;
      intensidade = null;
      overlay.querySelector('#mi-aviso').innerHTML = '';
      thumb.style.left = '0%';
      valorEl.textContent = '?';
      // Reabilita e restaura o botão de confirmar, que pode ter ficado
      // desabilitado com o spinner do registro anterior — sem isso, ao
      // registrar um segundo sintoma em seguida, o botão "Confirmar"
      // continuaria travado.
      const botaoConfirmar = overlay.querySelector('#mi-confirmar');
      botaoConfirmar.disabled = false;
      botaoConfirmar.textContent = 'Confirmar';
    }

    overlay.querySelector('#mi-cancelar').addEventListener('click', fechar);
    overlay.querySelector('#mi-confirmar').addEventListener('click', async () => {
      const avisoEl = overlay.querySelector('#mi-aviso');
      if (intensidade === null) {
        avisoEl.innerHTML = aviso({ tipo: 'erro', texto: 'Arraste a barra para indicar a intensidade antes de confirmar.' });
        return;
      }
      const botao = overlay.querySelector('#mi-confirmar');
      botao.disabled = true;
      botao.innerHTML = spinner(true);
      try {
        await PV.db.registros.criar({ paciente_id: ctx.usuario.id, sintoma_id: sintomaAtual.id, intensidade });
        PV.session.marcarSintomaRegistradoHoje();
        fechar();
        // Continua na tela de sintomas (sem voltar para a Home) — quem
        // precisar ver o que já foi registrado hoje usa o ícone de
        // relatório no canto da tela, que este callback mantém atualizado.
        if (typeof aoRegistrar === 'function') aoRegistrar();
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
        // Começa sem valor definido — o usuário precisa arrastar a barra ao
        // menos uma vez para escolher a intensidade, evitando registrar um
        // 0 "por acidente" ao só confirmar sem interagir.
        intensidade = null;
        thumb.style.left = '0%';
        valorEl.textContent = '?';
      },
    };
  }

  /* ============================================================ PainelHoje ===
     Painel deslizante (drawer), aberto por um ícone discreto no canto da
     tela de Menu de Sintomas, mostrando os sintomas já registrados hoje
     (nome + intensidade) sem precisar sair da tela nem voltar para a Home.
     Substitui o antigo painel de teste solto (js/relatorio-teste.js, agora
     removido) por algo integrado à mesma linguagem visual do restante do
     app (mesmo overlay escuro, mesmos tons de azul/creme, mesma tipografia). */
  function corPorIntensidade(v) {
    if (v <= 3) return '#9BC45A';   // verde — leve
    if (v <= 6) return '#F1D359';   // amarelo — moderado
    return '#D63031';               // vermelho — intenso
  }

  function montarPainelHoje(root, ctx) {
    const overlay = document.createElement('div');
    overlay.className = 'pv-painel-hoje-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="pv-painel-hoje" role="dialog" aria-label="Sintomas registrados hoje">
        <div class="pv-painel-hoje-cabecalho">
          <span>Sintomas de hoje</span>
          <button type="button" id="ph-fechar" aria-label="Fechar">&times;</button>
        </div>
        <div id="ph-lista" class="pv-painel-hoje-lista"></div>
      </div>`;
    root.appendChild(overlay);

    const listaEl = overlay.querySelector('#ph-lista');

    function fechar() { overlay.hidden = true; }
    function abrir() {
      overlay.hidden = false;
      atualizar();
    }
    // Se o painel já estiver aberto no momento em que um novo sintoma é
    // registrado, atualiza a lista na hora; se estiver fechado, não faz
    // nada agora — os dados serão buscados de novo na próxima vez que o
    // usuário abrir o painel (abrir() sempre chama atualizar()).
    function atualizarSeAberto() {
      if (!overlay.hidden) atualizar();
    }
    // Clicar no fundo escurecido (fora do cartão) também fecha, como os
    // demais modais do app.
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });
    overlay.querySelector('#ph-fechar').addEventListener('click', fechar);

    async function atualizar() {
      listaEl.innerHTML = carregando();
      let registros, sintomas;
      try {
        [registros, sintomas] = await Promise.all([PV.db.registros.listar(), PV.db.sintomas.listar()]);
      } catch (e) {
        listaEl.innerHTML = aviso({ tipo: 'erro', texto: e.message || 'Não foi possível carregar os sintomas de hoje.' });
        return;
      }
      const nomesPorId = new Map(sintomas.map((s) => [Number(s.id), s.nome_sintoma]));
      const hojeChave = new Date().toDateString();
      const deHoje = registros
        .filter((r) => Number(r.paciente_id) === Number(ctx.usuario.id) && new Date(r.data_registro).toDateString() === hojeChave)
        .sort((a, b) => new Date(b.data_registro) - new Date(a.data_registro));

      if (!deHoje.length) {
        listaEl.innerHTML = `<p class="pv-painel-hoje-vazio">Nenhum sintoma registrado ainda hoje.</p>`;
        return;
      }

      listaEl.innerHTML = deHoje.map((r) => {
        const hora = new Date(r.data_registro).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const nome = nomesPorId.get(Number(r.sintoma_id)) || 'Sintoma';
        return `
          <div class="pv-painel-hoje-item">
            <div class="pv-painel-hoje-linha1">
              <span class="pv-painel-hoje-nome">${escaparHtml(nome)}</span>
              <span class="pv-painel-hoje-nota" style="background:${corPorIntensidade(r.intensidade)}">${r.intensidade}/10</span>
            </div>
            <div class="pv-painel-hoje-hora">${hora}</div>
          </div>`;
      }).join('');
    }

    return { abrir, atualizar: atualizarSeAberto };
  }

  /* ======================================================= MenuSintomas === */
  async function menuSintomas(main, ctx) {
    // Tela pensada para caber inteira na viewport, sem precisar rolar.
    main.classList.add('pv-sem-scroll');
    main.innerHTML = `
      <div class="tela-menu-sintomas">
        <div class="pv-menu-sintomas-cabecalho">
          <h1 class="titulo">Você apresentou algum desses sintomas hoje?</h1>
          <button type="button" class="pv-botao-relatorio-hoje" id="btn-relatorio-hoje" aria-label="Ver sintomas registrados hoje" title="Ver sintomas registrados hoje">${svgRelatorio()}</button>
        </div>
        <div id="lista-sintomas-slot"></div>
      </div>`;

    const painelHoje = montarPainelHoje(main, ctx);
    const modal = montarModalIntensidade(main, ctx, () => painelHoje.atualizar());
    main.querySelector('#btn-relatorio-hoje').addEventListener('click', () => painelHoje.abrir());
    await montarListaSintomas(main.querySelector('#lista-sintomas-slot'), (sintoma) => modal.abrir(sintoma));
  }

  /* ==================================================== ConteudoDetalhe === */
  async function conteudoDetalhe(main, ctx) {
    main.innerHTML = `<div class="pv-carregando" style="min-height:100%;background:var(--areia-clara)">${PV.ui.spinner()}<span>Carregando informações...</span></div>`;

    let conteudo = null;
    let erro = null;
    try {
      conteudo = await PV.db.conteudos.buscar(ctx.sub);
    } catch (e) {
      erro = e.message || 'Erro ao carregar conteúdo.';
    }

    if (!conteudo) {
      main.innerHTML = `<div class="pv-carregando" style="min-height:100%;background:var(--areia-clara)"><span>${escaparHtml(erro || 'Conteúdo não encontrado.')}</span></div>`;
      return;
    }

    main.innerHTML = `
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
    main.innerHTML = `<div class="pv-carregando" style="min-height:100%;background:var(--areia)">${PV.ui.spinner()}<span>Carregando...</span></div>`;

    let conteudo = null;
    try {
      if (ctx.sub) conteudo = await PV.db.conteudos.buscar(ctx.sub);
    } catch {
      conteudo = null;
    }

    if (!conteudo) {
      main.innerHTML = `<div class="pv-carregando" style="min-height:100%;background:var(--areia)"><span>Conteúdo não encontrado.</span></div>`;
      return;
    }

    main.innerHTML = `
      <div class="tela-definicao">
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
      </div>`;

    main.querySelector('#btn-amarelo').addEventListener('click', () => PV.router.navegar('/sinal/amarelo'));
    main.querySelector('#btn-vermelho').addEventListener('click', () => PV.router.navegar('/sinal/vermelho'));
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
