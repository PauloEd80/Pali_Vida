/**
 * Peças de UI compartilhadas — porta de components/Header.tsx, Footer.tsx,
 * Aviso.tsx, Chips.tsx e do tabBar montado em navigation/RootNavigator.tsx.
 *
 * Cada função devolve uma string HTML (para usar com innerHTML) e, quando
 * tem interação, uma função `ligar(root)` para conectar os event listeners
 * depois que o HTML entrou no DOM — o mesmo padrão em todas as telas.
 */
window.PV = window.PV || {};

(function () {
  function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* Ícones que existiam como PNG corrompido no bundle original (LogoClara.png
     e lupa.png) foram refeitos aqui como SVG simples, no mesmo espírito
     minimalista do resto do app — ver nota no README do site. */
  function svgLogo() {
    return `
      <svg viewBox="0 0 90 100" width="72" height="80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M45 92C45 92 12 68 12 40C12 22 25 10 40 10C42 10 44 10.6 45 12C46 10.6 48 10 50 10C65 10 78 22 78 40C78 68 45 92 45 92Z"
          fill="none" stroke="#112A6C" stroke-width="5" stroke-linejoin="round"/>
        <path d="M22 42L34 42L40 30L48 54L54 42L66 42" fill="none" stroke="#E78F47" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
  }

  function svgLupa() {
    return `
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" stroke="#112A6C" stroke-width="2.2"/>
        <line x1="15.4" y1="15.4" x2="21" y2="21" stroke="#112A6C" stroke-width="2.2" stroke-linecap="round"/>
      </svg>`;
  }

  /* Ícone de microfone minimalista (traço simples, sem preenchimento), no
     mesmo espírito visual do restante do app — substitui o emoji 🎤 usado
     antes na busca por voz da Triagem. */
  function svgMic(gravando) {
    const cor = gravando ? '#FFFFFF' : 'currentColor';
    return `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="9" y="2.5" width="6" height="11" rx="3" stroke="${cor}" stroke-width="1.8"/>
        <path d="M5.5 11.5a6.5 6.5 0 0013 0" stroke="${cor}" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="12" y1="18" x2="12" y2="21.5" stroke="${cor}" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="8" y1="21.5" x2="16" y2="21.5" stroke="${cor}" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`;
  }

  /* ======================================================== Header.tsx === */
  function header() {
    return `<div class="pv-header"><span class="pv-logo">PaliVida</span></div>`;
  }

  /* ======================================================== Footer.tsx === */
  const ATALHOS_FOOTER = [
    { id: 'home', rotulo: 'Início', img: 'assets/img/Home.png' },
    { id: 'busca', rotulo: 'Entendendo os sintomas', img: 'assets/img/Question.png' },
    { id: 'perfil', rotulo: 'Prontuário', img: 'assets/img/User.png' },
  ];

  // Aba de Triagem (busca de sintomas + prontuário/carteirinha + laudo) só
  // aparece para quem tem prontuário de paciente (paciente e cuidador). Para
  // esses dois perfis ela cobre o mesmo propósito da antiga aba "Entendendo
  // os sintomas" (ícone de interrogação), que por isso é removida do menu
  // deles — a rota /busca continua existindo só para o administrador, que
  // a usa para gerenciar conteúdos e não tem acesso à Triagem.
  const ATALHO_TRIAGEM = { id: 'triagem', rotulo: 'Triagem e Prontuário', img: 'assets/img/triagem.png' };

  function atalhosPara(tipoUsuario) {
    if (tipoUsuario === 'administrador') return ATALHOS_FOOTER;
    const [inicio, , perfil] = ATALHOS_FOOTER;
    return [inicio, ATALHO_TRIAGEM, perfil];
  }

  function footer(tipoUsuario) {
    return `<div class="pv-footer">${atalhosPara(tipoUsuario).map(
      (a) => `<button type="button" data-ir="${a.id}" aria-label="${a.rotulo}"><img src="${a.img}" alt=""></button>`,
    ).join('')}</div>`;
  }

  /* ============================================ Bottom tabs (RootNavigator) === */
  function tabbar(rotaAtiva, tipoUsuario) {
    return `<div class="pv-tabbar">${atalhosPara(tipoUsuario).map(
      (a) => `<button type="button" class="${a.id === rotaAtiva ? 'ativo' : ''}" data-ir="${a.id}" aria-label="${a.rotulo}"><img src="${a.img}" alt=""></button>`,
    ).join('')}</div>`;
  }

  /** Liga os botões de Footer/tabbar (mesmo atributo data-ir) a navegação por hash. */
  function ligarNavegacaoInferior(root) {
    root.querySelectorAll('[data-ir]').forEach((btn) => {
      btn.addEventListener('click', () => PV.router.navegar('/' + btn.dataset.ir));
    });
  }

  /* ========================================================= Aviso.tsx === */
  function aviso(mensagem) {
    if (!mensagem) return '';
    const classe = mensagem.tipo === 'sucesso' ? 'sucesso' : 'erro';
    return `<div class="pv-aviso ${classe}" role="alert">${escaparHtml(mensagem.texto)}</div>`;
  }

  function spinner(claro) {
    return `<div class="pv-spinner${claro ? ' claro' : ''}"></div>`;
  }

  function carregando(texto, claro) {
    return `<div class="pv-carregando">${spinner(claro)}${texto ? `<span>${escaparHtml(texto)}</span>` : ''}</div>`;
  }

  /* =============================================================== Chips === */
  const GENEROS = ['Feminino', 'Masculino', 'Não-binário', 'Outro', 'Prefiro não informar'];
  const TIPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const UFS = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  ];

  function chips(grupo, opcoes, selecionado) {
    return `<div class="pv-chips" data-grupo="${grupo}" role="radiogroup">${opcoes
      .map(
        (op) =>
          `<button type="button" class="pv-chip${op === selecionado ? ' ativo' : ''}" role="radio" aria-checked="${op === selecionado}" data-valor="${escaparHtml(op)}">${escaparHtml(op)}</button>`,
      )
      .join('')}</div>`;
  }

  /** Liga um grupo de chips: clique seleciona e chama onSelecionar(valor). */
  function ligarChips(root, grupo, onSelecionar) {
    const wrap = root.querySelector(`.pv-chips[data-grupo="${grupo}"]`);
    if (!wrap) return;
    wrap.querySelectorAll('.pv-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.pv-chip').forEach((b) => {
          b.classList.remove('ativo');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('ativo');
        btn.setAttribute('aria-checked', 'true');
        onSelecionar(btn.dataset.valor);
      });
    });
  }

  function selectOpcoes(opcoes, selecionado, placeholder) {
    const ph = placeholder ? `<option value="">${escaparHtml(placeholder)}</option>` : '';
    return ph + opcoes
      .map((op) => `<option value="${escaparHtml(op)}" ${op === selecionado ? 'selected' : ''}>${escaparHtml(op)}</option>`)
      .join('');
  }

  window.PV.ui = {
    escaparHtml,
    svgLogo,
    svgLupa,
    svgMic,
    header,
    footer,
    tabbar,
    ligarNavegacaoInferior,
    aviso,
    spinner,
    carregando,
    chips,
    ligarChips,
    selectOpcoes,
    GENEROS,
    TIPOS_SANGUINEOS,
    UFS,
  };
})();
