/**
 * Prontuário — porta de screens/perfil/index.tsx + PerfilPaciente.tsx +
 * PerfilAcompanhante.tsx + PerfilAdministrador.tsx + campos.tsx.
 */
window.PV = window.PV || {};
window.PV.screens = window.PV.screens || {};

(function () {
  const { escaparHtml, header, aviso, spinner, selectOpcoes, GENEROS, TIPOS_SANGUINEOS, UFS } = PV.ui;

  const validar = {
    email: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()),
    telefone: (v) => !v || /^\d{10,11}$/.test(String(v).replace(/\D/g, '')),
    data: (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()),
  };
  const soData = (v) => (!v ? '' : String(v).split('T')[0].split(' ')[0].slice(0, 10));

  function campoTexto(id, label, valor, opts = {}) {
    const { placeholder = '', tipo = 'text', multiline = false } = opts;
    const attrs = `id="${id}" placeholder="${escaparHtml(placeholder)}"`;
    return `
      <label class="pv-campo-label" for="${id}">${escaparHtml(label)}</label>
      ${multiline
        ? `<textarea class="pv-campo-input" ${attrs}>${escaparHtml(valor)}</textarea>`
        : `<input class="pv-campo-input" type="${tipo}" ${attrs} value="${escaparHtml(valor)}">`}`;
  }

  function campoSelecao(id, label, valor, opcoes, placeholder) {
    return `
      <label class="pv-campo-label" for="${id}">${escaparHtml(label)}</label>
      <select class="pv-campo-select" id="${id}">${selectOpcoes(opcoes, valor, placeholder || 'Selecione')}</select>`;
  }

  async function botaoSalvarAsync(botao, acao) {
    botao.disabled = true;
    const original = botao.textContent;
    botao.innerHTML = spinner(true);
    try {
      await acao();
    } finally {
      botao.disabled = false;
      botao.textContent = original;
    }
  }

  /* ======================================================= PerfilPaciente === */
  async function montarPerfilPaciente(container, id, avisar) {
    container.innerHTML = `<div class="pv-carregando" style="min-height:120px">${spinner()}</div>`;
    let dados, listaAcompanhantes;
    try {
      dados = await PV.db.pacientes.buscar(id);
      listaAcompanhantes = await PV.db.pacientes.acompanhantes(id);
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message || 'Não foi possível carregar seus dados.' });
      container.innerHTML = '';
      return;
    }

    const form = {
      nome: dados.nome || '', nome_social: dados.nome_social || '', email: dados.email || '', senha: '',
      celular: dados.celular || '', genero: dados.genero || '', data_nascimento: soData(dados.data_nascimento),
      cidade: dados.cidade || '', estado: dados.estado || '', tipo_sanguineo: dados.tipo_sanguineo || '',
      condicoes_medicas: dados.condicoes_medicas || '', medicacao: dados.medicacao || '',
      contato_emergencia: dados.contato_emergencia || '', unidades_de_saude: dados.unidades_de_saude || '',
    };

    container.innerHTML = `
      <div class="pv-card">
        <div class="subtitulo">Seus dados</div>
        ${campoTexto('pp-nome', 'Nome completo', form.nome)}
        ${campoTexto('pp-nome_social', 'Nome social (opcional)', form.nome_social)}
        ${campoTexto('pp-email', 'E-mail', form.email, { tipo: 'email' })}
        ${campoTexto('pp-senha', 'Senha', '', { tipo: 'password', placeholder: 'Deixe em branco para não alterar' })}
        ${campoTexto('pp-celular', 'Celular', form.celular, { placeholder: 'Somente números (com DDD)' })}
        ${campoSelecao('pp-genero', 'Gênero', form.genero, GENEROS, 'Selecione o gênero')}
        ${campoTexto('pp-data_nascimento', 'Data de nascimento', form.data_nascimento, { placeholder: 'AAAA-MM-DD' })}
        ${campoSelecao('pp-estado', 'Estado (UF)', form.estado, UFS, 'Selecione a UF')}
        ${campoTexto('pp-cidade', 'Cidade', form.cidade)}
        ${campoSelecao('pp-tipo_sanguineo', 'Tipo sanguíneo', form.tipo_sanguineo, TIPOS_SANGUINEOS)}
        ${campoTexto('pp-condicoes_medicas', 'Condições médicas (diagnóstico)', form.condicoes_medicas, { multiline: true })}
        ${campoTexto('pp-medicacao', 'Medicação', form.medicacao)}
        ${campoTexto('pp-contato_emergencia', 'Contato de emergência', form.contato_emergencia)}
        ${campoTexto('pp-unidades_de_saude', 'Unidades de saúde', form.unidades_de_saude)}
        <button type="button" class="pv-botao-primario" id="pp-salvar">Salvar</button>
      </div>

      <div class="pv-card">
        <div class="subtitulo">Meus acompanhantes</div>
        <div id="pp-acompanhantes"></div>
      </div>`;

    function renderAcompanhantes() {
      const alvo = container.querySelector('#pp-acompanhantes');
      if (!listaAcompanhantes.length) {
        alvo.innerHTML = `<span class="pv-campo-label">Você ainda não tem acompanhantes vinculados.</span>`;
        return;
      }
      alvo.innerHTML = listaAcompanhantes.map((a) => `
        <div class="pv-item-vinculo" data-id="${a.id}">
          <div class="subtitulo" style="font-size:16px">${escaparHtml(a.nome_completo || '(sem nome)')}</div>
          <span class="pv-campo-label">${escaparHtml(a.email)}</span>
          <button type="button" class="pv-botao-perigo" data-remover="${a.id}">Remover vínculo</button>
        </div>`).join('');
      alvo.querySelectorAll('[data-remover]').forEach((b) => b.addEventListener('click', async () => {
        try {
          await PV.db.vinculos.remover(b.dataset.remover, id);
          listaAcompanhantes = listaAcompanhantes.filter((a) => String(a.id) !== b.dataset.remover);
          renderAcompanhantes();
          avisar({ tipo: 'sucesso', texto: 'Vínculo removido.' });
        } catch (e) {
          avisar({ tipo: 'erro', texto: e.message || 'Erro ao desvincular.' });
        }
      }));
    }
    renderAcompanhantes();

    container.querySelector('#pp-salvar').addEventListener('click', async () => {
      const v = (campo) => container.querySelector('#pp-' + campo).value;
      const novoForm = {
        nome: v('nome'), nome_social: v('nome_social'), email: v('email'), senha: v('senha'),
        celular: v('celular'), genero: v('genero'), data_nascimento: v('data_nascimento'),
        cidade: v('cidade'), estado: v('estado'), tipo_sanguineo: v('tipo_sanguineo'),
        condicoes_medicas: v('condicoes_medicas'), medicacao: v('medicacao'),
        contato_emergencia: v('contato_emergencia'), unidades_de_saude: v('unidades_de_saude'),
      };
      if (!validar.email(novoForm.email)) return avisar({ tipo: 'erro', texto: 'E-mail inválido. Use o formato algo@dominio.com' });
      if (!validar.telefone(novoForm.celular)) return avisar({ tipo: 'erro', texto: 'Celular inválido (10 ou 11 dígitos, com DDD).' });
      if (!validar.data(novoForm.data_nascimento)) return avisar({ tipo: 'erro', texto: 'Data inválida. Use o formato AAAA-MM-DD.' });

      await botaoSalvarAsync(container.querySelector('#pp-salvar'), async () => {
        try {
          await PV.db.pacientes.atualizar(id, {
            ...novoForm, senha: novoForm.senha || null,
            estado: novoForm.estado ? novoForm.estado.toUpperCase() : null,
            tipo_sanguineo: novoForm.tipo_sanguineo || null,
          });
          container.querySelector('#pp-senha').value = '';
          avisar({ tipo: 'sucesso', texto: 'Seus dados foram atualizados!' });
        } catch (e) {
          avisar({ tipo: 'erro', texto: e.message || 'Erro ao atualizar.' });
        }
      });
    });
  }

  /* =================================================== PerfilAcompanhante === */
  function camposCompletosPacienteHtml(pid, p) {
    return `
      <div style="margin-top:12px" data-detalhes="${pid}">
        ${campoTexto(`pa-nome-${pid}`, 'Nome completo', p.nome || '')}
        ${campoTexto(`pa-nome_social-${pid}`, 'Nome social', p.nome_social || '')}
        ${campoTexto(`pa-email-${pid}`, 'E-mail', p.email || '', { tipo: 'email' })}
        ${campoTexto(`pa-celular-${pid}`, 'Celular', p.celular || '')}
        ${campoSelecao(`pa-genero-${pid}`, 'Gênero', p.genero || '', GENEROS)}
        ${campoTexto(`pa-data_nascimento-${pid}`, 'Data de nascimento', soData(p.data_nascimento), { placeholder: 'AAAA-MM-DD' })}
        ${campoTexto(`pa-cidade-${pid}`, 'Cidade', p.cidade || '')}
        ${campoSelecao(`pa-estado-${pid}`, 'Estado (UF)', p.estado || '', UFS, 'Selecione a UF')}
        ${campoSelecao(`pa-tipo_sanguineo-${pid}`, 'Tipo sanguíneo', p.tipo_sanguineo || '', TIPOS_SANGUINEOS)}
        ${campoTexto(`pa-condicoes_medicas-${pid}`, 'Condições médicas', p.condicoes_medicas || '', { multiline: true })}
        ${campoTexto(`pa-medicacao-${pid}`, 'Medicação', p.medicacao || '')}
        ${campoTexto(`pa-contato_emergencia-${pid}`, 'Contato de emergência', p.contato_emergencia || '')}
        ${campoTexto(`pa-unidades_de_saude-${pid}`, 'Unidades de saúde', p.unidades_de_saude || '')}
        <button type="button" class="pv-botao-secundario" data-salvar-paciente="${pid}">Atualizar dados do paciente</button>
      </div>`;
  }

  async function montarPerfilAcompanhante(container, id, avisar) {
    container.innerHTML = `<div class="pv-carregando" style="min-height:120px">${spinner()}</div>`;
    let dados, listaPacientes;
    try {
      dados = await PV.db.acompanhantes.buscar(id);
      listaPacientes = await PV.db.acompanhantes.pacientes(id);
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message || 'Não foi possível carregar seus dados.' });
      container.innerHTML = '';
      return;
    }

    const expandido = {};

    container.innerHTML = `
      <div class="pv-card">
        <div class="subtitulo">Seus dados</div>
        ${campoTexto('pa-nome_completo', 'Nome completo', dados.nome_completo || '')}
        ${campoTexto('pa-nome_social', 'Nome social', dados.nome_social || '')}
        ${campoTexto('pa-email', 'E-mail', dados.email || '', { tipo: 'email' })}
        ${campoTexto('pa-senha', 'Senha', '', { tipo: 'password', placeholder: 'Deixe em branco para não alterar' })}
        ${campoTexto('pa-telefone', 'Telefone', dados.telefone || '', { placeholder: 'Somente números (com DDD)' })}
        ${campoSelecao('pa-genero', 'Gênero', dados.genero || '', GENEROS, 'Selecione o gênero')}
        ${campoTexto('pa-data_nascimento', 'Data de nascimento', soData(dados.data_nascimento), { placeholder: 'AAAA-MM-DD' })}
        <button type="button" class="pv-botao-primario" id="pa-salvar">Salvar</button>
      </div>

      <div class="pv-card">
        <div class="subtitulo">Vínculos com pacientes</div>
        ${campoTexto('pa-codigo', 'Vincular por código do paciente', '', { placeholder: 'Digite o código do seu paciente' })}
        <button type="button" class="pv-botao-secundario" id="pa-vincular">Vincular</button>

        <div class="subtitulo" style="margin-top:16px">Meus pacientes</div>
        <div id="pa-pacientes"></div>
      </div>`;

    function renderPacientes() {
      const alvo = container.querySelector('#pa-pacientes');
      if (!listaPacientes.length) {
        alvo.innerHTML = `<span class="pv-campo-label">Nenhum vínculo ainda.</span>`;
        return;
      }
      alvo.innerHTML = listaPacientes.map((p) => `
        <div class="pv-item-vinculo" data-paciente="${p.id}">
          <div class="subtitulo" style="font-size:16px">${escaparHtml(p.nome || '(sem nome)')} — Código: ${p.id}</div>
          <span class="pv-campo-label">${escaparHtml(p.email)}</span>
          <button type="button" class="pv-botao-secundario" data-ver="${p.id}">Ver dados completos</button>
          <div data-slot-detalhes="${p.id}"></div>
          <button type="button" class="pv-botao-perigo" data-desvincular="${p.id}">Remover vínculo</button>
        </div>`).join('');

      alvo.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', async () => {
        const pid = b.dataset.ver;
        const slot = alvo.querySelector(`[data-slot-detalhes="${pid}"]`);
        if (expandido[pid]) {
          expandido[pid] = null;
          slot.innerHTML = '';
          b.textContent = 'Ver dados completos';
          return;
        }
        try {
          const p = await PV.db.pacientes.buscar(pid);
          expandido[pid] = p;
          slot.innerHTML = camposCompletosPacienteHtml(pid, p);
          b.textContent = 'Ocultar dados';
          slot.querySelector(`[data-salvar-paciente="${pid}"]`).addEventListener('click', async () => {
            const campo = (nome) => container.querySelector(`#pa-${nome}-${pid}`).value;
            const atualizado = {
              ...p,
              nome: campo('nome'), nome_social: campo('nome_social'), email: campo('email'), celular: campo('celular'),
              genero: campo('genero'), data_nascimento: campo('data_nascimento'), cidade: campo('cidade'),
              estado: campo('estado'), tipo_sanguineo: campo('tipo_sanguineo'), condicoes_medicas: campo('condicoes_medicas'),
              medicacao: campo('medicacao'), contato_emergencia: campo('contato_emergencia'), unidades_de_saude: campo('unidades_de_saude'),
              senha: null,
            };
            try {
              await PV.db.pacientes.atualizar(pid, atualizado);
              avisar({ tipo: 'sucesso', texto: 'Dados do paciente atualizados!' });
            } catch (e) {
              avisar({ tipo: 'erro', texto: e.message || 'Erro ao atualizar paciente.' });
            }
          });
        } catch (e) {
          avisar({ tipo: 'erro', texto: e.message || 'Não foi possível carregar o paciente.' });
        }
      }));

      alvo.querySelectorAll('[data-desvincular]').forEach((b) => b.addEventListener('click', async () => {
        try {
          await PV.db.vinculos.remover(id, b.dataset.desvincular);
          listaPacientes = listaPacientes.filter((p) => String(p.id) !== b.dataset.desvincular);
          renderPacientes();
          avisar({ tipo: 'sucesso', texto: 'Vínculo removido.' });
        } catch (e) {
          avisar({ tipo: 'erro', texto: e.message || 'Falha ao desvincular.' });
        }
      }));
    }
    renderPacientes();

    container.querySelector('#pa-salvar').addEventListener('click', async () => {
      const v = (campo) => container.querySelector('#pa-' + campo).value;
      const novoForm = {
        nome_completo: v('nome_completo'), nome_social: v('nome_social'), email: v('email'), senha: v('senha'),
        telefone: v('telefone'), genero: v('genero'), data_nascimento: v('data_nascimento'),
      };
      if (!validar.email(novoForm.email)) return avisar({ tipo: 'erro', texto: 'E-mail inválido. Use o formato algo@dominio.com' });
      if (!validar.telefone(novoForm.telefone)) return avisar({ tipo: 'erro', texto: 'Telefone inválido (10 ou 11 dígitos, com DDD).' });

      await botaoSalvarAsync(container.querySelector('#pa-salvar'), async () => {
        try {
          await PV.db.acompanhantes.atualizar(id, { ...novoForm, senha: novoForm.senha || null, data_nascimento: soData(novoForm.data_nascimento) || null });
          container.querySelector('#pa-senha').value = '';
          avisar({ tipo: 'sucesso', texto: 'Seus dados foram atualizados.' });
        } catch (e) {
          avisar({ tipo: 'erro', texto: e.message || 'Erro ao atualizar.' });
        }
      });
    });

    container.querySelector('#pa-vincular').addEventListener('click', async () => {
      const campo = container.querySelector('#pa-codigo');
      const pacienteId = Number(campo.value);
      if (!pacienteId) return avisar({ tipo: 'erro', texto: 'Informe um código de paciente válido.' });
      try {
        await PV.db.vinculos.criar(pacienteId);
        campo.value = '';
        listaPacientes = await PV.db.acompanhantes.pacientes(id);
        renderPacientes();
        avisar({ tipo: 'sucesso', texto: 'Vínculo criado com sucesso.' });
      } catch (e) {
        avisar({ tipo: 'erro', texto: e.message || 'Falha ao vincular.' });
      }
    });
  }

  /* ================================================== PerfilAdministrador === */
  async function montarPerfilAdministrador(container, id, avisar) {
    container.innerHTML = `<div class="pv-carregando" style="min-height:120px">${spinner()}</div>`;
    let dados;
    try {
      dados = await PV.db.administradores.buscar(id);
    } catch (e) {
      avisar({ tipo: 'erro', texto: e.message || 'Não foi possível carregar seus dados.' });
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="pv-card">
        <div class="subtitulo">Seus dados</div>
        ${campoTexto('pd-nome', 'Nome completo', dados.nome || '')}
        ${campoTexto('pd-nome_social', 'Nome social (opcional)', dados.nome_social || '')}
        ${campoTexto('pd-email', 'E-mail', dados.email || '', { tipo: 'email' })}
        ${campoTexto('pd-senha', 'Senha', '', { tipo: 'password', placeholder: 'Deixe em branco para não alterar' })}
        ${campoTexto('pd-telefone', 'Telefone', dados.telefone || '', { placeholder: 'Somente números (com DDD)' })}
        ${campoSelecao('pd-genero', 'Gênero', dados.genero || '', GENEROS, 'Selecione o gênero')}
        ${campoTexto('pd-data_nascimento', 'Data de nascimento', soData(dados.data_nascimento), { placeholder: 'AAAA-MM-DD' })}
        ${campoTexto('pd-conselho_profissional', 'Conselho profissional', dados.conselho_profissional || '', { placeholder: 'Ex: CRM, CRP' })}
        ${campoTexto('pd-formacao', 'Formação', dados.formacao || '', { placeholder: 'Ex: Medicina, Psicologia' })}
        ${campoTexto('pd-registro_profissional', 'Registro profissional', dados.registro_profissional || '')}
        ${campoTexto('pd-especialidade', 'Especialidade', dados.especialidade || '', { placeholder: 'Ex: Oncologia' })}
        <button type="button" class="pv-botao-primario" id="pd-salvar">Salvar</button>
      </div>`;

    container.querySelector('#pd-salvar').addEventListener('click', async () => {
      const v = (campo) => container.querySelector('#pd-' + campo).value;
      const novoForm = {
        nome: v('nome'), nome_social: v('nome_social'), email: v('email'), senha: v('senha'), telefone: v('telefone'),
        genero: v('genero'), data_nascimento: v('data_nascimento'), conselho_profissional: v('conselho_profissional'),
        formacao: v('formacao'), registro_profissional: v('registro_profissional'), especialidade: v('especialidade'),
      };
      if (!validar.email(novoForm.email)) return avisar({ tipo: 'erro', texto: 'E-mail inválido. Use o formato algo@dominio.com' });
      if (!validar.telefone(novoForm.telefone)) return avisar({ tipo: 'erro', texto: 'Telefone inválido (10 ou 11 dígitos, com DDD).' });

      await botaoSalvarAsync(container.querySelector('#pd-salvar'), async () => {
        try {
          await PV.db.administradores.atualizar(id, { ...novoForm, senha: novoForm.senha || null, data_nascimento: soData(novoForm.data_nascimento) || null });
          container.querySelector('#pd-senha').value = '';
          avisar({ tipo: 'sucesso', texto: 'Seus dados foram atualizados.' });
        } catch (e) {
          avisar({ tipo: 'erro', texto: e.message || 'Erro ao atualizar.' });
        }
      });
    });
  }

  /* ============================================================= dispatcher === */
  async function perfil(main, ctx) {
    main.innerHTML = `
      ${header()}
      <div class="tela-perfil">
        <h1 class="titulo">Prontuário</h1>
        <div id="perfil-aviso"></div>

        <div class="pv-card">
          <div class="subtitulo">Seu código</div>
          <input class="pv-campo-input pv-codigo-readonly" value="${ctx.usuario.id}" readonly>
        </div>

        <div id="perfil-variante"></div>

        <div class="pv-card">
          <button type="button" class="pv-botao-logout" id="btn-sair">Sair da conta</button>
          <button type="button" class="pv-botao-secundario" id="btn-resetar" style="background:none;color:var(--cinza-claro);box-shadow:none;text-decoration:underline;margin-top:18px">Restaurar dados de demonstração</button>
        </div>
      </div>`;

    const avisoEl = main.querySelector('#perfil-aviso');
    const avisar = (m) => { avisoEl.innerHTML = aviso(m); };
    const slot = main.querySelector('#perfil-variante');

    // Ligados já aqui (antes do await abaixo): "Sair" e "Restaurar dados" não
    // dependem dos dados da variante terminarem de carregar, e o usuário
    // pode clicar neles enquanto isso ainda está em andamento.
    main.querySelector('#btn-sair').addEventListener('click', () => {
      PV.session.limparSessao();
      PV.router.navegar('/login');
    });
    main.querySelector('#btn-resetar').addEventListener('click', () => {
      if (!confirm('Isso apaga tudo que foi alterado nesta demonstração (cadastros novos, registros, conteúdos) e volta aos dados iniciais. Continuar?')) return;
      PV.db.resetarDados();
      PV.session.limparSessao();
      PV.router.navegar('/login');
    });

    if (ctx.usuario.tipo === 'paciente') await montarPerfilPaciente(slot, ctx.usuario.id, avisar);
    else if (ctx.usuario.tipo === 'acompanhante') await montarPerfilAcompanhante(slot, ctx.usuario.id, avisar);
    else if (ctx.usuario.tipo === 'administrador') await montarPerfilAdministrador(slot, ctx.usuario.id, avisar);
  }

  PV.screens.perfil = perfil;
})();
