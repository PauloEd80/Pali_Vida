/**
 * Ponto de entrada — equivalente a frontend/App.tsx + index.ts.
 */
(function () {
  function iniciar() {
    PV.router.renderizar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
