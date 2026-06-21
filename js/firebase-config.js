// ==========================================================================
// CONFIGURAÇÃO FIREBASE — Piscina Vert Ville
// ==========================================================================
// Como obter esses valores:
// 1. Acesse https://console.firebase.google.com
// 2. Crie um projeto novo (ex: "piscina-vert-ville")
// 3. Adicione um app Web (ícone </>) dentro do projeto
// 4. Copie o objeto de configuração que aparece e cole nos campos abaixo
// 5. Ative o Firestore Database (modo produção) no menu lateral
// 6. Configure as regras de segurança (veja firestore.rules.txt neste projeto)
// ==========================================================================

const firebaseConfig = {
  apiKey: "COLE_AQUI_SUA_API_KEY",
  authDomain: "COLE_AQUI_SEU_PROJETO.firebaseapp.com",
  projectId: "COLE_AQUI_SEU_PROJECT_ID",
  storageBucket: "COLE_AQUI_SEU_PROJETO.appspot.com",
  messagingSenderId: "COLE_AQUI_O_SENDER_ID",
  appId: "COLE_AQUI_O_APP_ID"
};

// Inicialização (Firebase v9+ compat, carregado via CDN no index.html)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
