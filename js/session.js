/**
 * Sessão do usuário — porta direta de frontend/src/services/session.ts.
 * No app original isso ficava no AsyncStorage (que na web já usava
 * localStorage por baixo dos panos); aqui é localStorage diretamente.
 */
window.PV = window.PV || {};

(function () {
  const KEYS = {
    token: 'palivida_auth_token',
    id: 'palivida_auth_id',
    role: 'palivida_auth_role',
    email: 'palivida_auth_email',
  };

  function salvarSessao({ token, usuario }) {
    localStorage.setItem(KEYS.token, token);
    localStorage.setItem(KEYS.id, String(usuario.id));
    localStorage.setItem(KEYS.role, usuario.tipo);
    localStorage.setItem(KEYS.email, usuario.email);
  }

  function lerSessao() {
    const token = localStorage.getItem(KEYS.token);
    const id = localStorage.getItem(KEYS.id);
    const tipo = localStorage.getItem(KEYS.role);
    if (!token || !id || !tipo) return null;
    return {
      token,
      usuario: { id: Number(id), tipo, email: localStorage.getItem(KEYS.email) || '' },
    };
  }

  function limparSessao() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  }

  function marcarSintomaRegistradoHoje() {
    localStorage.setItem('palivida_ultima_data_sintoma', new Date().toISOString().split('T')[0]);
  }

  window.PV.session = { salvarSessao, lerSessao, limparSessao, marcarSintomaRegistradoHoje };
})();
