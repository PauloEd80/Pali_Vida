/**
 * Painel flutuante de acompanhamento para o teste de amanhã.
 *
 * Objetivo: dar visibilidade, em tempo de execução, dos registros de
 * intensidade de sintomas (escala 0–10) feitos durante a sessão — sem
 * alterar nenhuma tela existente e sem persistir nada além do que o
 * próprio app já grava em localStorage (js/db.js).
 *
 * Funciona "escutando" PV.db.registros.criar: quando qualquer tela chama
 * essa função (hoje, só o ModalIntensidade em screens/sintomas.js chama),
 * este arquivo intercepta a chamada, deixa ela rodar normalmente e, se
 * teve sucesso, acrescenta uma linha ao painel. Nenhuma tela precisa saber
 * que este painel existe.
 *
 * Este arquivo é aditivo: pode ser removido (bastando tirar a tag <script>
 * de index.html) sem afetar em nada o restante do app.
 */
window.PV = window.PV || {};

(function () {
  const registrosSessao = [];
  let painelEl = null;
  let botaoEl = null;
  let listaEl = null;
  let abertoAtual = false;

  function horaAtual() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function corPorIntensidade(v) {
    if (v <= 3) return '#9BC45A';   // verde — leve
    if (v <= 6) return '#FFBE3B';   // amarelo — moderado
    return '#D00000';               // vermelho — intenso
  }

  async function nomeDoSintoma(sintomaId) {
    try {
      const lista = await PV.db.sintomas.listar();
      const s = lista.find((x) => Number(x.id) === Number(sintomaId));
      return s ? s.nome_sintoma : `Sintoma #${sintomaId}`;
    } catch {
      return `Sintoma #${sintomaId}`;
    }
  }

  function montarPainel() {
    if (painelEl) return;

    botaoEl = document.createElement('button');
    botaoEl.type = 'button';
    botaoEl.id = 'pv-relatorio-botao';
    botaoEl.setAttribute('aria-label', 'Abrir relatório de intensidade (modo teste)');
    botaoEl.textContent = '📋';

    painelEl = document.createElement('div');
    painelEl.id = 'pv-relatorio-painel';
    painelEl.hidden = true;
    painelEl.innerHTML = `
      <div class="pv-relatorio-cabecalho">
        <span>Relatório de intensidade — modo teste</span>
        <button type="button" id="pv-relatorio-fechar" aria-label="Fechar">&times;</button>
      </div>
      <p class="pv-relatorio-legenda">
        Escala de 0 (sem sintoma) a 10 (intensidade máxima), conforme relatado pelo paciente a cada registro.
        Exibido apenas em tela para acompanhamento do teste — nada aqui é salvo além do que o próprio app já grava.
      </p>
      <div id="pv-relatorio-lista" class="pv-relatorio-lista"></div>
    `;

    document.body.appendChild(botaoEl);
    document.body.appendChild(painelEl);
    listaEl = painelEl.querySelector('#pv-relatorio-lista');

    botaoEl.addEventListener('click', () => alternar());
    painelEl.querySelector('#pv-relatorio-fechar').addEventListener('click', () => alternar(false));

    injetarEstilos();
  }

  function alternar(forcar) {
    abertoAtual = typeof forcar === 'boolean' ? forcar : !abertoAtual;
    painelEl.hidden = !abertoAtual;
    botaoEl.setAttribute('aria-expanded', String(abertoAtual));
  }

  function renderLista() {
    if (!listaEl) return;
    if (!registrosSessao.length) {
      listaEl.innerHTML = `<p class="pv-relatorio-vazio">Nenhum sintoma registrado ainda nesta sessão.</p>`;
      return;
    }
    listaEl.innerHTML = registrosSessao
      .slice()
      .reverse()
      .map((r) => `
        <div class="pv-relatorio-item">
          <div class="pv-relatorio-linha1">
            <span class="pv-relatorio-nome">${PV.ui.escaparHtml(r.nome)}</span>
            <span class="pv-relatorio-nota" style="background:${corPorIntensidade(r.intensidade)}">${r.intensidade}/10</span>
          </div>
          <div class="pv-relatorio-hora">${r.hora}</div>
        </div>`)
      .join('');
  }

  function registrar(nome, intensidade) {
    registrosSessao.push({ nome, intensidade, hora: horaAtual() });
    montarPainel();
    renderLista();
    // pequeno destaque visual no botão para indicar novidade sem abrir sozinho
    botaoEl.classList.add('pv-relatorio-novo');
    setTimeout(() => botaoEl && botaoEl.classList.remove('pv-relatorio-novo'), 900);
  }

  function injetarEstilos() {
    if (document.getElementById('pv-relatorio-estilos')) return;
    const style = document.createElement('style');
    style.id = 'pv-relatorio-estilos';
    style.textContent = `
      #pv-relatorio-botao {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 9999;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 0;
        background: var(--azul, #112A6C);
        color: #fff;
        font-size: 20px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      #pv-relatorio-botao.pv-relatorio-novo { animation: pv-relatorio-pulso 0.9s ease; }
      @keyframes pv-relatorio-pulso {
        0% { transform: scale(1); }
        30% { transform: scale(1.18); }
        100% { transform: scale(1); }
      }
      #pv-relatorio-painel {
        position: fixed;
        right: 16px;
        bottom: 72px;
        z-index: 9999;
        width: min(320px, calc(100vw - 32px));
        max-height: min(420px, calc(100vh - 120px));
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: var(--fonte-regular, sans-serif);
      }
      .pv-relatorio-cabecalho {
        background: var(--azul, #112A6C);
        color: #fff;
        padding: 10px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 14px;
        font-weight: 700;
      }
      .pv-relatorio-cabecalho button {
        background: none;
        border: 0;
        color: #fff;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        padding: 0 4px;
      }
      .pv-relatorio-legenda {
        font-size: 11px;
        color: var(--cinza-claro, #666);
        padding: 8px 12px 0;
        margin: 0;
      }
      .pv-relatorio-lista {
        overflow-y: auto;
        padding: 8px 12px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .pv-relatorio-vazio {
        font-size: 13px;
        color: var(--cinza-claro, #666);
        text-align: center;
        margin: 16px 0;
      }
      .pv-relatorio-item {
        background: var(--areia-clara, #F2E8D5);
        border-radius: 8px;
        padding: 8px 10px;
      }
      .pv-relatorio-linha1 {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .pv-relatorio-nome {
        font-size: 13px;
        font-weight: 700;
        color: var(--marrom, #532C1D);
      }
      .pv-relatorio-nota {
        font-size: 12px;
        font-weight: 700;
        color: #fff;
        border-radius: 999px;
        padding: 2px 8px;
        flex-shrink: 0;
      }
      .pv-relatorio-hora {
        font-size: 11px;
        color: var(--cinza-claro, #666);
        margin-top: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  function interceptarCriacaoDeRegistro() {
    const original = PV.db.registros.criar;
    PV.db.registros.criar = async function (dados) {
      const resultado = await original.call(PV.db.registros, dados);
      nomeDoSintoma(dados.sintoma_id).then((nome) => registrar(nome, dados.intensidade));
      return resultado;
    };
  }

  function iniciar() {
    if (!window.PV || !PV.db || !PV.db.registros || !PV.ui) {
      // js/db.js ou js/ui.js ainda não carregaram nesta ordem — tenta de novo
      // no próximo ciclo (só ocorre se a ordem dos <script> for alterada).
      setTimeout(iniciar, 50);
      return;
    }
    interceptarCriacaoDeRegistro();
    montarPainel();
    renderLista();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
