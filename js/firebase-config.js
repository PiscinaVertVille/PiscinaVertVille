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
  apiKey: "AIzaSyDNmhme1wgNkFXUc05WIB6DpvkwxSChiDA",
  authDomain: "piscinavertville.firebaseapp.com",
  projectId: "piscinavertville",
  storageBucket: "piscinavertville.firebasestorage.app",
  messagingSenderId: "838444011436",
  appId: "1:838444011436:web:34dbc499a14bfbc0acf409"
};

// Inicialização (Firebase v9+ compat, carregado via CDN no index.html)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();