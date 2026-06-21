# Piscina Vért Ville

PWA de agendamento de exame de piscina do Condomínio Vért Ville.

- **App do morador**: `index.html` — cadastro com verificação por email, calendário de disponibilidade, exame avulso ou pacote anual, checkout com Pix + WhatsApp.
- **Painel da médica**: `painel.html` — login, importação de plantões (backup manual do Shiftr), bloqueios de horário pessoais, configuração de valores/pacotes, agenda consolidada.

## Como tudo se conecta

```
Shiftr (projeto Firebase separado, intocado)
   │
   │  você exporta/copia as datas de plantão manualmente
   ▼
Painel da médica → "Atualizar agenda" → cola lista ou sobe CSV
   │
   ▼
plantoesImportados (Firestore deste projeto)
   │
   ▼
Calendário do morador = dias livres = (não é plantão) E (não é bloqueio manual) E (não está ocupado)
```

Os dois apps (Shiftr e Piscina Vért Ville) ficam em **projetos Firebase totalmente separados**. Nenhuma credencial, regra ou dado do Shiftr é tocado por este projeto — por desenho, para não colocar em risco os dados da sua esposa nem do familiar que também usa o Shiftr.

## Passo a passo de configuração

### 1. Criar o projeto Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) → **Criar projeto** → nome sugerido: `piscina-vert-ville`.
2. Dentro do projeto, clique no ícone `</>` para adicionar um **app Web**.
3. Copie o objeto `firebaseConfig` gerado.
4. Cole esses valores em `js/firebase-config.js`, substituindo os placeholders `COLE_AQUI_...`.
5. No menu lateral, ative o **Firestore Database** (modo produção, escolha a região mais próxima, ex: `southamerica-east1`).
6. Em **Firestore Database → Regras**, cole o conteúdo de `firestore.rules.txt` e publique.
7. Em **Authentication → Sign-in method**, ative **Email/senha**.
8. Em **Authentication → Users**, crie manualmente o usuário da médica (email + senha) — é com essa conta que ela faz login em `painel.html`.

### 2. Criar a conta EmailJS (envio do código de verificação)

1. Acesse [emailjs.com](https://www.emailjs.com) e crie uma conta gratuita.
2. Em **Email Services**, conecte seu Gmail (ou outro provedor) → copie o **Service ID**.
3. Em **Email Templates**, crie um template com as variáveis `{{nome}}`, `{{codigo}}`, `{{email}}` (veja o exemplo de texto dentro de `js/emailjs-config.js`) → copie o **Template ID**.
4. Em **Account → General**, copie sua **Public Key**.
5. Cole os 3 valores em `js/emailjs-config.js`.
6. Em **Account → Security**, ative **"Restrict allowed origins"** e adicione o domínio do GitHub Pages (ex: `seu-usuario.github.io`) para reduzir risco de uso indevido das chaves (elas ficam visíveis no código, é assim que o EmailJS funciona).

### 3. Publicar no GitHub Pages

```bash
git init
git add .
git commit -m "Primeira versão do Piscina Vért Ville"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/PiscinaVertVille.git
git push -u origin main
```

Depois, em **Settings → Pages** do repositório, selecione a branch `main` e a pasta raiz (`/`). O app fica disponível em `https://SEU_USUARIO.github.io/PiscinaVertVille/`.

### 4. Configurar a médica dentro do painel

Acesse `/painel.html`, faça login com o email/senha criados no passo 1.8, e configure em **Config**:
- Chave Pix, nome do recebedor, WhatsApp
- Valor do exame avulso
- Horário de atendimento e duração de cada exame (em minutos)
- Pacotes anuais (quantidade de exames, intervalo em meses, valor total)

E em **Plantões**, cole a lista de dias de plantão (uma data por linha) sempre que a escala mudar.

## Estrutura de dados (Firestore)

```
moradores/{id}            → nome, casa, email, verificado, codigoVerificacao
plantoesImportados/{id}   → data (backup manual dos plantões do Shiftr)
bloqueiosManuais/{id}     → data, horarioInicio, horarioFim, motivo
configExame/unico         → valorAvulso, chavePix, whatsappMedica, pacotes[], horarioInicio, horarioFim, duracaoSlotMinutos
agendamentos/{id}         → moradorId, tipo, datas[{data, horario, status}], valorTotal, statusPagamento
```

## Limitação de segurança conhecida

O cadastro do morador não usa Firebase Auth (é só verificação por código de email + sessão salva no navegador). Isso significa que as regras do Firestore não conseguem restringir escrita "apenas ao dono do registro" da forma mais rígida possível. O risco prático é baixo (nenhum dado sensível é armazenado, no máximo alguém poderia criar agendamentos falsos — visíveis e removíveis pela médica no painel), mas está documentado em `firestore.rules.txt` para evolução futura, caso queira reforçar com Cloud Functions.

## Próximos passos sugeridos

- [ ] Gerar ícones definitivos (os atuais em `icons/` são placeholders simples)
- [ ] Quando o Shiftr tiver exportação automática em CSV, testar a importação por arquivo
- [ ] Avaliar gateway de pagamento (cartão/parcelamento automático) numa fase futura
