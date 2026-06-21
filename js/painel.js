// ==========================================================================
// PAINEL — Área da médica (login separado, configurações, gestão da agenda)
// ==========================================================================

const CHAVE_SESSAO_MEDICA = "piscinaVV_medica";

function obterSessaoMedica() {
  return sessionStorage.getItem(CHAVE_SESSAO_MEDICA) === "true";
}

/**
 * Login simples da médica via Firebase Auth (email/senha).
 * Ela cria a própria conta uma vez no Firebase Console (Authentication > Users)
 * ou você pode adicionar uma função de "primeiro acesso" depois.
 */
async function loginMedica(email, senha) {
  await auth.signInWithEmailAndPassword(email.trim(), senha);
  sessionStorage.setItem(CHAVE_SESSAO_MEDICA, "true");
}

function logoutMedica() {
  auth.signOut();
  sessionStorage.removeItem(CHAVE_SESSAO_MEDICA);
}

// --------------------------------------------------------------------------
// Importação de plantões (backup manual do Shiftr)
// --------------------------------------------------------------------------

/**
 * Importa uma lista de datas ISO como "dias ocupados por plantão".
 * Substitui os dias futuros anteriores (mantém histórico passado intacto)
 * para evitar duplicar/acumular importações antigas.
 */
async function importarPlantoes(datasISO) {
  if (!datasISO.length) {
    throw new Error("Nenhuma data válida encontrada para importar.");
  }

  const hoje = hojeISO();
  const batch = db.batch();

  // Remove importações futuras antigas, pra essa importação "substituir" a escala.
  const antigasSnap = await db.collection("plantoesImportados")
    .where("data", ">=", hoje)
    .get();
  antigasSnap.forEach((doc) => batch.delete(doc.ref));

  // Remove duplicadas dentro da própria lista nova
  const datasUnicas = [...new Set(datasISO)];

  datasUnicas.forEach((data) => {
    const novoDoc = db.collection("plantoesImportados").doc();
    batch.set(novoDoc, {
      data,
      origem: "importacao_manual",
      importadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
  return datasUnicas.length;
}

/** Lista as próximas datas de plantão importadas (pra exibir confirmação na tela) */
async function listarProximosPlantoesImportados() {
  const hoje = hojeISO();
  const snap = await db.collection("plantoesImportados")
    .where("data", ">=", hoje)
    .orderBy("data", "asc")
    .get();

  const lista = [];
  snap.forEach((doc) => lista.push(doc.data().data));
  return lista;
}

// --------------------------------------------------------------------------
// Bloqueios manuais (compromissos pessoais dela)
// --------------------------------------------------------------------------

async function criarBloqueioManual(dataISO, horarioInicio, horarioFim, motivo) {
  // Antes de criar, verifica se existem agendamentos ativos que vão colidir.
  const conflitos = await detectarConflitosComBloqueio(dataISO, horarioInicio, horarioFim);

  const docRef = await db.collection("bloqueiosManuais").add({
    data: dataISO,
    horarioInicio,
    horarioFim,
    motivo: motivo || "",
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });

  if (conflitos.length > 0) {
    await marcarAgendamentosEmConflito(conflitos);
  }

  return { id: docRef.id, conflitos };
}

async function removerBloqueioManual(bloqueioId) {
  await db.collection("bloqueiosManuais").doc(bloqueioId).delete();
}

async function listarBloqueiosManuais() {
  const hoje = hojeISO();
  const snap = await db.collection("bloqueiosManuais")
    .where("data", ">=", hoje)
    .orderBy("data", "asc")
    .get();

  const lista = [];
  snap.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
  return lista;
}

/** Verifica quais agendamentos ativos colidem com um novo bloqueio */
async function detectarConflitosComBloqueio(dataISO, horarioInicio, horarioFim) {
  const snap = await db.collection("agendamentos").get();
  const conflitos = [];

  snap.forEach((doc) => {
    const dados = doc.data();
    (dados.datas || []).forEach((d, indice) => {
      if (
        d.status === "agendado" &&
        d.data === dataISO &&
        horarioDentroDoIntervalo(d.horario, horarioInicio, horarioFim)
      ) {
        conflitos.push({
          agendamentoId: doc.id,
          indiceData: indice,
          nomeMorador: dados.nomeMorador,
          casa: dados.casa,
          data: d.data,
          horario: d.horario
        });
      }
    });
  });

  return conflitos;
}

/** Marca as datas conflitantes como status "conflito" dentro de cada agendamento */
async function marcarAgendamentosEmConflito(conflitos) {
  const batch = db.batch();
  const agrupadosPorAgendamento = {};

  conflitos.forEach((c) => {
    if (!agrupadosPorAgendamento[c.agendamentoId]) {
      agrupadosPorAgendamento[c.agendamentoId] = [];
    }
    agrupadosPorAgendamento[c.agendamentoId].push(c.indiceData);
  });

  for (const agendamentoId of Object.keys(agrupadosPorAgendamento)) {
    const docRef = db.collection("agendamentos").doc(agendamentoId);
    const doc = await docRef.get();
    const dados = doc.data();
    const novasDatas = [...dados.datas];

    agrupadosPorAgendamento[agendamentoId].forEach((indice) => {
      novasDatas[indice] = { ...novasDatas[indice], status: "conflito" };
    });

    batch.update(docRef, { datas: novasDatas });
  }

  await batch.commit();
}

/** Busca todos os agendamentos que estão com alguma data em conflito (pra exibir alerta no painel) */
async function listarAgendamentosEmConflito() {
  const snap = await db.collection("agendamentos").get();
  const lista = [];

  snap.forEach((doc) => {
    const dados = doc.data();
    const temConflito = (dados.datas || []).some((d) => d.status === "conflito");
    if (temConflito) {
      lista.push({ id: doc.id, ...dados });
    }
  });

  return lista;
}

// --------------------------------------------------------------------------
// Configuração de valores e pacotes
// --------------------------------------------------------------------------

async function salvarConfigExame(config) {
  await db.collection("configExame").doc("unico").set(config, { merge: true });
}

async function obterConfigExame() {
  const doc = await db.collection("configExame").doc("unico").get();
  return doc.exists ? doc.data() : null;
}

/**
 * Adiciona ou atualiza um pacote dentro da lista de pacotes.
 * pacote: { id, nome, qtdExames, valorTotal, intervaloMeses }
 */
async function salvarPacote(pacote) {
  const configAtual = (await obterConfigExame()) || { pacotes: [] };
  const pacotes = configAtual.pacotes || [];

  const indiceExistente = pacotes.findIndex((p) => p.id === pacote.id);
  if (indiceExistente >= 0) {
    pacotes[indiceExistente] = pacote;
  } else {
    pacotes.push(pacote);
  }

  await db.collection("configExame").doc("unico").set({ pacotes }, { merge: true });
}

async function removerPacote(pacoteId) {
  const configAtual = (await obterConfigExame()) || { pacotes: [] };
  const pacotes = (configAtual.pacotes || []).filter((p) => p.id !== pacoteId);
  await db.collection("configExame").doc("unico").set({ pacotes }, { merge: true });
}

// --------------------------------------------------------------------------
// Agenda consolidada (visão geral da médica)
// --------------------------------------------------------------------------

/** Busca todos os agendamentos futuros, ordenados por data mais próxima */
async function buscarAgendaConsolidada() {
  const snap = await db.collection("agendamentos").get();
  const lista = [];

  snap.forEach((doc) => {
    const dados = doc.data();
    lista.push({ id: doc.id, ...dados });
  });

  // Ordena pela data mais próxima entre as datas ativas de cada agendamento
  lista.sort((a, b) => {
    const proximaA = (a.datas || []).find((d) => d.status !== "cancelado")?.data || "9999-99-99";
    const proximaB = (b.datas || []).find((d) => d.status !== "cancelado")?.data || "9999-99-99";
    return proximaA.localeCompare(proximaB);
  });

  return lista;
}

/** Lista moradores cadastrados (pra ela ter visão de quem já se cadastrou) */
async function listarMoradoresCadastrados() {
  const snap = await db.collection("moradores")
    .where("verificado", "==", true)
    .get();

  const lista = [];
  snap.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
  return lista;
}
