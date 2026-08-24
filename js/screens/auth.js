/**
 * Autenticação — porta de screens/LoginScreen.tsx e screens/CadastroScreen.tsx.
 */
window.PV = window.PV || {};
window.PV.screens = window.PV.screens || {};

(function () {
  const { escaparHtml, headerLogin, aviso, spinner } = PV.ui;

  /* ============================================================== Login === */
  async function login(main, ctx) {
    let modoRecuperar = false;

    function template() {
      if (modoRecuperar) {
        return `
          ${headerLogin()}
          <div class="tela-auth">
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
        ${headerLogin()}
        <div class="tela-auth">
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

  /* ============================================================ Cadastro ===
     Cadastro simplificado: uma tela inicial com um único botão para começar
     (sem perguntar "paciente ou cuidador?") e um formulário curto com só o
     essencial para criar o acesso — Nome completo, nome social, telefone,
     e-mail e senha (com confirmação). Os demais dados (saúde, contatos,
     equipe de cuidado etc.) ficam para depois, preenchidos pelo próprio
     usuário no Prontuário Eletrônico (ver js/screens/perfil.js), que já
     funciona em etapas e aceita campos em branco. Todo novo cadastro entra
     como paciente (PV.db.pacientes) — quem cuida de outra pessoa também
     usa o mesmo cadastro e depois vincula/edita o prontuário de quem
     acompanha a partir daí. */
  const FORM_INICIAL = { email: '', senha: '', confirmarSenha: '', nome: '', nome_social: '', telefone: '' };

  function formatarTelefone(v) {
    const d = v.replace(/\D/g, '');
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  }
  function validarCadastro(form) {
    const obrigatorios = [
      ['nome', 'Preencha o nome completo.'],
      ['telefone', 'Preencha o telefone.'],
      ['email', 'Preencha o e-mail.'],
      ['senha', 'Preencha a senha.'],
    ];
    for (const [campo, msg] of obrigatorios) {
      if (!String(form[campo] || '').trim()) return msg;
    }
    if (form.senha.length < 6) return 'A senha precisa ter ao menos 6 caracteres.';
    if (form.senha !== form.confirmarSenha) return 'As senhas não conferem.';
    return null;
  }

  async function cadastro(main, ctx) {
    let etapa = 1;
    let form = { ...FORM_INICIAL };
    let enviando = false;
    let mensagem = null;

    function telaEtapa1() {
      return `
        ${headerLogin()}
        <div class="tela-auth tela-cadastro">
          <h1 class="titulo">Cadastre-se</h1>
          <p class="subtitulo" style="max-width:340px;margin-left:auto;margin-right:auto;font-style:italic;font-weight:400">Os demais dados (saúde, contatos, equipe de cuidado) você preenche depois, com calma, no Prontuário Eletrônico.</p>
          <button class="botao-enviar" id="btn-iniciar" type="button" style="width:85%;max-width:480px">Iniciar meu cadastro</button>
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
      return `
        ${headerLogin()}
        <div class="tela-auth tela-cadastro">
          <h1 class="titulo">Criar acesso</h1>

          <div class="form">
            ${campoTexto('Nome completo *', 'nome', { placeholder: 'Seu nome' })}
            ${campoTexto('Nome social', 'nome_social', { placeholder: 'Nome social (opcional)' })}
            ${campoTexto('Telefone *', 'telefone', { placeholder: '(00) 00000-0000', maxlength: 15 })}
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
          form[campo] = el.value;
        });
      });
    }

    function montar() {
      if (etapa === 1) {
        main.innerHTML = telaEtapa1();
        main.querySelector('#btn-iniciar').addEventListener('click', () => { etapa = 2; montar(); });
        main.querySelector('#btn-voltar-login').addEventListener('click', () => PV.router.navegar('/login'));
        return;
      }

      main.innerHTML = telaEtapa2();
      ligarCamposTexto();

      main.querySelector('#btn-voltar-etapa').addEventListener('click', () => { etapa = 1; montar(); });
      main.querySelector('#btn-finalizar').addEventListener('click', enviar);
    }

    async function enviar() {
      if (enviando) return;
      const erroValidacao = validarCadastro(form);
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
        await PV.db.pacientes.criar({
          email: form.email.trim(), senha: form.senha, nome: form.nome.trim(),
          nome_social: form.nome_social, celular: form.telefone,
        });
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
