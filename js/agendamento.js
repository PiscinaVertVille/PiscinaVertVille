// ==========================================================================
// AGENDAMENTO — Exame avulso, pacote anual e checkout (Pix + WhatsApp)
// ==========================================================================

/**
 * Cria um agendamento do tipo "avulso": um ou mais horários, cada um podendo
 * ter um nome de paciente diferente (ex: morador + filhos no mesmo agendamento).
 * itensHorario: [{ data: "2026-07-15", horario: "09:00", nomePaciente: "" }, ...]
 */
async function criarAgendamentoAvulso(morador, itensHorario) {
  const valorPorExame = cacheConfigExame.valorAvulso;
  const valorTotal = valorPorExame * itensHorario.length;

  const docRef = await db.collection("agendamentos").add({
    moradorId: morador.id,
    nomeMorador: morador.nome,
    casa: morador.casa,
    tipo: "avulso",
    pacoteId: null,
    datas: itensHorario.map((item) => ({
      data: item.data,
      horario: item.horario,
      nomePaciente: item.nomePaciente || "",
      status: "agendado"
    })),
    valorTotal,
    statusPagamento: "pendente",
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });

  return { id: docRef.id, datas: itensHorario, valorTotal };
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
  // Filtra só por moradorId (sem orderBy junto) para não depender de um
  // índice composto no Firestore — a ordenação é feita aqui no JS.
  const snap = await db.collection("agendamentos")
    .where("moradorId", "==", moradorId)
    .get();

  const lista = [];
  snap.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));

  lista.sort((a, b) => {
    const tempoA = a.criadoEm && a.criadoEm.toMillis ? a.criadoEm.toMillis() : 0;
    const tempoB = b.criadoEm && b.criadoEm.toMillis ? b.criadoEm.toMillis() : 0;
    return tempoB - tempoA;
  });

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
    .map((d) => {
      const sufixoPaciente = d.nomePaciente ? ` (${d.nomePaciente})` : "";
      return `${formatarDataExtensa(d.data)} às ${d.horario}${sufixoPaciente}`;
    })
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

/**
 * Exclui DEFINITIVAMENTE um agendamento do banco (usado pela médica quando o
 * morador marcou errado/duplicado e o pagamento ainda não foi feito).
 * Diferente de cancelar: aqui o registro desaparece por completo, liberando
 * o horário de novo na agenda.
 */
async function excluirAgendamentoDefinitivamente(agendamentoId) {
  await db.collection("agendamentos").doc(agendamentoId).delete();
}
