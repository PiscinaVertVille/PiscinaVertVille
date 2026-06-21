// ==========================================================================
// AUTH — Cadastro, login e verificação do morador
// ==========================================================================
// Fluxo de cadastro: nome + casa + telefone + email + senha -> cria conta no
// Firebase Auth -> envia código de 6 dígitos por email -> confirma -> sessão
// real do Firebase Auth (funciona em qualquer navegador/dispositivo).
//
// Fluxo de login (já cadastrado): email + senha -> Firebase Auth.
// ==========================================================================

let codigoEnviadoTemp = null;
let dadosCadastroTemp = null;

/**
 * Retorna o morador atualmente logado (a partir do Firebase Auth + Firestore),
 * ou null se não houver sessão ativa ou ainda não verificado.
 */
async function obterSessaoMorador() {
  const usuario = auth.currentUser;
  if (!usuario) return null;

  const doc = await db.collection("moradores").doc(usuario.uid).get();
  if (!doc.exists) return null;

  const dados = doc.data();
  if (!dados.verificado) return null;

  return {
    id: usuario.uid,
    nome: dados.nome,
    casa: dados.casa,
    email: dados.email,
    telefone: dados.telefone || ""
  };
}

/**
 * Aguarda o Firebase Auth inicializar e resolver o estado de login atual.
 * Necessário porque auth.currentUser pode estar undefined por uma fração
 * de segundo no primeiro carregamento da página.
 */
function aguardarEstadoAuth() {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((usuario) => {
      unsubscribe();
      resolve(usuario);
    });
  });
}

function encerrarSessaoMorador() {
  return auth.signOut();
}

/**
 * Passo 1 do cadastro: valida campos, cria a conta no Firebase Auth,
 * cria o documento do morador no Firestore (verificado=false), envia o
 * código de verificação por email.
 */
async function iniciarCadastroMorador(nome, casa, telefone, email, senha) {
  nome = nome.trim();
  casa = casa.trim();
  telefone = (telefone || "").trim();
  email = email.trim().toLowerCase();

  if (!nome || !casa) {
    throw new Error("Preencha nome e casa/apartamento.");
  }
  if (!emailValido(email)) {
    throw new Error("Digite um email válido.");
  }
  if (!senha || senha.length < 6) {
    throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  }

  const credencial = await auth.createUserWithEmailAndPassword(email, senha);
  const uid = credencial.user.uid;

  const codigo = gerarCodigoVerificacao();
  codigoEnviadoTemp = codigo;
  dadosCadastroTemp = { nome, email };

  await db.collection("moradores").doc(uid).set({
    nome,
    casa,
    telefone,
    email,
    verificado: false,
    codigoVerificacao: codigo,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    codigoEnviadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });

  await enviarCodigoPorEmail(nome, email, codigo);

  return uid;
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

  return {
    id: moradorId,
    nome: dados.nome,
    casa: dados.casa,
    email: dados.email,
    telefone: dados.telefone || ""
  };
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

/**
 * Login de morador já cadastrado e verificado anteriormente.
 */
async function loginMorador(email, senha) {
  email = email.trim().toLowerCase();
  const credencial = await auth.signInWithEmailAndPassword(email, senha);
  const uid = credencial.user.uid;

  const doc = await db.collection("moradores").doc(uid).get();
  if (!doc.exists) {
    throw new Error("Cadastro não encontrado.");
  }

  const dados = doc.data();

  if (!dados.verificado) {
    // Conta criada mas nunca verificou o código — reenvia e força a tela de verificação.
    const codigo = gerarCodigoVerificacao();
    dadosCadastroTemp = { nome: dados.nome, email: dados.email };
    await enviarCodigoPorEmail(dados.nome, dados.email, codigo);
    await db.collection("moradores").doc(uid).update({
      codigoVerificacao: codigo,
      codigoEnviadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    const erro = new Error("PRECISA_VERIFICAR");
    erro.moradorId = uid;
    throw erro;
  }

  return {
    id: uid,
    nome: dados.nome,
    casa: dados.casa,
    email: dados.email,
    telefone: dados.telefone || ""
  };
}
