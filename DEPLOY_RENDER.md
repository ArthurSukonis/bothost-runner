# BotHost Runner - Render Deployment

Guia de deployment no Render em 5 minutos.

## 🚀 Deploy Rápido no Render

### Passo 1: Preparar no GitHub
Seu repo já está pronto em: https://github.com/ArthurSukonis/bothost-runner

### Passo 2: Criar Conta Render
1. Acesse https://render.com
2. Clique em **Sign Up** (ou faça login se já tem conta)
3. Conecte sua conta GitHub

### Passo 3: Criar Novo Web Service
1. No dashboard Render, clique **"New ➜"** → **"Web Service"**
2. Selecione **"GitHub"** como repositório
3. Autorize Render acessar seus repositórios
4. Procure por `bothost-runner`
5. Selecione e clique **"Connect"**

### Passo 4: Configurar o Serviço

**Name:** `bothost-runner` (ou outro nome)

**Environment:** `Node`

**Region:** Escolha a mais próxima (ex: Ohio, Frankfurt)

**Branch:** `main`

**Build Command:** `npm install`

**Start Command:** `node server.js`

### Passo 5: Adicionar Variáveis de Ambiente

Vá para **Environment** e adicione:

```
PORT=8080
NODE_ENV=production
RUNNER_SHARED_SECRET=gere-um-secret-aleatorio-aqui
WEB_APP_URL=https://seu-app.lovable.app
```

**Para gerar `RUNNER_SHARED_SECRET`:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Passo 6: Configurar Plano

**Recomendado:** Free tier
- Suficiente para 1-2 bots Discord
- Spin down após 15 min sem requisições (reduz consumo)
- HTTPS automático

Para produção com bots 24/7:
- **Starter** ($7/mês) - recomendado
- Sem spin down
- 2.5 GB RAM
- Melhor uptime

### Passo 7: Deploy

1. Clique **"Create Web Service"**
2. Render fará build automaticamente
3. Aguarde 2-3 minutos
4. Quando ficar **Live**, está online!

### Passo 8: Obter URL Pública

No dashboard do serviço, você verá a URL como:
```
https://bothost-runner.onrender.com
```

Copie e guarde essa URL.

### Passo 9: Testar Health Check

```bash
curl https://bothost-runner.onrender.com/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "uptime": 123,
  "botsRunning": 0,
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

---

## ⚡ Vantagens do Render

✅ Free tier com HTTPS automático
✅ Deploys automáticos ao fazer push no GitHub
✅ Sem cartão de crédito para free tier
✅ Suporta Node.js nativo
✅ Logs em tempo real no dashboard
✅ Restart automático se cair
✅ Melhor suporte que Railway
✅ Build super rápido

---

## 📊 Limites Render Free Tier

- **1 web service gratuito**
- **0.5 vCPU + 512 MB RAM**
- **Spin down após 15 min sem requisições** (importante!)
- **Máx ~1 bot Discord pequeno** (com spin down)

### ⚠️ Problema: Spin Down

O Render coloca o app em sleep se não receber requisições por 15 minutos.

**Solução:** Use seu webhook para fazer ping periódico:

```javascript
// No seu backend, a cada 10 minutos:
setInterval(() => {
  fetch('https://seu-runner.onrender.com/health')
    .catch(console.error);
}, 10 * 60 * 1000);
```

Ou upgrade para **Starter** ($7/mês) - sem spin down!

---

## 🔄 Auto Deploy

Toda vez que você faz `git push` no `main`:
1. Render detecta automaticamente
2. Faz novo build
3. Deploy automático (zero downtime)

Não precisa fazer nada manualmente!

---

## 🐛 Troubleshooting Render

### Serviço não inicia
→ Vá em **Logs** e veja o erro em tempo real

### "npm: command not found"
→ Render detectou errado. Verifique se:
- `package.json` está na raiz
- Environment está como `Node`

### Bots caindo depois de 15 minutos
→ É o spin down do free tier
→ Upgrade para Starter ou use o ping periódico

### Porta errada
→ Certifique-se que a variável `PORT=8080` está setada

### Webhook não recebido
→ Verifique se `WEB_APP_URL` e `RUNNER_SHARED_SECRET` estão corretos em **Environment**

---

## 🚢 Comparação: Railway vs Koyeb vs Render

| Feature | Railway | Koyeb | Render |
|---------|---------|-------|--------|
| **Free Tier** | 500h/mês (~$5) | 2 apps ilimitados | 1 serviço + spin down |
| **Cartão obrigatório** | ❌ | ❌ | ❌ |
| **Auto-deploy GitHub** | ✅ | ✅ | ✅ |
| **Node.js Support** | ✅ | ✅ | ✅ |
| **Melhor para Produção** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| **Melhor para Dev/Teste** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Melhor Interface** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

---

## 💡 Dica: Qual Escolher?

### **Para Desenvolvimento**
→ **Koyeb** (2 apps grátis, sem spin down)

### **Para Produção (até 3 bots 24/7)**
→ **Railway Hobby** ($5/mês) ou **Render Starter** ($7/mês)

### **Produção em Escala**
→ **Railway ou Render** com plano pago

---

**Seu runner está pronto para Render!** 🎉
