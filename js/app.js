// ==========================================================================
// APP.JS — Orquestrador das telas do morador (index.html)
// ==========================================================================

let moradorAtual = null;
let moradorIdEmVerificacao = null;
let tipoAgendamentoSelecionado = "avulso"; // "avulso" | "pacote"
let quantidadeHorariosDesejada = 1;
let horariosSelecionadosAvulso = []; // [{ data, horario, nomePaciente }]
let pacoteSelecionado = null;
let datasPacoteAjustaveis = []; // [{ data, horario }]
let agendamentoEmCheckout = null;
let mesCalendarioAtual = new Date();

function mostrarTela(idTela) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.remove("ativa"));
  document.getElementById(idTela).classList.add("ativa");
  window.scrollTo(0, 0);
}

// --------------------------------------------------------------------------
// Inicialização
// --------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  configurarEventosCadastro();
  configurarEventosLogin();
  configurarEventosVerificacao();
  configurarEventosCalendario();
  configurarEventosCheckout();
  configurarEventosHistorico();

  document.getElementById("botao-ir-para-login").addEventListener("click", () => {
    mostrarTela("tela-login-morador");
  });
  document.getElementById("botao-ir-para-cadastro").addEventListener("click", () => {
    mostrarTela("tela-cadastro");
  });

  auth.onAuthStateChanged(async (usuario) => {
    if (!usuario) {
      mostrarTela("tela-cadastro");
      return;
    }
    const morador = await obterSessaoMorador();
    if (morador) {
      moradorAtual = morador;
      await iniciarTelaCalendario();
    } else {
      mostrarTela("tela-cadastro");
    }
  });
});

// --------------------------------------------------------------------------
// Tela: Cadastro
// --------------------------------------------------------------------------

function configurarEventosCadastro() {
  const form = document.getElementById("form-cadastro");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = document.getElementById("botao-enviar-cadastro");
    const nome = document.getElementById("input-nome").value;
    const casa = document.getElementById("input-casa").value;
    const telefone = document.getElementById("input-telefone").value;
    const email = document.getElementById("input-email").value;
    const senha = document.getElementById("input-senha").value;

    botao.disabled = true;
    botao.textContent = "Criando...";

    try {
      const moradorId = await iniciarCadastroMorador(nome, casa, telefone, email, senha);
      moradorIdEmVerificacao = moradorId;
      document.getElementById("texto-email-enviado").textContent =
        `Enviamos um código para ${email}.`;
      mostrarTela("tela-verificacao");
      document.querySelector(".campo-codigo").focus();
    } catch (erro) {
      mostrarToast(traduzirErroFirebase(erro));
    } finally {
      botao.disabled = false;
      botao.textContent = "Criar cadastro";
    }
  });
}

// --------------------------------------------------------------------------
// Tela: Login (morador já cadastrado)
// --------------------------------------------------------------------------

function configurarEventosLogin() {
  const form = document.getElementById("form-login-morador");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = document.getElementById("botao-fazer-login");
    const email = document.getElementById("input-email-login").value;
    const senha = document.getElementById("input-senha-login").value;

    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
      const morador = await loginMorador(email, senha);
      moradorAtual = morador;
      await iniciarTelaCalendario();
    } catch (erro) {
      if (erro.message === "PRECISA_VERIFICAR") {
        moradorIdEmVerificacao = erro.moradorId;
        document.getElementById("texto-email-enviado").textContent =
          "Reenviamos um código para o seu email.";
        mostrarTela("tela-verificacao");
      } else {
        mostrarToast(traduzirErroFirebase(erro));
      }
    } finally {
      botao.disabled = false;
      botao.textContent = "Entrar";
    }
  });
}

/** Traduz mensagens de erro comuns do Firebase Auth pra português amigável */
function traduzirErroFirebase(erro) {
  const codigo = erro.code || "";
  if (codigo.includes("email-already-in-use")) return "Esse email já tem cadastro. Tente fazer login.";
  if (codigo.includes("wrong-password") || codigo.includes("invalid-credential")) return "Email ou senha incorretos.";
  if (codigo.includes("user-not-found")) return "Não encontramos cadastro com esse email.";
  if (codigo.includes("weak-password")) return "Senha muito curta — use pelo menos 6 caracteres.";
  if (codigo.includes("invalid-email")) return "Digite um email válido.";
  return erro.message || "Algo deu errado. Tente novamente.";
}

// --------------------------------------------------------------------------
// Tela: Verificação de código
// --------------------------------------------------------------------------

function configurarEventosVerificacao() {
  const campos = Array.from(document.querySelectorAll(".campo-codigo"));

  campos.forEach((campo, indice) => {
    campo.addEventListener("input", () => {
      campo.value = campo.value.replace(/\D/g, "");
      if (campo.value && indice < campos.length - 1) {
        campos[indice + 1].focus();
      }
    });
    campo.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !campo.value && indice > 0) {
        campos[indice - 1].focus();
      }
    });
  });

  document.getElementById("botao-confirmar-codigo").addEventListener("click", async () => {
    const codigo = campos.map((c) => c.value).join("");
    if (codigo.length !== 6) {
      mostrarToast("Digite os 6 dígitos do código.");
      return;
    }

    const botao = document.getElementById("botao-confirmar-codigo");
    botao.disabled = true;
    botao.innerHTML = '<span class="spinner"></span>';

    try {
      const morador = await confirmarCodigoVerificacao(moradorIdEmVerificacao, codigo);
      moradorAtual = morador;
      await iniciarTelaCalendario();
    } catch (erro) {
      mostrarToast(erro.message || "Código incorreto.");
      campos.forEach((c) => (c.value = ""));
      campos[0].focus();
    } finally {
      botao.disabled = false;
      botao.textContent = "Confirmar";
    }
  });

  document.getElementById("botao-reenviar-codigo").addEventListener("click", async () => {
    try {
      await reenviarCodigoVerificacao(moradorIdEmVerificacao);
      mostrarToast("Novo código enviado!");
    } catch (erro) {
      mostrarToast("Não foi possível reenviar. Tente novamente em instantes.");
    }
  });
}

// --------------------------------------------------------------------------
// Tela: Calendário (avulso / pacote)
// --------------------------------------------------------------------------

async function iniciarTelaCalendario() {
  mostrarTela("tela-calendario");
  document.getElementById("saudacao-morador").textContent = `Olá, ${moradorAtual.nome.split(" ")[0]}!`;

  await recarregarTudoDisponibilidade();

  if (cacheConfigExame) {
    document.getElementById("valor-avulso-texto").textContent =
      `Valor por exame: ${formatarMoeda(cacheConfigExame.valorAvulso || 0)}`;
  }

  horariosSelecionadosAvulso = [];
  quantidadeHorariosDesejada = 1;
  atualizarTituloEscolhaData();
  desenharCabecalhoDiasSemana();
  desenharCalendarioAvulso();
  desenharListaPacotes();
}

function desenharCabecalhoDiasSemana() {
  const grade = document.getElementById("grade-dias-semana-avulso");
  grade.innerHTML = DIAS_SEMANA_PT
    .map((d) => `<div class="dia-semana-label">${d}</div>`)
    .join("");
}

function configurarEventosCalendario() {
  document.getElementById("aba-avulso").addEventListener("click", () => {
    tipoAgendamentoSelecionado = "avulso";
    document.getElementById("conteudo-avulso").classList.remove("oculto");
    document.getElementById("conteudo-pacote").classList.add("oculto");
    document.getElementById("aba-avulso").style.background = "var(--cor-petroleo-950)";
    document.getElementById("aba-avulso").style.color = "white";
    document.getElementById("aba-pacote").style.background = "";
    document.getElementById("aba-pacote").style.color = "";
  });

  document.getElementById("aba-pacote").addEventListener("click", () => {
    tipoAgendamentoSelecionado = "pacote";
    document.getElementById("conteudo-pacote").classList.remove("oculto");
    document.getElementById("conteudo-avulso").classList.add("oculto");
    document.getElementById("aba-pacote").style.background = "var(--cor-petroleo-950)";
    document.getElementById("aba-pacote").style.color = "white";
    document.getElementById("aba-avulso").style.background = "";
    document.getElementById("aba-avulso").style.color = "";
  });

  document.querySelectorAll("#grade-quantidade-horarios .slot-horario").forEach((botao) => {
    botao.addEventListener("click", () => {
      quantidadeHorariosDesejada = Number(botao.dataset.quantidade);
      document.querySelectorAll("#grade-quantidade-horarios .slot-horario").forEach((b) => b.classList.remove("selecionado"));
      botao.classList.add("selecionado");

      if (horariosSelecionadosAvulso.length > quantidadeHorariosDesejada) {
        horariosSelecionadosAvulso = horariosSelecionadosAvulso.slice(0, quantidadeHorariosDesejada);
      }
      atualizarTituloEscolhaData();
      desenharListaHorariosSelecionados();
    });
  });

  document.getElementById("botao-continuar-avulso").addEventListener("click", () => {
    if (horariosSelecionadosAvulso.length === 0) return;
    abrirCheckoutAvulso();
  });

  document.getElementById("botao-continuar-pacote").addEventListener("click", () => {
    abrirCheckoutPacote();
  });

  document.getElementById("botao-meus-agendamentos").addEventListener("click", abrirTelaHistorico);
}

function atualizarTituloEscolhaData() {
  const restantes = quantidadeHorariosDesejada - horariosSelecionadosAvulso.length;
  document.getElementById("titulo-escolha-data").textContent =
    restantes > 0
      ? `Escolha a data (faltam ${restantes} de ${quantidadeHorariosDesejada})`
      : `Todos os horários escolhidos`;
}

function desenharCalendarioAvulso() {
  const grade = document.getElementById("grade-calendario-avulso");
  grade.innerHTML = "";

  const ano = mesCalendarioAtual.getFullYear();
  const mes = mesCalendarioAtual.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDiasMes = new Date(ano, mes + 1, 0).getDate();

  for (let i = 0; i < primeiroDiaSemana; i++) {
    grade.innerHTML += `<div class="dia-celula vazio"></div>`;
  }

  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const dataISO = dataParaISO(new Date(ano, mes, dia));
    const disponivel = diaEstaDisponivel(dataISO) && diferencaDias(hojeISO(), dataISO) >= 0;
    const classe = disponivel ? "disponivel" : "indisponivel";

    grade.innerHTML += `<div class="dia-celula ${classe}" data-data="${dataISO}" tabindex="0">${dia}</div>`;
  }

  grade.querySelectorAll(".dia-celula.disponivel").forEach((celula) => {
    celula.addEventListener("click", () => selecionarDiaAvulso(celula.dataset.data));
  });
}

function selecionarDiaAvulso(dataISO) {
  document.querySelectorAll("#grade-calendario-avulso .dia-celula").forEach((c) => {
    c.classList.toggle("selecionado", c.dataset.data === dataISO);
  });

  const jaEscolhidosNesseDia = new Set(
    horariosSelecionadosAvulso.filter((h) => h.data === dataISO).map((h) => h.horario)
  );
  const slots = obterSlotsDisponiveisNoDia(dataISO).filter((s) => !jaEscolhidosNesseDia.has(s));
  const cardSlots = document.getElementById("card-slots-avulso");
  const grade = document.getElementById("grade-slots-avulso");

  document.getElementById("data-selecionada-avulso-texto").textContent = formatarDataExtensa(dataISO);

  if (slots.length === 0) {
    grade.innerHTML = `<p class="texto-secundario">Nenhum horário livre nesse dia.</p>`;
  } else {
    grade.innerHTML = slots
      .map((s) => `<div class="slot-horario" data-horario="${s}">${s}</div>`)
      .join("");

    grade.querySelectorAll(".slot-horario").forEach((slot) => {
      slot.addEventListener("click", () => {
        if (horariosSelecionadosAvulso.length >= quantidadeHorariosDesejada) {
          mostrarToast("Você já escolheu todos os horários necessários.");
          return;
        }
        horariosSelecionadosAvulso.push({ data: dataISO, horario: slot.dataset.horario, nomePaciente: "" });
        atualizarTituloEscolhaData();
        desenharListaHorariosSelecionados();
        selecionarDiaAvulso(dataISO);
      });
    });
  }

  cardSlots.classList.remove("oculto");
}

function desenharListaHorariosSelecionados() {
  const card = document.getElementById("card-horarios-selecionados");
  const lista = document.getElementById("lista-horarios-selecionados");
  const botaoContinuar = document.getElementById("botao-continuar-avulso");

  if (horariosSelecionadosAvulso.length === 0) {
    card.classList.add("oculto");
    botaoContinuar.classList.add("oculto");
    return;
  }

  card.classList.remove("oculto");
  document.getElementById("contador-horarios-texto").textContent =
    `${horariosSelecionadosAvulso.length} de ${quantidadeHorariosDesejada} horário(s) escolhido(s).`;

  lista.innerHTML = horariosSelecionadosAvulso
    .map(
      (h, indice) => `
      <div class="card-areia" style="margin-bottom:8px;">
        <div class="flex-entre">
          <strong>${formatarDataExtensa(h.data)} às ${h.horario}</strong>
          <button class="botao-texto" data-remover-horario="${indice}" style="background:none; border:none; color:var(--cor-coral-500); padding:0;">Remover</button>
        </div>
        <input
          type="text"
          placeholder="Nome do paciente (opcional, ex: filho/filha)"
          value="${h.nomePaciente || ""}"
          data-nome-paciente="${indice}"
          style="margin-top:8px; width:100%; padding:10px; border-radius:10px; border:1.5px solid #E2DACB; font-family: var(--fonte-corpo);"
        />
      </div>`
    )
    .join("");

  lista.querySelectorAll("[data-remover-horario]").forEach((botao) => {
    botao.addEventListener("click", () => {
      horariosSelecionadosAvulso.splice(Number(botao.dataset.removerHorario), 1);
      atualizarTituloEscolhaData();
      desenharListaHorariosSelecionados();
    });
  });

  lista.querySelectorAll("[data-nome-paciente]").forEach((input) => {
    input.addEventListener("input", () => {
      horariosSelecionadosAvulso[Number(input.dataset.nomePaciente)].nomePaciente = input.value;
    });
  });

  if (horariosSelecionadosAvulso.length === quantidadeHorariosDesejada) {
    botaoContinuar.classList.remove("oculto");
  } else {
    botaoContinuar.classList.add("oculto");
  }
}

function desenharListaPacotes() {
  const lista = document.getElementById("lista-pacotes");
  const pacotes = (cacheConfigExame && cacheConfigExame.pacotes) || [];

  if (pacotes.length === 0) {
    lista.innerHTML = `<p class="texto-secundario">Nenhum pacote disponível no momento.</p>`;
    return;
  }

  lista.innerHTML = pacotes
    .map(
      (p) => `
      <div class="card-areia" style="margin-bottom:10px; cursor:pointer;" data-pacote-id="${p.id}">
        <div class="flex-entre">
          <h3>${p.nome}</h3>
          <span class="numero-destaque" style="font-size:1.3rem;">${formatarMoeda(p.valorTotal)}</span>
        </div>
        <p class="texto-secundario" style="margin-top:4px;">
          ${p.qtdExames} exames · a cada ${p.intervaloMeses} meses · pagamento único
        </p>
      </div>`
    )
    .join("");

  lista.querySelectorAll("[data-pacote-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const pacote = pacotes.find((p) => p.id === el.dataset.pacoteId);
      selecionarPacote(pacote);
      lista.querySelectorAll("[data-pacote-id]").forEach((c) => (c.style.border = "none"));
      el.style.border = "2px solid var(--cor-petroleo-950)";
    });
  });
}

function selecionarPacote(pacote) {
  pacoteSelecionado = pacote;
  const sugestoes = sugerirDatasPacote(hojeISO(), pacote.qtdExames, pacote.intervaloMeses);

  datasPacoteAjustaveis = sugestoes.map((data) => {
    const slots = data ? obterSlotsDisponiveisNoDia(data) : [];
    return { data, horario: slots[0] || null };
  });

  desenharDatasPacote();
  document.getElementById("card-datas-pacote").classList.remove("oculto");
  document.getElementById("botao-continuar-pacote").classList.remove("oculto");
}

function desenharDatasPacote() {
  const container = document.getElementById("lista-datas-pacote");
  container.innerHTML = datasPacoteAjustaveis
    .map((d, indice) => {
      if (!d.data) {
        return `<div class="banner-alerta" style="margin-bottom:8px;">
          <strong>Exame ${indice + 1}:</strong> não encontramos data disponível automaticamente. Você poderá ajustar depois com a Dra.
        </div>`;
      }
      return `
        <div class="flex-entre" style="padding:10px 0; border-bottom:1px solid #EAE3D4;">
          <div>
            <strong>Exame ${indice + 1}</strong><br/>
            <span class="texto-secundario">${formatarDataExtensa(d.data)} · ${d.horario || "—"}</span>
          </div>
          <button class="botao-texto" data-indice="${indice}" style="background:none; border:none;">Alterar</button>
        </div>`;
    })
    .join("");

  container.querySelectorAll("[data-indice]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const indice = Number(botao.dataset.indice);
      const novaDataISO = window.prompt(
        "Digite a nova data no formato AAAA-MM-DD (apenas dias disponíveis serão aceitos):",
        datasPacoteAjustaveis[indice].data || hojeISO()
      );
      if (!novaDataISO) return;

      if (!diaEstaDisponivel(novaDataISO)) {
        mostrarToast("Essa data não está disponível. Escolha outra.");
        return;
      }

      const slots = obterSlotsDisponiveisNoDia(novaDataISO);
      datasPacoteAjustaveis[indice] = { data: novaDataISO, horario: slots[0] || null };
      desenharDatasPacote();
    });
  });
}

// --------------------------------------------------------------------------
// Checkout
// --------------------------------------------------------------------------

async function abrirCheckoutAvulso() {
  try {
    agendamentoEmCheckout = await criarAgendamentoAvulso(moradorAtual, horariosSelecionadosAvulso);
    preencherTelaCheckout("Exame avulso");
    mostrarTela("tela-checkout");
  } catch (erro) {
    mostrarToast("Não foi possível criar o agendamento. Tente novamente.");
  }
}

async function abrirCheckoutPacote() {
  if (!pacoteSelecionado) {
    mostrarToast("Escolha um pacote primeiro.");
    return;
  }
  const datasValidas = datasPacoteAjustaveis.filter((d) => d.data && d.horario);
  if (datasValidas.length === 0) {
    mostrarToast("Nenhuma data válida para esse pacote.");
    return;
  }

  try {
    agendamentoEmCheckout = await criarAgendamentoPacote(
      moradorAtual,
      pacoteSelecionado,
      datasValidas
    );
    preencherTelaCheckout(`Pacote: ${pacoteSelecionado.nome}`);
    mostrarTela("tela-checkout");
  } catch (erro) {
    mostrarToast("Não foi possível criar o agendamento. Tente novamente.");
  }
}

function preencherTelaCheckout(tipoTexto) {
  const card = document.getElementById("card-resumo-checkout");
  const datasHtml = agendamentoEmCheckout.datas
    .map((d) => {
      const sufixo = d.nomePaciente ? ` — ${d.nomePaciente}` : "";
      return `<li>${formatarDataExtensa(d.data)} às ${d.horario}${sufixo}</li>`;
    })
    .join("");

  card.innerHTML = `
    <h2>${tipoTexto}</h2>
    <ul style="padding-left:18px; margin: 10px 0;">${datasHtml}</ul>
    <div class="linha-divisoria"></div>
    <div class="flex-entre">
      <span>Total</span>
      <span class="numero-destaque" style="font-size:1.5rem;">${formatarMoeda(agendamentoEmCheckout.valorTotal)}</span>
    </div>
  `;

  const chavePix = (cacheConfigExame && cacheConfigExame.chavePix) || "—";
  document.getElementById("texto-chave-pix").textContent = chavePix;

  const mensagem = montarMensagemWhatsApp(moradorAtual, agendamentoEmCheckout, tipoTexto);
  const numeroWhats = (cacheConfigExame && cacheConfigExame.whatsappMedica) || "";
  document.getElementById("botao-whatsapp-confirmar").href = montarLinkWhatsApp(numeroWhats, mensagem);
}

function configurarEventosCheckout() {
  document.getElementById("botao-copiar-pix").addEventListener("click", async () => {
    const chave = document.getElementById("texto-chave-pix").textContent;
    const ok = await copiarParaAreaDeTransferencia(chave);
    mostrarToast(ok ? "Chave Pix copiada!" : "Não foi possível copiar. Copie manualmente.");
  });

  document.getElementById("botao-voltar-calendario").addEventListener("click", async () => {
    horariosSelecionadosAvulso = [];
    await iniciarTelaCalendario();
  });
}

// --------------------------------------------------------------------------
// Histórico (Meus exames)
// --------------------------------------------------------------------------

function configurarEventosHistorico() {
  document.getElementById("botao-voltar-do-historico").addEventListener("click", () => {
    mostrarTela("tela-calendario");
  });
}

async function abrirTelaHistorico() {
  mostrarTela("tela-meus-agendamentos");
  const lista = document.getElementById("lista-meus-agendamentos");
  lista.innerHTML = `<p class="texto-secundario">Carregando...</p>`;

  try {
    const agendamentos = await buscarAgendamentosDoMorador(moradorAtual.id);

    if (agendamentos.length === 0) {
      lista.innerHTML = `<p class="texto-secundario">Você ainda não tem exames marcados.</p>`;
      return;
    }

    lista.innerHTML = agendamentos.map((ag) => desenharCardAgendamento(ag)).join("");
  } catch (erro) {
    lista.innerHTML = `<p class="texto-secundario">Não foi possível carregar seu histórico.</p>`;
  }
}

function desenharCardAgendamento(agendamento) {
  const temConflito = (agendamento.datas || []).some((d) => d.status === "conflito");
  const seloPagamento =
    agendamento.statusPagamento === "pago"
      ? `<span class="selo selo-pago">Pago</span>`
      : agendamento.statusPagamento === "cancelado"
      ? `<span class="selo" style="background:#EAE3D4; color:var(--cor-grafite-500);">Cancelado</span>`
      : `<span class="selo selo-pendente">Pagamento pendente</span>`;

  const datasHtml = (agendamento.datas || [])
    .map((d) => {
      const statusTexto =
        d.status === "conflito"
          ? ` <span class="selo selo-conflito">Precisa remarcar</span>`
          : d.status === "cancelado"
          ? ` <span class="texto-secundario">(cancelado)</span>`
          : "";
      const sufixoPaciente = d.nomePaciente ? ` — ${d.nomePaciente}` : "";
      return `<li>${formatarDataExtensa(d.data)} às ${d.horario}${sufixoPaciente}${statusTexto}</li>`;
    })
    .join("");

  const bannerConflito = temConflito
    ? `<div class="banner-alerta" style="margin-top:10px;">
        <strong>Uma das suas datas precisa ser remarcada.</strong>
        <span>A Dra. teve um imprevisto nesse horário. Entre em contato pelo WhatsApp pra ajustar.</span>
      </div>`
    : "";

  return `
    <div class="card" style="margin-bottom:12px;">
      <div class="flex-entre">
        <h3>${agendamento.tipo === "pacote" ? "Pacote" : "Exame avulso"}</h3>
        ${seloPagamento}
      </div>
      <ul style="padding-left:18px; margin:10px 0;">${datasHtml}</ul>
      <div class="flex-entre">
        <span class="texto-secundario">Total</span>
        <strong>${formatarMoeda(agendamento.valorTotal)}</strong>
      </div>
      ${bannerConflito}
    </div>
  `;
}
