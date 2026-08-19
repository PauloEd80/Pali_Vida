/**
 * Roteador por hash — porta de navigation/RootNavigator.tsx.
 *
 * Um site estático não tem servidor para rotear URLs "de verdade" (algo como
 * /conteudo/3 exigiria configurar rewrites no host), então cada "tela" vira
 * uma rota por hash (#/conteudo/3). O guard de autenticação e a regra de
 * "administrador vê o Dashboard no lugar da Home" espelham exatamente o que
 * RootNavigator.tsx faz.
 */
window.PV = window.PV || {};

(function () {
  const ABAS = new Set(['home', 'busca', 'triagem', 'perfil']);
  const PUBLICAS = new Set(['login', 'cadastro']);
  let geracaoAtual = 0;

  function analisar() {
    let hash = location.hash.slice(1);
    if (!hash) hash = '/login';
    const [caminho, queryStr] = hash.split('?');
    const partes = caminho.split('/').filter(Boolean);
    const query = Object.fromEntries(new URLSearchParams(queryStr || ''));
    return { rota: (partes[0] || 'login').toLowerCase(), sub: partes[1], query };
  }

  async function renderizar() {
    const minhaGeracao = ++geracaoAtual;
    const { rota, sub, query } = analisar();
    const sessao = PV.session.lerSessao();

    if (!sessao && !PUBLICAS.has(rota)) {
      location.hash = '#/login';
      return;
    }

    const main = document.getElementById('app-main');
    main.innerHTML = '';

    const ctx = { sub, query, sessao, usuario: sessao ? sessao.usuario : null };

    try {
      switch (rota) {
        case 'login':
          await PV.screens.login(main, ctx);
          break;
        case 'cadastro':
          await PV.screens.cadastro(main, ctx);
          break;
        case 'home':
          if (ctx.usuario.tipo === 'administrador') await PV.screens.dashboardAdmin(main, ctx);
          else await PV.screens.home(main, ctx);
          break;
        case 'busca':
          await PV.screens.busca(main, ctx);
          break;
        case 'contato':
          if (ctx.usuario.tipo === 'administrador') { location.hash = '#/home'; return; }
          await PV.screens.contato(main, ctx);
          break;
        case 'triagem':
          if (ctx.usuario.tipo === 'administrador') { location.hash = '#/home'; return; }
          await PV.screens.triagem(main, ctx);
          break;
        case 'carteirinha':
          // A carteirinha foi unificada com o Prontuário — mantém o link antigo funcionando.
          location.hash = '#/perfil';
          return;
        case 'laudo':
          if (ctx.usuario.tipo === 'administrador') { location.hash = '#/home'; return; }
          await PV.screens.laudoDigital(main, ctx);
          break;
        case 'perfil':
          await PV.screens.perfil(main, ctx);
          break;
        case 'menu-sintomas':
          await PV.screens.menuSintomas(main, ctx);
          break;
        case 'conteudo':
          await PV.screens.conteudoDetalhe(main, ctx);
          break;
        case 'definicao':
          await PV.screens.definicaoSintomas(main, ctx);
          break;
        case 'sinal':
          await PV.screens.sinal(main, ctx);
          break;
        case 'painel-admin':
          await PV.screens.painelAdmin(main, ctx);
          break;
        default:
          location.hash = '#/login';
          return;
      }
    } catch (e) {
      if (minhaGeracao !== geracaoAtual) return; // uma navegação mais nova já começou
      main.innerHTML = `<div class="pv-carregando"><span>${PV.ui.escaparHtml(e.message || 'Algo deu errado.')}</span></div>`;
      console.error(e);
    }

    // Se, enquanto esta renderização esperava suas chamadas assíncronas, o
    // hash mudou de novo, uma renderização mais nova já assumiu `main` — não
    // mexer mais em nada (sem isso, a tabbar/rodapé desta geração antiga
    // podia ser anexada por cima da tela nova).
    if (minhaGeracao !== geracaoAtual) return;

    if (sessao && ABAS.has(rota)) {
      main.insertAdjacentHTML('beforeend', PV.ui.tabbar(rota, ctx.usuario.tipo));
      PV.ui.ligarNavegacaoInferior(main);
    }

    if (typeof main.scrollTo === 'function') main.scrollTo({ top: 0 });
    else main.scrollTop = 0;
  }

  function navegar(hash) {
    if (!hash.startsWith('#')) hash = '#' + hash;
    if (location.hash === hash) renderizar();
    else location.hash = hash;
  }

  window.addEventListener('hashchange', renderizar);

  window.PV.router = { renderizar, navegar };
})();
