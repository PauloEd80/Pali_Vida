/**
 * Autenticação — porta de screens/LoginScreen.tsx e screens/CadastroScreen.tsx.
 */
window.PV = window.PV || {};
window.PV.screens = window.PV.screens || {};

(function () {
  const { escaparHtml, header, aviso, spinner, chips, ligarChips, GENEROS, TIPOS_SANGUINEOS, svgLogo } = PV.ui;

  /* ============================================================== Login === */
  async function login(main, ctx) {
    let modoRecuperar = false;

    function template() {
      if (modoRecuperar) {
        return `
          ${header()}
          <div class="tela-auth">
            <div class="pv-marca">${svgLogo()}</div>
            <h1 class="titulo">Recuperar senha</h1>
            <p class="instrucao">Informe o e-mail cadastrado e enviaremos as instruções para redefinir a sua senha.</p>

            <label class="label" for="rec-email">E-mail</label>
            <input class="campo" id="rec-email" type="email" placeholder="seuemail@exemplo.com" autocomplete="off">

            <div class="aviso-wrap" id="rec-aviso"></div>

            <button class="botao-entrar largo" id="rec-enviar" type="button">Enviar</button>
            <button class="link-secundario" id="rec-voltar" type="button"><span class="link-voltar">Voltar ao login</span></button>
          </div>`;
      }

      return `
        ${header()}
        <div class="tela-auth">
          <div class="pv-marca">${svgLogo()}</div>
          <h1 class="titulo">Entrar</h1>

          <label class="label" for="login-email">E-mail</label>
          <input class="campo" id="login-email" type="email" placeholder="Digite o seu e-mail" autocomplete="off" value="${escaparHtml(ctx.query.email || '')}">

          <label class="label" for="login-senha">Senha</label>
          <input class="campo" id="login-senha" type="password" placeholder="Digite a sua senha">

          <button class="link-secundario" id="link-esqueci" type="button"><span class="link-esqueci">Esqueci minha senha</span></button>

          <div class="aviso-wrap" id="login-aviso"></div>

          <button class="botao-entrar" id="btn-entrar" type="button">Entrar</button>
          <button class="link-secundario" id="link-cadastro" type="button" style="justify-content:center;width:230px"><span class="ou-cadastre">ou Cadastre-se</span></button>

          <div class="pv-nota-demo">
            Site de demonstração do PaliVida — não é o app oficial. Contas de teste (senha <code>palivida123</code>):
            <br>
            <button type="button" data-conta="paciente@palivida.local">paciente@palivida.local</button> ·
            <button type="button" data-conta="cuidador@palivida.local">cuidador@palivida.local</button> ·
            <button type="button" data-conta="admin@palivida.local">admin@palivida.local</button>
          </div>
        </div>`;
    }

    function montar() {
      main.innerHTML = template();

      if (modoRecuperar) {
        main.querySelector('#rec-voltar').addEventListener('click', () => {
          modoRecuperar = false;
          montar();
        });
        main.querySelector('#rec-enviar').addEventListener('click', async () => {
          const email = main.querySelector('#rec-email').value.trim();
          const alvoAviso = main.querySelector('#rec-aviso');
          const botao = main.querySelector('#rec-enviar');
          if (!email) {
            alvoAviso.innerHTML = aviso({ tipo: 'erro', texto: 'Informe o e-mail cadastrado.' });
            return;
          }
          alvoAviso.innerHTML = '';
          botao.disabled = true;
          botao.innerHTML = spinner(true);
          try {
            await PV.db.auth.recuperarSenha(email);
            alvoAviso.innerHTML = aviso({
              tipo: 'sucesso',
              texto: 'Se este e-mail estiver cadastrado, enviaremos as instruções para redefinir a senha.',
            });
          } catch (e) {
            alvoAviso.innerHTML = aviso({ tipo: 'erro', texto: e.message || 'Não foi possível enviar o e-mail.' });
          } finally {
            botao.disabled = false;
            botao.textContent = 'Enviar';
          }
        });
        return;
      }

      main.querySelector('#link-esqueci').addEventListener('click', () => {
        modoRecuperar = true;
        montar();
      });
      main.querySelector('#link-cadastro').addEventListener('click', () => PV.router.navegar('/cadastro'));

      main.querySelectorAll('[data-conta]').forEach((btn) => {
        btn.addEventListener('click', () => {
          main.querySelector('#login-email').value = btn.dataset.conta;
          main.querySelector('#login-senha').value = 'palivida123';
          entrar();
        });
      });

      const campoEmail = main.querySelector('#login-email');
      const campoSenha = main.querySelector('#login-senha');
      campoEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') entrar();
      });
      campoSenha.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') entrar();
      });
      main.querySelector('#btn-entrar').addEventListener('click', entrar);

      async function entrar() {
        const email = main.querySelector('#login-email').value;
        const senha = main.querySelector('#login-senha').value;
        const alvoAviso = main.querySelector('#login-aviso');
        const botao = main.querySelector('#btn-entrar');

        if (!email || !senha) {
          alvoAviso.innerHTML = aviso({ tipo: 'erro', texto: 'Preencha e-mail e senha.' });
          return;
        }
        alvoAviso.innerHTML = '';
        botao.disabled = true;
        botao.innerHTML = spinner(true);
        try {
          const { token, user } = await PV.db.auth.login(email.trim(), senha);
          PV.session.salvarSessao({ token, usuario: user });
          PV.router.navegar(user.tipo === 'paciente' ? '/menu-sintomas' : '/home');
        } catch (e) {
          alvoAviso.innerHTML = aviso({ tipo: 'erro', texto: e.message || 'E-mail ou senha incorretos.' });
          botao.disabled = false;
          botao.textContent = 'Entrar';
        }
      }
    }

    montar();
  }

  /* ============================================================ Cadastro === */
  const FORM_INICIAL = {
    email: '', senha: '', confirmarSenha: '', nome: '', nome_social: '', telefone: '',
    genero: '', data_nascimento: '', cidade: '', estado: '', tipo_sanguineo: '',
    medicacao: '', condicoes_medicas: '', contato_emergencia: '', unidades_de_saude: '', relacionamento: '',
  };

  function formatarTelefone(v) {
    const d = v.replace(/\D/g, '');
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  }
  function formatarData(v) {
    const d = v.replace(/\D/g, '');
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4, 8)}`;
  }
  function paraISO(v) {
    const partes = v.split('/');
    if (partes.length !== 3 || partes[2].length !== 4) return v;
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }
  function validarCadastro(form, ehPaciente) {
    const obrigatorios = ehPaciente
      ? [['nome', 'Preencha o nome.'], ['telefone', 'Preencha o celular.'], ['genero', 'Selecione o gênero.'],
         ['data_nascimento', 'Preencha a data de nascimento.'], ['cidade', 'Preencha a cidade.'],
         ['estado', 'Preencha o estado.'], ['tipo_sanguineo', 'Selecione o tipo sanguíneo.'],
         ['contato_emergencia', 'Preencha o contato de emergência.'], ['email', 'Preencha o e-mail.'],
         ['senha', 'Preencha a senha.']]
      : [['nome', 'Preencha o nome completo.'], ['telefone', 'Preencha o telefone.'], ['genero', 'Selecione o gênero.'],
         ['data_nascimento', 'Preencha a data de nascimento.'], ['relacionamento', 'Preencha o relacionamento com o paciente.'],
         ['email', 'Preencha o e-mail.'], ['senha', 'Preencha a senha.']];

    for (const [campo, msg] of obrigatorios) {
      if (!String(form[campo] || '').trim()) return msg;
    }
    if (form.senha !== form.confirmarSenha) return 'As senhas não conferem.';
    return null;
  }

  async function cadastro(main, ctx) {
    let etapa = 1;
    let tipo = 'paciente';
    let form = { ...FORM_INICIAL };
    let enviando = false;
    let mensagem = null;

    function telaEtapa1() {
      return `
        ${header()}
        <div class="tela-auth tela-cadastro">
          <div class="pv-marca">${svgLogo()}</div>
          <h1 class="titulo">Cadastre-se</h1>
          <p class="subtitulo">Como você deseja se cadastrar?</p>
          <div class="botoes-tipo">
            <button class="botao-tipo" id="btn-paciente" type="button">Sou Paciente</button>
            <button class="botao-tipo" id="btn-cuidador" type="button">Sou Cuidador</button>
          </div>
          <button class="botao-voltar" id="btn-voltar-login" type="button" style="width:85%;max-width:480px">Voltar ao Login</button>
        </div>`;
    }

    function campoTexto(label, campo, opts = {}) {
      const { placeholder = '', tipo: tipoInput = 'text', maxlength = '' } = opts;
      return `
        <label class="campo-label" for="c-${campo}">${label}</label>
        <input class="campo" id="c-${campo}" type="${tipoInput}" placeholder="${escaparHtml(placeholder)}"
          ${maxlength ? `maxlength="${maxlength}"` : ''}
          value="${escaparHtml(form[campo])}">`;
    }

    function telaEtapa2() {
      const ehPaciente = tipo === 'paciente';
      return `
        ${header()}
        <div class="tela-auth tela-cadastro">
          <div class="pv-marca">${svgLogo()}</div>
          <h1 class="titulo">${ehPaciente ? 'Cadastro — Paciente' : 'Cadastro — Cuidador'}</h1>

          <div class="form">
            <div class="secao">Dados pessoais</div>
            ${campoTexto('Nome completo *', 'nome', { placeholder: 'Seu nome' })}
            ${campoTexto('Nome social', 'nome_social', { placeholder: 'Nome social (opcional)' })}
            ${campoTexto(ehPaciente ? 'Celular *' : 'Telefone *', 'telefone', { placeholder: '(00) 00000-0000', maxlength: 15 })}

            <span class="campo-label">Gênero *</span>
            ${chips('genero', GENEROS, form.genero)}

            ${campoTexto('Data de nascimento *', 'data_nascimento', { placeholder: 'DD/MM/AAAA', maxlength: 10 })}

            ${ehPaciente ? `
              <div class="secao">Localização</div>
              ${campoTexto('Cidade *', 'cidade', { placeholder: 'Sua cidade' })}
              ${campoTexto('Estado *', 'estado', { placeholder: 'Ex: SP, RJ, MG', maxlength: 2 })}

              <div class="secao">Informações médicas</div>
              <span class="campo-label">Tipo sanguíneo *</span>
              ${chips('tipo_sanguineo', TIPOS_SANGUINEOS, form.tipo_sanguineo)}

              <label class="campo-label" for="c-medicacao">Medicações em uso</label>
              <textarea class="campo" id="c-medicacao" placeholder="Liste os medicamentos em uso (opcional)">${escaparHtml(form.medicacao)}</textarea>

              <label class="campo-label" for="c-condicoes_medicas">Condições médicas</label>
              <textarea class="campo" id="c-condicoes_medicas" placeholder="Ex: diabetes, hipertensão (opcional)">${escaparHtml(form.condicoes_medicas)}</textarea>

              ${campoTexto('Contato de emergência *', 'contato_emergencia', { placeholder: 'Nome e telefone' })}
              ${campoTexto('Unidades de saúde', 'unidades_de_saude', { placeholder: 'Hospital / UBS (opcional)' })}
            ` : `
              ${campoTexto('Relacionamento com o paciente *', 'relacionamento', { placeholder: 'Ex: filho(a), cônjuge, amigo(a)' })}
            `}

            <div class="secao">Acesso</div>
            ${campoTexto('E-mail *', 'email', { placeholder: 'seuemail@exemplo.com', tipo: 'email' })}
            ${campoTexto('Senha *', 'senha', { placeholder: 'Crie uma senha', tipo: 'password' })}
            ${campoTexto('Confirmar senha *', 'confirmarSenha', { placeholder: 'Repita a senha', tipo: 'password' })}

            <p class="obrigatorio">* Campo obrigatório</p>
            <div id="cad-aviso">${aviso(mensagem)}</div>
          </div>

          <button class="botao-enviar" id="btn-finalizar" type="button">Finalizar cadastro</button>
          <button class="botao-voltar" id="btn-voltar-etapa" type="button">Voltar</button>
        </div>`;
    }

    function ligarCamposTexto() {
      Object.keys(form).forEach((campo) => {
        const el = main.querySelector(`#c-${campo}`);
        if (!el) return;
        el.addEventListener('input', () => {
          if (campo === 'telefone') el.value = formatarTelefone(el.value);
          if (campo === 'data_nascimento') el.value = formatarData(el.value);
          if (campo === 'estado') el.value = el.value.toUpperCase();
          form[campo] = el.value;
        });
      });
    }

    function montar() {
      if (etapa === 1) {
        main.innerHTML = telaEtapa1();
        main.querySelector('#btn-paciente').addEventListener('click', () => { tipo = 'paciente'; etapa = 2; montar(); });
        main.querySelector('#btn-cuidador').addEventListener('click', () => { tipo = 'acompanhante'; etapa = 2; montar(); });
        main.querySelector('#btn-voltar-login').addEventListener('click', () => PV.router.navegar('/login'));
        return;
      }

      main.innerHTML = telaEtapa2();
      ligarCamposTexto();
      ligarChips(main, 'genero', (v) => (form.genero = v));
      if (tipo === 'paciente') ligarChips(main, 'tipo_sanguineo', (v) => (form.tipo_sanguineo = v));

      main.querySelector('#btn-voltar-etapa').addEventListener('click', () => { etapa = 1; montar(); });
      main.querySelector('#btn-finalizar').addEventListener('click', enviar);
    }

    async function enviar() {
      if (enviando) return;
      const erroValidacao = validarCadastro(form, tipo === 'paciente');
      if (erroValidacao) {
        mensagem = { tipo: 'erro', texto: erroValidacao };
        main.querySelector('#cad-aviso').innerHTML = aviso(mensagem);
        return;
      }
      mensagem = null;
      enviando = true;
      const botao = main.querySelector('#btn-finalizar');
      botao.disabled = true;
      botao.innerHTML = spinner(true);

      try {
        if (tipo === 'paciente') {
          await PV.db.pacientes.criar({
            email: form.email.trim(), senha: form.senha, nome: form.nome.trim(), nome_social: form.nome_social,
            celular: form.telefone, genero: form.genero, data_nascimento: paraISO(form.data_nascimento),
            cidade: form.cidade, estado: form.estado.toUpperCase(), tipo_sanguineo: form.tipo_sanguineo,
            medicacao: form.medicacao, condicoes_medicas: form.condicoes_medicas,
            contato_emergencia: form.contato_emergencia, unidades_de_saude: form.unidades_de_saude,
          });
        } else {
          await PV.db.acompanhantes.criar({
            email: form.email.trim(), senha: form.senha, nome_completo: form.nome.trim(),
            nome_social: form.nome_social, telefone: form.telefone, genero: form.genero,
            data_nascimento: paraISO(form.data_nascimento), relacionamento: form.relacionamento,
          });
        }
        PV.router.navegar('/login?email=' + encodeURIComponent(form.email.trim()));
      } catch (e) {
        mensagem = { tipo: 'erro', texto: e.message || 'Erro ao enviar. Tente novamente.' };
        main.querySelector('#cad-aviso').innerHTML = aviso(mensagem);
        botao.disabled = false;
        botao.textContent = 'Finalizar cadastro';
      } finally {
        enviando = false;
      }
    }

    montar();
  }

  PV.screens.login = login;
  PV.screens.cadastro = cadastro;
})();
