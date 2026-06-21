// ==========================================================================
// PAINEL-APP.JS — Orquestrador das telas da médica (painel.html)
// ==========================================================================

function mostrarTelaPainel(idTela) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.remove("ativa"));
  document.getElementById(idTela).classList.add("ativa");
  document.querySelectorAll(".nav-item").forEach((n) => {
    n.classList.toggle("ativo", n.dataset.tela === idTela);
  });
  window.scrollTo(0, 0);
}

document.addEventListener("DOMContentLoaded", () => {
  configurarLogin();
  configurarNavegacaoInferior();
  configurarImportacaoPlantoes();
  configurarBloqueios();
  configurarConfiguracoes();
  configurarNavegacaoCalendarioPainel();

  auth.onAuthStateChanged(async (usuario) => {
    if (usuario) {
      sessionStorage.setItem("piscinaVV_medica", "true");
      document.getElementById("nav-inferior-painel").classList.remove("oculto");
      await iniciarDashboard();
    }
  });
});

// --------------------------------------------------------------------------
// Login
// --------------------------------------------------------------------------

function configurarLogin() {
  document.getElementById("form-login-medica").addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = document.getElementById("botao-login-medica");
    const email = document.getElementById("input-email-medica").value;
    const senha = document.getElementById("input-senha-medica").value;

    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
      await loginMedica(email, senha);
      mostrarTelaPainel("tela-dashboard");
    } catch (erro) {
      mostrarToast("Email ou senha incorretos.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Entrar";
    }
  });

  document.getElementById("botao-sair").addEventListener("click", () => {
    logoutMedica();
    document.getElementById("nav-inferior-painel").classList.add("oculto");
    mostrarTelaPainel("tela-login-medica");
  });
}

function configurarNavegacaoInferior() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", async () => {
      mostrarTelaPainel(item.dataset.tela);
      if (item.dataset.tela === "tela-importar-plantoes") await atualizarListaPlantoesImportados();
      if (item.dataset.tela === "tela-bloqueios") await atualizarListaBloqueios();
      if (item.dataset.tela === "tela-config") await carregarTelaConfiguracoes();
      if (item.dataset.tela === "tela-dashboard") await iniciarDashboard();
    });
  });
}

// --------------------------------------------------------------------------
// Dashboard — Calendário mensal de agendamentos
// --------------------------------------------------------------------------

let mesPainelAtual = new Date();
let agendamentosPorDataCache = {};
let diaSelecionadoNoPainel = null;

async function iniciarDashboard() {
  try {
    const [agendamentosPorData, conflitos, moradores] = await Promise.all([
      agruparAgendamentosPorData(),
      listarAgendamentosEmConflito(),
      listarMoradoresCadastrados()
    ]);

    agendamentosPorDataCache = agendamentosPorData;

    const totalAgendamentos = Object.values(agendamentosPorData).reduce((soma, lista) => soma + lista.length, 0);
    document.getElementById("resumo-dashboard").textContent =
      `${totalAgendamentos} exame(s) marcado(s) · ${moradores.length} morador(es) cadastrado(s)`;

    desenharBannerConflitos(conflitos);
    desenharListaMoradores(moradores);
    desenharCalendarioPainel();

    document.getElementById("card-exames-do-dia").classList.add("oculto");
    diaSelecionadoNoPainel = null;
  } catch (erro) {
    mostrarToast("Não foi possível carregar o dashboard.");
  }
}

function configurarNavegacaoCalendarioPainel() {
  document.getElementById("botao-mes-anterior").addEventListener("click", () => {
    mesPainelAtual = new Date(mesPainelAtual.getFullYear(), mesPainelAtual.getMonth() - 1, 1);
    desenharCalendarioPainel();
  });

  document.getElementById("botao-mes-seguinte").addEventListener("click", () => {
    mesPainelAtual = new Date(mesPainelAtual.getFullYear(), mesPainelAtual.getMonth() + 1, 1);
    desenharCalendarioPainel();
  });
}

function desenharCalendarioPainel() {
  const grade = document.getElementById("grade-calendario-painel");
  const gradeSemana = document.getElementById("grade-dias-semana-painel");
  gradeSemana.innerHTML = DIAS_SEMANA_PT.map((d) => `<div class="dia-semana-label">${d}</div>`).join("");

  document.getElementById("titulo-mes-calendario").textContent =
    `${MESES_PT[mesPainelAtual.getMonth()].charAt(0).toUpperCase() + MESES_PT[mesPainelAtual.getMonth()].slice(1)} de ${mesPainelAtual.getFullYear()}`;

  grade.innerHTML = "";

  const ano = mesPainelAtual.getFullYear();
  const mes = mesPainelAtual.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
  const hoje = hojeISO();

  for (let i = 0; i < primeiroDiaSemana; i++) {
    grade.innerHTML += `<div class="dia-celula vazio"></div>`;
  }

  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const dataISO = dataParaISO(new Date(ano, mes, dia));
    const temAgendamento = !!(agendamentosPorDataCache[dataISO] && agendamentosPorDataCache[dataISO].length);
    const ehPassado = dataISO < hoje;

    const classes = ["dia-celula"];
    if (temAgendamento) classes.push("com-agendamento", "disponivel");
    if (ehPassado) classes.push("dia-passado");
    if (dataISO === diaSelecionadoNoPainel) classes.push("selecionado");

    grade.innerHTML += `<div class="${classes.join(" ")}" data-data="${dataISO}" tabindex="0">${dia}</div>`;
  }

  grade.querySelectorAll(".dia-celula:not(.vazio)").forEach((celula) => {
    celula.addEventListener("click", () => selecionarDiaNoPainel(celula.dataset.data));
  });
}

function selecionarDiaNoPainel(dataISO) {
  diaSelecionadoNoPainel = dataISO;
  desenharCalendarioPainel();

  const card = document.getElementById("card-exames-do-dia");
  const lista = document.getElementById("lista-exames-do-dia");
  const itens = agendamentosPorDataCache[dataISO] || [];

  document.getElementById("titulo-exames-do-dia").textContent =
    `Exames do dia ${formatarDataExtensa(dataISO)}`;

  if (itens.length === 0) {
    lista.innerHTML = `<p class="texto-secundario">Nenhum exame marcado nesse dia.</p>`;
  } else {
    lista.innerHTML = itens.map((item, idx) => desenharCardExameDoDia(item, idx)).join("");

    lista.querySelectorAll("[data-marcar-pago]").forEach((botao) => {
      botao.addEventListener("click", async () => {
        await marcarAgendamentoComoPago(botao.dataset.marcarPago);
        mostrarToast("Marcado como pago!");
        await iniciarDashboard();
        selecionarDiaNoPainel(dataISO);
      });
    });

    lista.querySelectorAll("[data-excluir-agendamento]").forEach((botao) => {
      botao.addEventListener("click", async () => {
        const confirmado = window.confirm(
          "Excluir este agendamento? Essa ação não pode ser desfeita e o horário será liberado novamente."
        );
        if (!confirmado) return;

        await excluirAgendamentoDefinitivamente(botao.dataset.excluirAgendamento);
        mostrarToast("Agendamento excluído.");
        await iniciarDashboard();
        selecionarDiaNoPainel(dataISO);
      });
    });
  }

  card.classList.remove("oculto");
  card.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function desenharCardExameDoDia(item, idx) {
  const seloPagamento =
    item.statusPagamento === "pago"
      ? `<span class="selo selo-pago">Pago</span>`
      : item.statusPagamento === "cancelado"
      ? `<span class="selo" style="background:#EAE3D4; color:var(--cor-grafite-500);">Cancelado</span>`
      : `<span class="selo selo-pendente">Pendente</span>`;

  const nomeExibicao = item.nomePaciente ? `${item.nomePaciente} (${item.nomeMorador})` : item.nomeMorador;

  return `
    <div class="flex-entre" style="padding:10px 0; border-bottom:1px solid #EAE3D4;">
      <div>
        <strong>${item.horario}</strong> — ${nomeExibicao}<br/>
        <span class="texto-secundario">${item.casa} · ${item.tipo === "pacote" ? "Pacote" : "Avulso"}</span>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
        ${seloPagamento}
        <div style="display:flex; gap:8px;">
          ${
            item.statusPagamento === "pendente"
              ? `<button class="botao-texto" data-marcar-pago="${item.agendamentoId}" style="background:none; border:none; font-size:0.78rem;">Marcar pago</button>`
              : ""
          }
          <button class="botao-texto" data-excluir-agendamento="${item.agendamentoId}" style="background:none; border:none; font-size:0.78rem; color:var(--cor-coral-500);">Excluir</button>
        </div>
      </div>
    </div>`;
}

function desenharBannerConflitos(conflitos) {
  const banner = document.getElementById("banner-conflitos");
  if (conflitos.length === 0) {
    banner.classList.add("oculto");
    return;
  }

  banner.classList.remove("oculto");
  document.getElementById("titulo-conflitos").textContent =
    `⚠️ ${conflitos.length} agendamento(s) em conflito`;

  document.getElementById("lista-conflitos").innerHTML = conflitos
    .map((ag) => {
      const datasConflito = (ag.datas || [])
        .filter((d) => d.status === "conflito")
        .map((d) => `${formatarDataExtensa(d.data)} às ${d.horario}`)
        .join(", ");
      return `<p style="margin-top:6px;"><strong>${ag.nomeMorador}</strong> (${ag.casa}) — ${datasConflito}</p>`;
    })
    .join("");
}

function desenharListaMoradores(moradores) {
  const lista = document.getElementById("lista-moradores");
  if (moradores.length === 0) {
    lista.innerHTML = `<p class="texto-secundario">Nenhum morador cadastrado ainda.</p>`;
    return;
  }

  lista.innerHTML = moradores
    .map((m) => `<p style="padding:6px 0; border-bottom:1px solid #EAE3D4;"><strong>${m.nome}</strong> — ${m.casa}</p>`)
    .join("");
}

// --------------------------------------------------------------------------
// Importação de plantões
// --------------------------------------------------------------------------

function configurarImportacaoPlantoes() {
  document.getElementById("botao-importar-texto").addEventListener("click", async () => {
    const texto = document.getElementById("texto-datas-plantao").value;
    const datas = parsearListaDeDatas(texto);

    if (datas.length === 0) {
      mostrarToast("Nenhuma data válida encontrada. Verifique o formato.");
      return;
    }

    try {
      const total = await importarPlantoes(datas);
      mostrarToast(`${total} data(s) importada(s) com sucesso!`);
      document.getElementById("texto-datas-plantao").value = "";
      await atualizarListaPlantoesImportados();
    } catch (erro) {
      mostrarToast(erro.message || "Erro ao importar.");
    }
  });

  document.getElementById("botao-importar-csv").addEventListener("click", async () => {
    const input = document.getElementById("input-arquivo-csv");
    const arquivo = input.files[0];
    if (!arquivo) {
      mostrarToast("Selecione um arquivo CSV primeiro.");
      return;
    }

    const texto = await arquivo.text();
    const datas = parsearCSVDeDatas(texto);

    if (datas.length === 0) {
      mostrarToast("Nenhuma data válida encontrada no CSV.");
      return;
    }

    try {
      const total = await importarPlantoes(datas);
      mostrarToast(`${total} data(s) importada(s) com sucesso!`);
      input.value = "";
      await atualizarListaPlantoesImportados();
    } catch (erro) {
      mostrarToast(erro.message || "Erro ao importar.");
    }
  });
}

async function atualizarListaPlantoesImportados() {
  const lista = document.getElementById("lista-plantoes-importados");
  lista.innerHTML = `<p class="texto-secundario">Carregando...</p>`;

  const datas = await listarProximosPlantoesImportados();
  if (datas.length === 0) {
    lista.innerHTML = `<p class="texto-secundario">Nenhum plantão importado ainda.</p>`;
    return;
  }

  lista.innerHTML = datas.map((d) => `<span class="selo selo-livre" style="margin:3px;">${formatarDataCurta(d)}</span>`).join("");
}

// --------------------------------------------------------------------------
// Bloqueios manuais
// --------------------------------------------------------------------------

function configurarBloqueios() {
  document.getElementById("form-bloqueio").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = document.getElementById("input-data-bloqueio").value;
    const inicio = document.getElementById("input-inicio-bloqueio").value;
    const fim = document.getElementById("input-fim-bloqueio").value;
    const motivo = document.getElementById("input-motivo-bloqueio").value;

    if (!data || !inicio || !fim) {
      mostrarToast("Preencha data, início e fim.");
      return;
    }

    try {
      const resultado = await criarBloqueioManual(data, inicio, fim, motivo);
      if (resultado.conflitos.length > 0) {
        mostrarToast(`⚠️ ${resultado.conflitos.length} exame(s) precisam ser remarcados.`);
      } else {
        mostrarToast("Horário bloqueado!");
      }
      document.getElementById("form-bloqueio").reset();
      await atualizarListaBloqueios();
    } catch (erro) {
      mostrarToast("Erro ao bloquear horário.");
    }
  });
}

async function atualizarListaBloqueios() {
  const lista = document.getElementById("lista-bloqueios");
  lista.innerHTML = `<p class="texto-secundario">Carregando...</p>`;

  const bloqueios = await listarBloqueiosManuais();
  if (bloqueios.length === 0) {
    lista.innerHTML = `<p class="texto-secundario">Nenhum bloqueio ativo.</p>`;
    return;
  }

  lista.innerHTML = bloqueios
    .map(
      (b) => `
      <div class="flex-entre" style="padding:10px 0; border-bottom:1px solid #EAE3D4;">
        <div>
          <strong>${formatarDataExtensa(b.data)}</strong><br/>
          <span class="texto-secundario">${b.horarioInicio} às ${b.horarioFim}${b.motivo ? " · " + b.motivo : ""}</span>
        </div>
        <button class="botao-texto" data-remover-bloqueio="${b.id}" style="background:none; border:none; color:var(--cor-coral-500);">Remover</button>
      </div>`
    )
    .join("");

  lista.querySelectorAll("[data-remover-bloqueio]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      await removerBloqueioManual(botao.dataset.removerBloqueio);
      mostrarToast("Bloqueio removido.");
      await atualizarListaBloqueios();
    });
  });
}

// --------------------------------------------------------------------------
// Configurações
// --------------------------------------------------------------------------

function configurarConfiguracoes() {
  document.getElementById("botao-salvar-pagamento").addEventListener("click", async () => {
    await salvarConfigExame({
      chavePix: document.getElementById("input-chave-pix").value.trim(),
      nomeRecebedor: document.getElementById("input-nome-recebedor").value.trim(),
      whatsappMedica: document.getElementById("input-whatsapp-medica").value.trim()
    });
    mostrarToast("Dados de pagamento salvos!");
  });

  document.getElementById("botao-salvar-avulso").addEventListener("click", async () => {
    const valor = parseFloat(document.getElementById("input-valor-avulso").value);
    if (isNaN(valor) || valor <= 0) {
      mostrarToast("Digite um valor válido.");
      return;
    }
    await salvarConfigExame({ valorAvulso: valor });
    mostrarToast("Valor do exame avulso salvo!");
  });

  document.getElementById("botao-salvar-horario").addEventListener("click", async () => {
    const inicio = document.getElementById("input-horario-inicio-config").value;
    const fim = document.getElementById("input-horario-fim-config").value;
    const duracao = parseInt(document.getElementById("input-duracao-slot").value, 10);

    if (!inicio || !fim || isNaN(duracao) || duracao <= 0) {
      mostrarToast("Preencha horário de início, fim e duração válidos.");
      return;
    }

    await salvarConfigExame({
      horarioInicio: inicio,
      horarioFim: fim,
      duracaoSlotMinutos: duracao
    });
    mostrarToast("Horário de atendimento salvo!");
  });

  document.getElementById("botao-adicionar-pacote").addEventListener("click", async () => {
    const nome = document.getElementById("input-nome-pacote").value.trim();
    const qtdExames = parseInt(document.getElementById("input-qtd-exames").value, 10);
    const intervaloMeses = parseInt(document.getElementById("input-intervalo-meses").value, 10);
    const valorTotal = parseFloat(document.getElementById("input-valor-pacote").value);

    if (!nome || isNaN(qtdExames) || isNaN(intervaloMeses) || isNaN(valorTotal)) {
      mostrarToast("Preencha todos os campos do pacote corretamente.");
      return;
    }

    const pacote = {
      id: "pacote_" + Date.now(),
      nome,
      qtdExames,
      intervaloMeses,
      valorTotal
    };

    await salvarPacote(pacote);
    mostrarToast("Pacote adicionado!");

    ["input-nome-pacote", "input-qtd-exames", "input-intervalo-meses", "input-valor-pacote"].forEach(
      (id) => (document.getElementById(id).value = "")
    );

    await carregarTelaConfiguracoes();
  });
}

async function carregarTelaConfiguracoes() {
  const config = await obterConfigExame();
  if (!config) return;

  if (config.chavePix) document.getElementById("input-chave-pix").value = config.chavePix;
  if (config.nomeRecebedor) document.getElementById("input-nome-recebedor").value = config.nomeRecebedor;
  if (config.whatsappMedica) document.getElementById("input-whatsapp-medica").value = config.whatsappMedica;
  if (config.valorAvulso) document.getElementById("input-valor-avulso").value = config.valorAvulso;
  if (config.horarioInicio) document.getElementById("input-horario-inicio-config").value = config.horarioInicio;
  if (config.horarioFim) document.getElementById("input-horario-fim-config").value = config.horarioFim;
  if (config.duracaoSlotMinutos) document.getElementById("input-duracao-slot").value = config.duracaoSlotMinutos;

  desenharListaPacotesConfig(config.pacotes || []);
}

function desenharListaPacotesConfig(pacotes) {
  const lista = document.getElementById("lista-pacotes-config");

  if (pacotes.length === 0) {
    lista.innerHTML = `<p class="texto-secundario">Nenhum pacote criado ainda.</p>`;
    return;
  }

  lista.innerHTML = pacotes
    .map(
      (p) => `
      <div class="flex-entre" style="padding:10px 0; border-bottom:1px solid #EAE3D4;">
        <div>
          <strong>${p.nome}</strong><br/>
          <span class="texto-secundario">${p.qtdExames} exames · a cada ${p.intervaloMeses} meses · ${formatarMoeda(p.valorTotal)}</span>
        </div>
        <button class="botao-texto" data-remover-pacote="${p.id}" style="background:none; border:none; color:var(--cor-coral-500);">Remover</button>
      </div>`
    )
    .join("");

  lista.querySelectorAll("[data-remover-pacote]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      await removerPacote(botao.dataset.removerPacote);
      mostrarToast("Pacote removido.");
      await carregarTelaConfiguracoes();
    });
  });
}
