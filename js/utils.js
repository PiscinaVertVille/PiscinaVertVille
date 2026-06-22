// ==========================================================================
// UTILS — Piscina Vertville
// Funções compartilhadas: datas, geração de slots, formatação, toast.
// ==========================================================================

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

const DIAS_SEMANA_PT = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Formata uma data ISO ("2026-07-15") para "15 de julho de 2026" */
function formatarDataExtensa(dataISO) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  return `${dia} de ${MESES_PT[mes - 1]} de ${ano}`;
}

/** Formata uma data ISO para "15/07" (curta) */
function formatarDataCurta(dataISO) {
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}`;
}

/** Formata um valor numérico para Real brasileiro: 150.5 -> "R$ 150,50" */
function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Retorna a data de hoje no formato ISO "AAAA-MM-DD", sem horário */
function hojeISO() {
  const hoje = new Date();
  return dataParaISO(hoje);
}

function dataParaISO(dateObj) {
  const ano = dateObj.getFullYear();
  const mes = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dia = String(dateObj.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Soma meses a uma data ISO e retorna nova data ISO */
function somarMeses(dataISO, meses) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const d = new Date(ano, mes - 1 + meses, dia);
  return dataParaISO(d);
}

/** Soma dias a uma data ISO e retorna nova data ISO */
function somarDias(dataISO, dias) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia + dias);
  return dataParaISO(d);
}

/** Diferença em dias entre duas datas ISO (b - a) */
function diferencaDias(dataISOa, dataISOb) {
  const [a1, m1, d1] = dataISOa.split("-").map(Number);
  const [a2, m2, d2] = dataISOb.split("-").map(Number);
  const ta = new Date(a1, m1 - 1, d1).getTime();
  const tb = new Date(a2, m2 - 1, d2).getTime();
  return Math.round((tb - ta) / 86400000);
}

/**
 * Gera os slots de horário do dia, ex: das "08:00" às "18:00" de 20 em 20 min.
 * Retorna array de strings "HH:MM".
 */
function gerarSlotsDoDia(horarioInicio, horarioFim, duracaoMinutos) {
  const slots = [];
  const [hIni, mIni] = horarioInicio.split(":").map(Number);
  const [hFim, mFim] = horarioFim.split(":").map(Number);

  let minutosAtual = hIni * 60 + mIni;
  const minutosFim = hFim * 60 + mFim;

  while (minutosAtual + duracaoMinutos <= minutosFim) {
    const h = String(Math.floor(minutosAtual / 60)).padStart(2, "0");
    const m = String(minutosAtual % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
    minutosAtual += duracaoMinutos;
  }
  return slots;
}

/** Verifica se um horário "HH:MM" está dentro de um intervalo de bloqueio [inicio, fim) */
function horarioDentroDoIntervalo(horario, inicio, fim) {
  return horario >= inicio && horario < fim;
}

/** Monta o link de WhatsApp com mensagem pré-formatada */
function montarLinkWhatsApp(numeroWhatsapp, mensagem) {
  const numeroLimpo = numeroWhatsapp.replace(/\D/g, "");
  return `https://wa.me/${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;
}

/** Copia texto para a área de transferência */
async function copiarParaAreaDeTransferencia(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    // fallback pra navegadores mais antigos / iOS Safari mais velho
    const textarea = document.createElement("textarea");
    textarea.value = texto;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch (e2) {
      document.body.removeChild(textarea);
      return false;
    }
  }
}

/** Mostra um toast simples no rodapé da tela */
function mostrarToast(mensagem, duracaoMs = 2600) {
  let toast = document.getElementById("toast-global");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-global";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = mensagem;
  toast.classList.add("mostrar");
  clearTimeout(toast._timeoutId);
  toast._timeoutId = setTimeout(() => {
    toast.classList.remove("mostrar");
  }, duracaoMs);
}

/** Valida formato de email simples */
function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Configura todos os botões de "mostrar/ocultar senha" presentes na página.
 * Cada botão deve ter o atributo data-alvo apontando para o id do input de senha.
 * Chamar uma vez no carregamento de cada tela (index.html e painel.html).
 */
function configurarBotoesMostrarSenha() {
  document.querySelectorAll(".botao-mostrar-senha").forEach((botao) => {
    botao.addEventListener("click", () => {
      const input = document.getElementById(botao.dataset.alvo);
      if (!input) return;

      const estaMostrando = input.type === "text";
      input.type = estaMostrando ? "password" : "text";
      botao.textContent = estaMostrando ? "👁" : "🙈";
      botao.setAttribute("aria-label", estaMostrando ? "Mostrar senha" : "Ocultar senha");
    });
  });
}

/**
 * Faz o parse de uma lista de datas em texto livre (uma por linha),
 * aceitando "DD/MM/AAAA" ou "AAAA-MM-DD". Ignora linhas vazias/inválidas.
 * Retorna array de datas ISO.
 */
function parsearListaDeDatas(textoBruto) {
  const linhas = textoBruto.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);
  const datasISO = [];

  for (const linha of linhas) {
    let match = linha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // DD/MM/AAAA
    if (match) {
      const [, dia, mes, ano] = match;
      datasISO.push(`${ano}-${mes}-${dia}`);
      continue;
    }
    match = linha.match(/^(\d{4})-(\d{2})-(\d{2})$/); // AAAA-MM-DD
    if (match) {
      datasISO.push(linha);
      continue;
    }
  }
  return datasISO;
}

/**
 * Faz o parse de um arquivo CSV simples (texto já lido), pegando a primeira
 * coluna de cada linha como data. Pula a primeira linha se parecer cabeçalho.
 */
function parsearCSVDeDatas(textoCSV) {
  const linhas = textoCSV.split("\n").map((l) => l.trim()).filter(Boolean);
  const datasISO = [];

  for (const linha of linhas) {
    const primeiraColuna = linha.split(",")[0].trim().replace(/"/g, "");
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(primeiraColuna) || /^\d{4}-\d{2}-\d{2}$/.test(primeiraColuna)) {
      const parsed = parsearListaDeDatas(primeiraColuna);
      datasISO.push(...parsed);
    }
  }
  return datasISO;
}
