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
 * Dashboard de sintomas e o gerenciador de conteúdos/sintomas (ver router.js).
 */
window.PV = window.PV || {};
window.PV.screens = window.PV.screens || {};

(function () {
  const { escaparHtml, svgMic } = PV.ui;

  /* ---------------------------------------------------------- dados clínicos */
  // Mesmo corpo de conhecimento de app.js do Portal Clínico (definições,
  // sinais/sintomas, sinais de alerta, sinônimos para busca e referências
  // bibliográficas) — mantido fiel ao conteúdo original.
  const DADOS_CLINICOS = [
    {
      id: 'constipacao', titulo: 'Constipação Intestinal',
      definicao: 'Caracterizado por evacuações com baixa frequência, podendo ser também incompletas e difíceis.',
      sinaisSintomas: ['Dificuldade ou incapacidade de evacuar', 'Menos de três evacuações por semana', 'Eliminação de fezes endurecidas', 'Sensação de esvaziamento incompleto do reto'],
      sinaisAlerta: ['Início rápido', 'Náuseas ou vômito', 'Dificuldade na eliminação de flatos', 'Dor intensa', 'Distensão abdominal', 'Perda de peso sem explicação', 'Sangramento retal', 'Anemia ferropriva inexplicada'],
      sinonimos: ['prisão de ventre', 'ressecado', 'intestino preso', 'dificuldade de ir ao banheiro', 'fezes'],
      referencias: ['OLIVEIRA, Adriana dos Santos et al. Sinais e sintomas na clínica médica. Unitins, 2024.', 'TIMERMAN, Sergio. Emergências Médicas - Passo a Passo. Guanabara Koogan, 2019.'],
    },
    {
      id: 'depressao', titulo: 'Tristeza (Depressão)',
      definicao: 'Variação de humor, marcada por tristeza, falta de motivação, ansiedade, sensação de vazio e falta de esperança.',
      sinaisSintomas: ['Humor deprimido', 'Perda do interesse em atividades diárias', 'Alterações do sono e do apetite', 'Lentificação ou agitação psicomotora', 'Fadiga e perda de energia', 'Falta de concentração e indecisão', 'Pensamentos de culpa excessiva'],
      sinaisAlerta: ['Agitação severa', 'Agressividade', 'Alteração do nível de consciência', 'Ideação ou tentativa suicida'],
      sinonimos: ['triste', 'choro', 'desânimo', 'angústia', 'vazio', 'sem esperança'],
      referencias: ['NUNES, Maria do Patrocínio T. D&T InforMed Clínica Médica. Manole, 2024.', 'TIMERMAN, Sergio. Emergências Médicas - Passo a Passo. Guanabara Koogan, 2019.'],
    },
    {
      id: 'ansiedade', titulo: 'Ansiedade',
      definicao: 'Mecanismo do organismo para nos avisar quando algo está errado. Caracterizado por tensão, hipervigilância e apreensão.',
      sinaisSintomas: ['Preocupações excessivas', 'Dificuldade em relaxar e tensão muscular', 'Sudorese e taquicardia', 'Sensação de falta de ar', 'Aceleração da fala e pensamento'],
      sinaisAlerta: ['Associação ao uso abusivo de substâncias', 'Ideação ou tentativa suicida'],
      sinonimos: ['nervoso', 'nervosismo', 'pânico', 'apreensão', 'medo', 'suor', 'coração acelerado'],
      referencias: ['NUNES, Maria do Patrocínio T. D&T InforMed Clínica Médica. Manole, 2024.'],
    },
    {
      id: 'dor', titulo: 'Dor',
      definicao: 'Reação do sistema nervoso de modo fisiológico a uma lesão tecidual decorrente de estímulos mecânicos, químicos ou térmicos.',
      sinaisSintomas: ['Náuseas e Vômitos', 'Sudorese e Palidez', 'Taquicardia e Hipertensão Arterial', 'Alteração do tônus muscular', 'Irritabilidade e alteração do sono'],
      sinaisAlerta: ['Dor de intensidade extrema sem alívio', 'Associação com perda motora repentina'],
      sinonimos: ['machucado', 'pontada', 'ardência', 'incômodo', 'sofrimento físico'],
      referencias: ['OLIVEIRA, Adriana dos Santos et al. Sinais e sintomas na clínica médica. Unitins, 2024.', 'CARVALHO, Ricardo T.; PARSONS, Henrique A. Manual de cuidados paliativos. ANCP, 2012.'],
    },
    {
      id: 'nausea-vomito', titulo: 'Náusea e Vômitos',
      definicao: 'Náusea é a sensação subjetiva de incômodo que antecipa o vômito. Vômito é a eliminação forçada do conteúdo gástrico.',
      sinaisSintomas: ['Anorexia', 'Dor e distensão abdominal', 'Refluxo gastroesofágico'],
      sinaisAlerta: ['Febre alta', 'Cefaleia e alterações visuais/vertigens', 'Desidratação e instabilidade hemodinâmica', 'Alterações neurológicas agudas'],
      sinonimos: ['enjoo', 'ânsia', 'vomitar', 'revirando o estômago', 'embrulho'],
      referencias: ['RIBEIRO, Sabrina Corrêa da C. Cuidados paliativos no paciente crítico. Manole, 2023.'],
    },
    {
      id: 'dispneia', titulo: 'Dispneia (Falta de Ar)',
      definicao: 'Sensação de desconforto respiratório, percebido como falta de ar ou aumento do esforço respiratório.',
      sinaisSintomas: ['Ansiedade', 'Secreções respiratórias audíveis (sororoca)', 'Dispneia ao falar', 'Incursões respiratórias superficiais ou pausadas'],
      sinaisAlerta: ['Confusão mental aguda', 'Esforço respiratório insuficiente ou exaustão'],
      sinonimos: ['falta de ar', 'sufoco', 'respiração ofegante', 'cansaço para respirar', 'asma'],
      referencias: ['BERLINER, D. et al. The Differential Diagnosis of Dyspnea. 2016.'],
    },
    {
      id: 'fadiga', titulo: 'Fadiga / Cansaço',
      definicao: 'Sensação desagradável e subjetiva, englobando do cansaço à exaustão, interferindo na capacidade funcional.',
      sinaisSintomas: ['Perda de massa muscular e fraqueza', 'Falta de disposição diária', 'Lentidão de raciocínio e memória'],
      sinaisAlerta: ['Piora rápida da intensidade da fadiga', 'Inquietação ou letargia severa', 'Sonolência na maioria do tempo', 'Alteração marcante dos Sinais Vitais'],
      sinonimos: ['cansaço', 'exaustão', 'fraqueza', 'sem força', 'moleza', 'sono excessivo'],
      referencias: ['SOCIEDADE BRASILEIRA DE ONCOLOGIA CLÍNICA (SBOC). Manual de tratamento sintomático, 2025.'],
    },
    {
      id: 'xerostomia', titulo: 'Xerostomia (Boca Seca)',
      definicao: 'Sensação de boca seca devido à diminuição da produção salivar ou alteração da sua composição.',
      sinaisSintomas: ['Saliva espessa ou ausência de saliva', 'Alteração do paladar e sensação de queimação', 'Dificuldade para mastigar, engolir e falar'],
      sinaisAlerta: ['Incapacidade total de se alimentar', 'Infeções orais disseminadas', 'Ressecamento das vias respiratórias e garganta'],
      sinonimos: ['boca seca', 'falta de saliva', 'sede constante', 'boca amarga'],
      referencias: ['FEIO, Madalena; SAPETA, Paula. Xerostomia em cuidados paliativos. 2005.'],
    },
  ];

  /* =============================================================== Triagem === */
  async function triagem(main, ctx) {
    const selecionados = new Set();
    const selecionadosAlerta = new Set();
    let textoBusca = '';

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
          ${DADOS_CLINICOS.map(cardHtml).join('')}
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
