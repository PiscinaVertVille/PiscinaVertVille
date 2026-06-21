// ==========================================================================
// AUTH — Cadastro e verificação do morador
// ==========================================================================
// Fluxo: nome + casa + email -> código de 6 dígitos por email -> confirma ->
// sessão salva em localStorage (não precisa logar de novo no mesmo navegador).
// ==========================================================================

const CHAVE_SESSAO_MORADOR = "piscinaVV_morador";

let codigoEnviadoTemp = null;
let dadosCadastroTemp = null;

function obterSessaoMorador() {
  const raw = localStorage.getItem(CHAVE_SESSAO_MORADOR);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function salvarSessaoMorador(morador) {
  localStorage.setItem(CHAVE_SESSAO_MORADOR, JSON.stringify(morador));
}

function encerrarSessaoMorador() {
  localStorage.removeItem(CHAVE_SESSAO_MORADOR);
}

/**
 * Passo 1 do cadastro: valida campos, gera código, envia por email,
 * cria (ou reutiliza) o documento do morador no Firestore com verificado=false.
 */
async function iniciarCadastroMorador(nome, casa, email) {
  nome = nome.trim();
  casa = casa.trim();
  email = email.trim().toLowerCase();

  if (!nome || !casa) {
    throw new Error("Preencha nome e casa/apartamento.");
  }
  if (!emailValido(email)) {
    throw new Error("Digite um email válido.");
  }

  const codigo = gerarCodigoVerificacao();
  codigoEnviadoTemp = codigo;
  dadosCadastroTemp = { nome, casa, email };

  await enviarCodigoPorEmail(nome, email, codigo);

  // Salva (ou atualiza) o registro do morador já no banco, ainda não verificado.
  const moradoresRef = db.collection("moradores");
  const existente = await moradoresRef.where("email", "==", email).limit(1).get();

  let moradorId;
  if (!existente.empty) {
    moradorId = existente.docs[0].id;
    await moradoresRef.doc(moradorId).update({
      nome,
      casa,
      codigoVerificacao: codigo,
      verificado: false,
      codigoEnviadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    const novoDoc = await moradoresRef.add({
      nome,
      casa,
      email,
      verificado: false,
      codigoVerificacao: codigo,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      codigoEnviadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    moradorId = novoDoc.id;
  }

  return moradorId;
}

/**
 * Passo 2 do cadastro: confirma o código de 6 dígitos digitado pelo morador.
 */
async function confirmarCodigoVerificacao(moradorId, codigoDigitado) {
  const doc = await db.collection("moradores").doc(moradorId).get();
  if (!doc.exists) {
    throw new Error("Cadastro não encontrado. Tente novamente.");
  }

  const dados = doc.data();
  if (String(dados.codigoVerificacao) !== String(codigoDigitado).trim()) {
    throw new Error("Código incorreto. Verifique seu email e tente de novo.");
  }

  await db.collection("moradores").doc(moradorId).update({
    verificado: true,
    verificadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });

  const moradorConfirmado = {
    id: moradorId,
    nome: dados.nome,
    casa: dados.casa,
    email: dados.email
  };

  salvarSessaoMorador(moradorConfirmado);
  return moradorConfirmado;
}

/**
 * Reenvia um novo código pro mesmo cadastro em andamento.
 */
async function reenviarCodigoVerificacao(moradorId) {
  if (!dadosCadastroTemp) {
    throw new Error("Reinicie o cadastro.");
  }
  const codigo = gerarCodigoVerificacao();
  codigoEnviadoTemp = codigo;

  await enviarCodigoPorEmail(dadosCadastroTemp.nome, dadosCadastroTemp.email, codigo);
  await db.collection("moradores").doc(moradorId).update({
    codigoVerificacao: codigo,
    codigoEnviadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });
}
