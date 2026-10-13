/**
 * Triagem de sintomas e Laudo digital.
 *
 * Porta das funcionalidades de app.js do "PaliVida — Portal Clínico e Laudo
 * Digital" (busca de sintomas com sinônimos, medidor de nível de atenção,
 * visualizador de PDF local) para dentro do app-shell de telefone do
 * PaliVida, com a mesma paleta/fonte/componentes do restante do site (ver
 * css/styles.css, seção "Triagem / Carteirinha").
 *
 * O wizard de identificação (antiga "Carteirinha") foi unificado com a tela
 * de Prontuário — ver js/screens/perfil.js — para não haver duas telas com
 * o mesmo propósito. Os cards de condição mostram só o título, sem ícone —
 * nem emoji nem SVG — para manter a tela limpa.
 *
 * Disponível só para Paciente e Cuidador — o Administrador continua com o
 * Dashboard de sintomas e edita o conteúdo desta tela em "Entendendo os
 * sintomas" (tela /busca, "+ Novo Conteúdo") — ver router.js.
 *
 * IMPORTANTE — fonte dos dados: até esta versão, as condições exibidas aqui
 * vinham de um array fixo (DADOS_CLINICOS) só neste arquivo, sem relação
 * com o painel de administração. Agora os cards vêm de PV.db.conteudos
 * (mesma planilha do Google Sheets usada em /busca), para que o admin edite
 * a Triagem pelo botão "+ Novo Conteúdo"/"Editar". Isso muda o contrato de
 * dados: "SinaisSintomas" e "SinaisAlerta" (que na planilha são um texto
 * único por célula) viram a lista de itens marcáveis desta tela separando
 * o texto por ";" — cada trecho entre ";" vira um checkbox. Ao editar o
 * conteúdo pelo admin, cada sinal/sintoma/alerta deve ficar em uma linha
 * separada por ";" (ex.: "Item 1; Item 2; Item 3").
 * Os campos "sinônimos" (busca por voz/texto) e "referências bibliográficas"
 * não existem na planilha — ficam vazios/ocultos nesta versão.
 */
window.PV = window.PV || {};
window.PV.screens = window.PV.screens || {};

(function () {
  const { escaparHtml, svgMic, aviso, carregando } = PV.ui;

  // Separador usado dentro das células sinaissintomas/sinaisalerta da
  // planilha para demarcar cada item marcável (checkbox) da Triagem.
  const SEPARADOR_ITENS = ';';

  function dividirItens(texto) {
    return String(texto || '')
      .split(SEPARADOR_ITENS)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Converte um conteúdo vindo de PV.db.conteudos (mesmo formato usado na
  // tela /busca) para o formato de "condição clínica" que os cards da
  // Triagem esperam. `id` aqui precisa ser estável e único no HTML (usado
  // em seletores tipo #triagem-<id>): usamos "conteudo-<id numérico>".
  function paraCondicaoClinica(conteudo) {
    return {
      id: `conteudo-${conteudo.id}`,
      titulo: conteudo.titulo || '',
      definicao: conteudo.descricao || conteudo.texto || '',
      sinaisSintomas: dividirItens(conteudo.SinaisSintomas),
      sinaisAlerta: dividirItens(conteudo.SinaisAlerta),
      // Sinônimos e referências bibliográficas não existem na planilha —
      // a tela já lida bem com essas listas vazias (sem "Referências" ou
      // sem resultado extra na busca por sinônimo).
      sinonimos: [],
      referencias: [],
    };
  }

  /* =============================================================== Triagem === */
  async function triagem(main, ctx) {
    const selecionados = new Set();
    const selecionadosAlerta = new Set();
    let textoBusca = '';
    let DADOS_CLINICOS = [];

    main.innerHTML = carregando();
    try {
      const conteudos = await PV.db.conteudos.listar();
      DADOS_CLINICOS = conteudos.map(paraCondicaoClinica);
    } catch (e) {
      main.innerHTML = aviso({ tipo: 'erro', texto: e.message || 'Não foi possível carregar os sintomas.' });
      return;
    }

    function cardHtml(item) {
      const sintomasHtml = item.sinaisSintomas.map((s) => {
        const marcado = selecionados.has(s);
        return `<label class="pv-triagem-check${marcado ? ' selecionado' : ''}">
          <input type="checkbox" data-tipo="sintoma" data-item="${item.id}" value="${escaparHtml(s)}" ${marcado ? 'checked' : ''}>
          <span>${escaparHtml(s)}</span>
        </label>`;
      }).join('');

      const alertaHtml = item.sinaisAlerta.length ? `
        <div class="pv-triagem-alerta-secao">
          <div class="pv-triagem-rotulo alerta">Sinais de alerta — observou algum destes?</div>
          <div class="pv-triagem-grade">
            ${item.sinaisAlerta.map((a) => {
              const marcado = selecionadosAlerta.has(a);
              return `<label class="pv-triagem-check${marcado ? ' selecionado alerta' : ''}">
                <input type="checkbox" data-tipo="alerta" data-item="${item.id}" value="${escaparHtml(a)}" ${marcado ? 'checked' : ''}>
                <span>${escaparHtml(a)}</span>
              </label>`;
            }).join('')}
          </div>
        </div>` : '';

      const refsHtml = item.referencias.map((r) => `<li>${escaparHtml(r)}</li>`).join('');

      return `
        <div class="pv-triagem-card" id="triagem-${item.id}">
          <button type="button" class="pv-triagem-cabecalho" data-abrir="${item.id}">
            <span class="pv-triagem-titulo">${escaparHtml(item.titulo)}</span>
            <span class="pv-triagem-seta">▼</span>
          </button>
          <div class="pv-triagem-corpo">
            <p class="pv-triagem-definicao">${escaparHtml(item.definicao)}</p>
            <div class="pv-triagem-rotulo">Marque os sintomas observados:</div>
            <div class="pv-triagem-grade">${sintomasHtml}</div>
            ${alertaHtml}
            <details class="pv-triagem-refs">
              <summary>Referências bibliográficas</summary>
              <ul>${refsHtml}</ul>
            </details>
          </div>
        </div>`;
    }

    function medidorHtml() {
      const total = selecionados.size + selecionadosAlerta.size;
      if (!total) return '';

      let nivel, texto;
      if (selecionadosAlerta.size > 0 || selecionados.size >= 6) {
        nivel = 'vermelho';
        texto = '<strong>Atenção:</strong> sinais de alerta identificados. Identificamos que você possui sinais e sintomas que requerem avaliação médica. Busque orientação e atendimento médico';
      } else if (selecionados.size >= 3) {
        nivel = 'amarelo';
        texto = '<strong>Observação:</strong> múltiplos sintomas. Identificamos que você possui sinais e sintomas que requerem avaliação médica. Busque orientação e atendimento médico';
      } else {
        nivel = 'verde';
        texto = '<strong>Controle:</strong> Identificamos que você possui sinais e sintomas que requerem avaliação médica. Busque orientação e atendimento médico';
      }

      return `
        <div class="pv-triagem-medidor">
          <div class="pv-triagem-medidor-cabecalho">
            <button type="button" class="pv-triagem-limpar" id="triagem-limpar">Limpar</button>
          </div>
          <div class="pv-triagem-banner ${nivel}">${texto}</div>
        </div>`;
    }

    function sugestoesHtml(termo) {
      if (!termo) return '';
      const resultados = [];
      DADOS_CLINICOS.forEach((item) => {
        const bateTitulo = item.titulo.toLowerCase().includes(termo) || item.sinonimos.some((s) => s.toLowerCase().includes(termo));
        if (bateTitulo) resultados.push({ titulo: item.titulo, id: item.id, tipo: 'Condição' });
        item.sinaisSintomas.forEach((s) => {
          if (s.toLowerCase().includes(termo) && !resultados.some((r) => r.titulo === item.titulo)) {
            resultados.push({ titulo: `${s} (${item.titulo})`, id: item.id, tipo: 'Sintoma' });
          }
        });
      });
      if (!resultados.length) return '';
      return `<ul class="pv-triagem-sugestoes">${resultados.map((r) => `
        <li data-ir="${r.id}"><span>${escaparHtml(r.titulo)}</span><span class="pv-triagem-tag">${r.tipo}</span></li>`).join('')}</ul>`;
    }

    main.innerHTML = `
      <div class="tela-triagem">
        <div class="pv-triagem-intro">
          <h1 class="titulo">O que você está sentindo hoje?</h1>
          <p class="subtitulo">Digite um sintoma ou toque em uma condição para ver mais.</p>
          <div class="pv-triagem-busca-wrap">
            <input class="pv-triagem-busca" id="triagem-busca" type="text" placeholder="Ex: dor, enjoo, ansiedade..." autocomplete="off">
            <button type="button" class="pv-triagem-mic" id="triagem-mic" aria-label="Buscar por voz" title="Buscar por voz">${svgMic(false)}</button>
          </div>
          <div id="triagem-sugestoes"></div>
        </div>

        <div id="triagem-medidor">${medidorHtml()}</div>

        <div id="triagem-lista" class="pv-triagem-lista">
          ${DADOS_CLINICOS.length ? DADOS_CLINICOS.map(cardHtml).join('') : '<p class="lista-vazia">Nenhum sintoma cadastrado ainda.</p>'}
        </div>

        <div class="pv-triagem-links">
          <button type="button" class="pv-triagem-link" id="ir-carteirinha">Preencher meu prontuário</button>
          <button type="button" class="pv-triagem-link" id="ir-laudo">Abrir laudo em PDF salvo no aparelho</button>
        </div>
      </div>`;

    const listaEl = main.querySelector('#triagem-lista');
    const medidorEl = main.querySelector('#triagem-medidor');
    const sugestoesEl = main.querySelector('#triagem-sugestoes');
    const buscaEl = main.querySelector('#triagem-busca');

    function religarCard(id) {
      const wrap = document.createElement('div');
      wrap.innerHTML = cardHtml(DADOS_CLINICOS.find((i) => i.id === id));
      const novo = wrap.firstElementChild;
      const atual = main.querySelector(`#triagem-${id}`);
      const aberto = atual && atual.classList.contains('aberto');
      atual.replaceWith(novo);
      if (aberto) novo.classList.add('aberto');
      ligarCard(novo);
    }

    function ligarCard(cardEl) {
      cardEl.querySelector('[data-abrir]').addEventListener('click', () => cardEl.classList.toggle('aberto'));
      cardEl.querySelectorAll('input[type="checkbox"]').forEach((chk) => {
        chk.addEventListener('change', () => {
          const tipo = chk.dataset.tipo;
          const valor = chk.value;
          if (tipo === 'sintoma') {
            chk.checked ? selecionados.add(valor) : selecionados.delete(valor);
          } else {
            chk.checked ? selecionadosAlerta.add(valor) : selecionadosAlerta.delete(valor);
          }
          religarCard(chk.dataset.item);
          medidorEl.innerHTML = medidorHtml();
          ligarMedidor();
        });
      });
    }

    function ligarMedidor() {
      const btn = main.querySelector('#triagem-limpar');
      if (!btn) return;
      btn.addEventListener('click', () => {
        selecionados.clear();
        selecionadosAlerta.clear();
        DADOS_CLINICOS.forEach((i) => religarCard(i.id));
        medidorEl.innerHTML = medidorHtml();
        ligarMedidor();
      });
    }

    function abrirCard(id) {
      const el = main.querySelector(`#triagem-${id}`);
      if (!el) return;
      el.classList.add('aberto');
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      sugestoesEl.innerHTML = '';
    }

    listaEl.querySelectorAll('.pv-triagem-card').forEach(ligarCard);
    ligarMedidor();
    main.querySelectorAll('[data-ir]').forEach((btn) => {
      btn.addEventListener('click', () => abrirCard(btn.dataset.ir));
    });

    buscaEl.addEventListener('input', () => {
      textoBusca = buscaEl.value.toLowerCase().trim();
      sugestoesEl.innerHTML = sugestoesHtml(textoBusca);
      sugestoesEl.querySelectorAll('[data-ir]').forEach((li) => li.addEventListener('click', () => {
        buscaEl.value = '';
        abrirCard(li.dataset.ir);
      }));
    });

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const micBtn = main.querySelector('#triagem-mic');
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;
      micBtn.addEventListener('click', () => {
        recognition.start();
        micBtn.classList.add('gravando');
        micBtn.innerHTML = svgMic(true);
      });
      recognition.addEventListener('result', (e) => {
        buscaEl.value = e.results[0][0].transcript.replace('.', '');
        buscaEl.dispatchEvent(new Event('input'));
      });
      recognition.addEventListener('end', () => { micBtn.classList.remove('gravando'); micBtn.innerHTML = svgMic(false); });
      recognition.addEventListener('error', () => { micBtn.classList.remove('gravando'); micBtn.innerHTML = svgMic(false); });
    } else {
      micBtn.style.display = 'none';
    }

    main.querySelector('#ir-carteirinha').addEventListener('click', () => PV.router.navegar('/perfil'));
    main.querySelector('#ir-laudo').addEventListener('click', () => PV.router.navegar('/laudo'));
  }

  /* O wizard de identificação (antiga tela "Carteirinha") foi movido para
     dentro da tela de Prontuário — ver js/screens/perfil.js — para não haver
     duas telas com o mesmo propósito. Esta tela de Triagem só linka para lá. */

  /* ============================================================ LaudoDigital === */
  async function laudoDigital(main, ctx) {
    let blobUrl = null;
    let arquivoAtual = null;

    main.innerHTML = `
      <div class="tela-laudo">
        <h1 class="titulo">Laudo em PDF</h1>
        <p class="subtitulo">Selecione um PDF salvo no seu aparelho para tê-lo sempre à mão.</p>

        <div class="pv-laudo-card">
          <div class="pv-laudo-info">
            <h3>Carregar documento (PDF)</h3>
            <p>Busque o arquivo PDF do laudo em seu celular.</p>
          </div>
          <label for="laudo-arquivo" class="pv-laudo-botao-upload">Selecionar arquivo PDF</label>
          <input type="file" id="laudo-arquivo" accept="application/pdf" class="pv-oculto">
        </div>

        <div id="laudo-visualizador" class="pv-laudo-visualizador pv-oculto">
          <div class="pv-laudo-visualizador-cabecalho">
            <h4>Visualizando documento</h4>
            <p class="pv-laudo-aviso-mobile">Visualização direta pode não funcionar em alguns celulares — use "Abrir / salvar arquivo".</p>
          </div>
          <div class="pv-laudo-acoes">
            <button type="button" class="botao-enviar" id="laudo-abrir">Abrir / salvar arquivo</button>
            <button type="button" class="botao-voltar" id="laudo-fechar">Fechar</button>
          </div>
          <div class="pv-laudo-frame-wrap">
            <iframe id="laudo-frame" title="Visualizador de PDF"></iframe>
          </div>
        </div>

        <button type="button" class="botao-voltar" id="laudo-ir-triagem">Voltar à triagem de sintomas</button>
      </div>`;

    const inputEl = main.querySelector('#laudo-arquivo');
    const visualizadorEl = main.querySelector('#laudo-visualizador');
    const frameEl = main.querySelector('#laudo-frame');

    inputEl.addEventListener('change', (e) => {
      const arquivo = e.target.files[0];
      if (!arquivo) return;
      if (arquivo.type !== 'application/pdf') {
        alert('Por favor, selecione um arquivo válido no formato PDF.');
        inputEl.value = '';
        return;
      }
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      arquivoAtual = arquivo;
      blobUrl = URL.createObjectURL(arquivo);
      frameEl.src = blobUrl;
      visualizadorEl.classList.remove('pv-oculto');
      visualizadorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    main.querySelector('#laudo-abrir').addEventListener('click', (e) => {
      e.preventDefault();
      if (!blobUrl) return;
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = arquivoAtual ? arquivoAtual.name : 'meu-laudo.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

    main.querySelector('#laudo-fechar').addEventListener('click', () => {
      frameEl.src = '';
      if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; arquivoAtual = null; }
      visualizadorEl.classList.add('pv-oculto');
      inputEl.value = '';
    });

    main.querySelector('#laudo-ir-triagem').addEventListener('click', () => PV.router.navegar('/triagem'));
  }

  PV.screens.triagem = triagem;
  PV.screens.laudoDigital = laudoDigital;
})();
