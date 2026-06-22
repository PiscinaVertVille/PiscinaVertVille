// ==========================================================================
// CONFIGURAÇÃO EMAILJS — Piscina Vertville
// ==========================================================================
// Usado para enviar o código de verificação de 6 dígitos no cadastro do morador.
//
// Como configurar (gratuito, sem cartão):
// 1. Crie uma conta em https://www.emailjs.com
// 2. Em "Email Services", conecte seu Gmail (ou outro provedor) — isso gera um SERVICE_ID
// 3. Em "Email Templates", crie um template novo com este conteúdo de exemplo:
//
//      Assunto: Seu código de verificação - Piscina Vertville
//      Corpo:
//        Olá {{nome}},
//        Seu código de verificação é: {{codigo}}
//        Ele expira em 10 minutos.
//
//    Garanta que as variáveis do template sejam exatamente: {{nome}}, {{codigo}}, {{email}}
//    (o campo "To Email" do template deve usar {{email}})
//
// 4. Copie o TEMPLATE_ID gerado
// 5. Em "Account" > "General", copie sua PUBLIC_KEY
// 6. Cole os 3 valores abaixo
//
// IMPORTANTE — Segurança:
// Essas chaves ficam visíveis no código-fonte do navegador (é assim que o
// EmailJS funciona, não tem como evitar). Para reduzir abuso:
//   - No painel do EmailJS, vá em "Account" > "Security" e ATIVE a opção
//     "Restrict allowed origins" / "Allowed domains", colocando o domínio
//     real do GitHub Pages (ex: seu-usuario.github.io).
//   - O plano free permite 200 emails/mês — suficiente para o volume de um
//     condomínio, mas fique de olho no painel se notar uso anormal.
// ==========================================================================

const EMAILJS_CONFIG = {
  SERVICE_ID: "service_ozruqzr",
  TEMPLATE_ID: "template_o9tmhd2",
  PUBLIC_KEY: "ezut81Nyiv4umRcNU"
};

// Inicialização (biblioteca EmailJS carregada via CDN no index.html)
(function () {
  if (typeof emailjs !== "undefined") {
    emailjs.init({ publicKey: EMAILJS_CONFIG.PUBLIC_KEY });
  }
})();

/**
 * Gera um código numérico de 6 dígitos.
 */
function gerarCodigoVerificacao() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Envia o código de verificação para o email do morador.
 * Retorna uma Promise que resolve em caso de sucesso.
 */
function enviarCodigoPorEmail(nome, email, codigo) {
  return emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_ID, {
    nome: nome,
    email: email,
    codigo: codigo
  });
}
