// ==========================================================================
// AGENDAMENTO — Exame avulso, pacote anual e checkout (Pix + WhatsApp)
// ==========================================================================

/**
 * Cria um agendamento do tipo "avulso": uma única data + horário.
 */
async function criarAgendamentoAvulso(morador, dataISO, horario) {
  const valor = cacheConfigExame.valorAvulso;

  const docRef = await db.collection("agendamentos").add({
    moradorId: morador.id,
    nomeMorador: morador.nome,
    casa: morador.casa,
    tipo: "avulso",
    pacoteId: null,
    datas: [{ data: dataISO, horario, status: "agendado" }],
    valorTotal: valor,
    statusPagamento: "pendente",
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });

  return { id: docRef.id, datas: [{ data: dataISO, horario }], valorTotal: valor };
}

/**
 * Cria um agendamento do tipo "pacote": múltiplas datas sugeridas (já ajustadas
 * pelo morador se necessário), pagamento único à vista.
 */
async function criarAgendamentoPacote(morador, pacote, datasComHorarios) {
  // datasComHorarios: [{ data: "2026-07-15", horario: "09:00" }, ...]
  const docRef = await db.collection("agendamentos").add({
    moradorId: morador.id,
    nomeMorador: morador.nome,
    casa: morador.casa,
    tipo: "pacote",
    pacoteId: pacote.id,
    datas: datasComHorarios.map((d) => ({ ...d, status: "agendado" })),
    valorTotal: pacote.valorTotal,
    statusPagamento: "pendente",
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });

  return { id: docRef.id, datas: datasComHorarios, valorTotal: pacote.valorTotal };
}

/** Busca todos os agendamentos de um morador (histórico + ativos) */
async function buscarAgendamentosDoMorador(moradorId) {
  const snap = await db.collection("agendamentos")
    .where("moradorId", "==", moradorId)
    .orderBy("criadoEm", "desc")
    .get();

  const lista = [];
  snap.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
  return lista;
}

/** Remarca uma data específica dentro de um agendamento (usado em casos de conflito) */
async function remarcarDataDoAgendamento(agendamentoId, indiceData, novaData, novoHorario) {
  const docRef = db.collection("agendamentos").doc(agendamentoId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error("Agendamento não encontrado.");

  const dados = doc.data();
  const novasDatas = [...dados.datas];
  novasDatas[indiceData] = { data: novaData, horario: novoHorario, status: "agendado" };

  await docRef.update({ datas: novasDatas });
  return novasDatas;
}

/** Monta a mensagem de WhatsApp pro pagamento (avulso ou pacote) */
function montarMensagemWhatsApp(morador, agendamento, tipoTexto) {
  const datasFormatadas = agendamento.datas
    .map((d) => `${formatarDataExtensa(d.data)} às ${d.horario}`)
    .join("\n- ");

  return (
    `Olá, Dra.! Confirmando o pagamento do exame de piscina.\n\n` +
    `Morador: ${morador.nome}\n` +
    `Casa: ${morador.casa}\n` +
    `Tipo: ${tipoTexto}\n` +
    `Valor: ${formatarMoeda(agendamento.valorTotal)}\n\n` +
    `Data(s) do exame:\n- ${datasFormatadas}\n\n` +
    `Já realizei o Pix, segue o comprovante.`
  );
}

/** Marca um agendamento como pago (chamado pela própria médica no painel) */
async function marcarAgendamentoComoPago(agendamentoId) {
  await db.collection("agendamentos").doc(agendamentoId).update({
    statusPagamento: "pago",
    pagoEm: firebase.firestore.FieldValue.serverTimestamp()
  });
}

/** Cancela um agendamento inteiro (todas as datas marcadas como canceladas) */
async function cancelarAgendamento(agendamentoId) {
  const docRef = db.collection("agendamentos").doc(agendamentoId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error("Agendamento não encontrado.");

  const dados = doc.data();
  const datasCanceladas = (dados.datas || []).map((d) => ({ ...d, status: "cancelado" }));

  await docRef.update({
    statusPagamento: "cancelado",
    datas: datasCanceladas
  });
}

/** Cancela apenas uma data específica dentro de um agendamento (ex: pacote com 4 datas) */
async function cancelarDataDoAgendamento(agendamentoId, indiceData) {
  const docRef = db.collection("agendamentos").doc(agendamentoId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error("Agendamento não encontrado.");

  const dados = doc.data();
  const novasDatas = [...dados.datas];
  novasDatas[indiceData] = { ...novasDatas[indiceData], status: "cancelado" };

  await docRef.update({ datas: novasDatas });
}
