// ==========================================================================
// DISPONIBILIDADE — Cálculo de dias e horários livres
// ==========================================================================
// Disponibilidade real = NÃO está em plantoesImportados (dia todo ocupado)
//                          E NÃO colide com bloqueiosManuais (data + horário)
//                          E o slot NÃO está ocupado por outro agendamento
// ==========================================================================

let cacheConfigExame = null;
let cacheDiasOcupadosPlantao = null; // Set de datas ISO ("2026-07-15")
let cacheBloqueiosManuais = null;    // Array de { data, horarioInicio, horarioFim }
let cacheAgendamentosAtivos = null;  // Array de { data, horario }

/** Carrega a configuração de exame (valores, pacotes, horário de atendimento) */
async function carregarConfigExame() {
  const doc = await db.collection("configExame").doc("unico").get();
  cacheConfigExame = doc.exists ? doc.data() : null;
  return cacheConfigExame;
}

/** Carrega o conjunto de dias em que a médica está de plantão (indisponível) */
async function carregarDiasOcupadosPlantao() {
  const snap = await db.collection("plantoesImportados").get();
  const dias = new Set();
  snap.forEach((doc) => dias.add(doc.data().data));
  cacheDiasOcupadosPlantao = dias;
  return dias;
}

/** Carrega os bloqueios manuais (compromissos pessoais dela) */
async function carregarBloqueiosManuais() {
  const snap = await db.collection("bloqueiosManuais").get();
  const bloqueios = [];
  snap.forEach((doc) => bloqueios.push({ id: doc.id, ...doc.data() }));
  cacheBloqueiosManuais = bloqueios;
  return bloqueios;
}

/** Carrega todos os horários já ocupados por agendamentos confirmados (não cancelados) */
async function carregarAgendamentosAtivos() {
  const snap = await db.collection("agendamentos").get();
  const ocupados = [];
  snap.forEach((doc) => {
    const dados = doc.data();
    (dados.datas || []).forEach((d) => {
      if (d.status !== "cancelado") {
        ocupados.push({ data: d.data, horario: d.horario, agendamentoId: doc.id });
      }
    });
  });
  cacheAgendamentosAtivos = ocupados;
  return ocupados;
}

/** Recarrega todos os caches de uma vez (chamar ao abrir a tela de calendário) */
async function recarregarTudoDisponibilidade() {
  await Promise.all([
    carregarConfigExame(),
    carregarDiasOcupadosPlantao(),
    carregarBloqueiosManuais(),
    carregarAgendamentosAtivos()
  ]);
}

/** Um dia é elegível pra exame se não está em plantão (checagem rápida, nível de dia) */
function diaEstaDisponivel(dataISO) {
  if (!cacheDiasOcupadosPlantao) return false;
  if (cacheDiasOcupadosPlantao.has(dataISO)) return false;

  // Se TODOS os slots do dia estiverem bloqueados manualmente ou ocupados,
  // o dia inteiro fica indisponível — checagem feita por obterSlotsDisponiveisNoDia.
  const slots = obterSlotsDisponiveisNoDia(dataISO);
  return slots.length > 0;
}

/** Retorna os horários "HH:MM" livres para um dia específico */
function obterSlotsDisponiveisNoDia(dataISO) {
  if (!cacheConfigExame || !cacheConfigExame.horarioInicio || !cacheConfigExame.horarioFim) {
    return [];
  }
  if (cacheDiasOcupadosPlantao && cacheDiasOcupadosPlantao.has(dataISO)) {
    return [];
  }

  const todosSlots = gerarSlotsDoDia(
    cacheConfigExame.horarioInicio,
    cacheConfigExame.horarioFim,
    cacheConfigExame.duracaoSlotMinutos || 20
  );

  const bloqueiosDoDia = (cacheBloqueiosManuais || []).filter((b) => b.data === dataISO);
  const agendadosNoDia = new Set(
    (cacheAgendamentosAtivos || []).filter((a) => a.data === dataISO).map((a) => a.horario)
  );

  return todosSlots.filter((slot) => {
    if (agendadosNoDia.has(slot)) return false;
    for (const bloqueio of bloqueiosDoDia) {
      if (horarioDentroDoIntervalo(slot, bloqueio.horarioInicio, bloqueio.horarioFim)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Sugere automaticamente N datas de pacote, espaçadas por X meses a partir
 * de hoje (ou de uma data inicial), ajustando para o dia disponível mais
 * próximo quando a data exata cair num dia ocupado.
 */
function sugerirDatasPacote(dataInicial, quantidadeExames, intervaloMeses) {
  const sugestoes = [];
  let dataBase = dataInicial;

  for (let i = 0; i < quantidadeExames; i++) {
    const dataAlvo = i === 0 ? dataBase : somarMeses(dataInicial, intervaloMeses * i);
    const dataAjustada = encontrarDiaDisponivelMaisProximo(dataAlvo, 15);
    sugestoes.push(dataAjustada);
  }
  return sugestoes;
}

/** Busca o dia disponível mais próximo de uma data alvo, dentro de uma janela de +/- N dias */
function encontrarDiaDisponivelMaisProximo(dataAlvoISO, janelaDias) {
  if (diaEstaDisponivel(dataAlvoISO)) return dataAlvoISO;

  for (let delta = 1; delta <= janelaDias; delta++) {
    const depois = somarDias(dataAlvoISO, delta);
    if (diaEstaDisponivel(depois)) return depois;

    const antes = somarDias(dataAlvoISO, -delta);
    if (diaEstaDisponivel(antes)) return antes;
  }
  return null; // nenhuma data disponível na janela — precisa de ajuste manual
}
