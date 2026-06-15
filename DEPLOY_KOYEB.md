# BotHost Runner - Koyeb Deployment

Guia de deployment no Koyeb em 5 minutos.

## 🚀 Deploy Rápido no Koyeb

### Passo 1: Preparar no GitHub
Seu repo já está pronto em: https://github.com/ArthurSukonis/bothost-runner

### Passo 2: Criar Conta Koyeb
1. Acesse https://app.koyeb.com
2. Clique em **Sign Up** (ou faça login se já tem conta)
3. Conecte sua conta GitHub

### Passo 3: Criar Novo App
1. No dashboard Koyeb, clique **"Create App"**
2. Selecione **"GitHub"** como source
3. Autorize Koyeb acessar seus repositórios
4. Procure por `bothost-runner`
5. Selecione branch **`main`**

### Passo 4: Configurar Deployment

**Builder:** Deixe como automático (detecta Node.js)

**Build Command:** (deixe em branco - usa package.json)

**Run Command:** `npm start`

**Port:** `8080`

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

### Passo 6: Deploy
1. Clique **"Deploy"**
2. Aguarde o Koyeb fazer build e deploy (2-3 minutos)
3. Quando ficar **Green**, está online!

### Passo 7: Obter URL Pública

No dashboard do app Koyeb, você verá a URL como:
```
https://bothost-runner-seu-usuario.koyeb.app
```

Copie e guarde essa URL.

### Passo 8: Testar Health Check

```bash
curl https://bothost-runner-seu-usuario.koyeb.app/health
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

## ✨ Vantagens do Koyeb

✅ Free tier generoso (2 apps simultâneos)
✅ Deploys automáticos ao fazer push no GitHub
✅ Sem cartão de crédito (free tier completo)
✅ Suporta Node.js nativo
✅ HTTPS automático
✅ Logs em tempo real
✅ Restart automático

---

## 📊 Limites Koyeb Free Tier

- **2 apps simultâneos** (suficiente para teste)
- **~1 vCPU + 512 MB RAM** por app
- **Máx 1 bot Discord pequeno** rodando 24/7
- Para produção: upgrade para $5/mês (melhor que Railway)

---

## 🔄 Auto Deploy

Toda vez que você faz `git push` no `main`:
1. Koyeb detecta automaticamente
2. Faz novo build
3. Deploy automático (zero downtime)

Não precisa fazer nada manualmente!

---

## 🐛 Troubleshooting Koyeb

### App não inicia
→ Vá em **Logs** e veja o erro

### "npm: command not found"
→ Koyeb detectou errado. Vá em **Settings** → **Builder** → Mude para **Nixpacks**

### Porta errada
→ Certifique-se que a variável `PORT=8080` está setada

### Webhook não recebido
→ Verifique se `WEB_APP_URL` e `RUNNER_SHARED_SECRET` estão corretos em **Environment**

---

## 🚢 Comparação: Railway vs Koyeb

| Feature | Railway | Koyeb |
|---------|---------|-------|
| Free Tier | 500h/mês (~$5) | Ilimitado (2 apps) |
| Cartão obrigatório | ❌ | ✅ |
| Auto-deploy GitHub | ✅ | ✅ |
| Node.js Support | ✅ | ✅ |
| Recomendado | Produção | Dev/Teste |

---

**Seu runner está pronto para Koyeb!** 🎉
