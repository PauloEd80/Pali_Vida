/**
 * Painel Administrativo — porta de screens/PainelAdminScreen.tsx.
 *
 * No código-fonte original nenhum botão leva até essa tela (não está no
 * Footer nem no tabbar) — ver README do site.
 */
window.PV = window.PV || {};
window.PV.screens = window.PV.screens || {};

(function () {
  async function painelAdmin(main) {
    main.innerHTML = `
      <div class="tela-painel-admin">
        <h1 class="titulo">Painel Administrativo</h1>
        <p class="subtitulo">Bem-vindo, Administrador!</p>

        <div class="conteudo">
          <button type="button" class="botao" id="btn-dashboard">Ver dashboard de sintomas</button>
          <button type="button" class="botao" id="btn-conteudos">Gerenciar conteúdos</button>
        </div>

        <button type="button" class="botao-sair" id="btn-sair">Sair</button>
      </div>`;

    main.querySelector('#btn-dashboard').addEventListener('click', () => PV.router.navegar('/home'));
    main.querySelector('#btn-conteudos').addEventListener('click', () => PV.router.navegar('/busca'));
    main.querySelector('#btn-sair').addEventListener('click', () => {
      PV.session.limparSessao();
      PV.router.navegar('/login');
    });
  }

  PV.screens.painelAdmin = painelAdmin;
})();
