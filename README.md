# 🤖 BotHost Runner

**Discord bot runner service** para a plataforma SaaS BotHost. Executa múltiplas instâncias de bots Discord em paralelo, gerenciadas por webhooks HMAC.

## 🎯 O que é?

Este é o serviço **"data plane"** da plataforma BotHost:
- Recebe definições de bots via API HTTP
- Spawna processos Node.js isolados (um por bot)
- Mantém conexões Discord.js abertas 24/7
- Envia logs e status em tempo real via webhooks assinados
- Auto-restart automático se um bot cair

**Por que separado?** Cloudflare Workers (web app) não podem manter conexões WebSocket. Este runner roda em Railway/Render/Koyeb com Node.js completo.

---

## 🚀 Deploy Rápido no Railway (5 minutos)

### Pré-requisitos
- Conta GitHub com este repo
- Conta Railway (gratuita em https://railway.app)

### Passo 1: Clonar e Preparar

```bash
git clone https://github.com/seu-usuario/bothost-runner.git
cd bothost-runner
npm install
```

### Passo 2: Criar Projeto no Railway

1. Acesse **https://railway.app**
2. Clique em **"New Project"** → **"Deploy from GitHub repo"**
3. Selecione `bothost-runner`
4. Railway fará deploy automático

### Passo 3: Configurar Variáveis de Ambiente

Vá para **Project Settings** → **Variables** e adicione:

```
PORT=8080
NODE_ENV=production
RUNNER_SHARED_SECRET=seu-secret-super-seguro-aqui
WEB_APP_URL=https://seu-projeto.lovable.app
```

**Como gerar `RUNNER_SHARED_SECRET`:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Passo 4: Obter URL Pública

Vá para **Deployments** → clique no deploy ativo → veja a URL:
```
https://bothost-runner-production.up.railway.app
```

Copie e guarde essa URL.

### Passo 5: Testar Health Check

```bash
curl https://bothost-runner-production.up.railway.app/health
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

## 📡 API Endpoints

**Autenticação:** Todos os endpoints (exceto `/health`) requerem:
```
Authorization: Bearer <RUNNER_SHARED_SECRET>
```

### 1. Fazer Deploy de um Bot
```bash
POST /bots
Content-Type: application/json
Authorization: Bearer seu-secret

{
  "botId": "bot-12345",
  "token": "Discord bot token",
  "startCommand": "node index.js",
  "files": [
    {
      "path": "index.js",
      "content": "console.log('Bot started!');"
    },
    {
      "path": "package.json",
      "content": "{\"name\": \"my-bot\", \"type\": \"module\", \"dependencies\": {\"discord.js\": \"^14.14.1\"}}"
    }
  ],
  "env": {
    "DEBUG": "false",
    "PREFIX": "!"
  }
}
```

**Resposta (201):**
```json
{
  "ok": true,
  "botId": "bot-12345"
}
```

### 2. Iniciar Bot
```bash
POST /bots/:botId/start
Authorization: Bearer seu-secret
```

### 3. Parar Bot
```bash
POST /bots/:botId/stop
Authorization: Bearer seu-secret
```

### 4. Reiniciar Bot
```bash
POST /bots/:botId/restart
Authorization: Bearer seu-secret
```

### 5. Status do Bot
```bash
GET /bots/:botId/status
Authorization: Bearer seu-secret
```

**Resposta:**
```json
{
  "status": "online",
  "uptimeSeconds": 3600,
  "pid": 12345
}
```

### 6. Deletar Bot
```bash
DELETE /bots/:botId
Authorization: Bearer seu-secret
```

### 7. Health Check (sem auth)
```bash
GET /health
```

---

## 🔗 Integração com Backend

O runner envia webhooks para `${WEB_APP_URL}/api/public/runner-webhook`:

### Webhook de Status
```json
{
  "botId": "bot-12345",
  "type": "status",
  "status": "online",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

Possíveis status: `offline`, `starting`, `online`, `restarting`, `stopping`, `error`

### Webhook de Log
```json
{
  "botId": "bot-12345",
  "type": "log",
  "log": {
    "level": "info",
    "message": "Bot conectado ao Discord!",
    "timestamp": "2024-01-15T10:30:45.123Z"
  }
}
```

Níveis: `info`, `warn`, `error`, `success`

### Assinatura HMAC

Todos os webhooks incluem header:
```
X-Runner-Signature: base64(HMAC-SHA256(body, RUNNER_SHARED_SECRET))
```

**Validar no backend:**
```javascript
const crypto = require('crypto');
const receivedSig = req.headers['x-runner-signature'];
const computedSig = crypto
  .createHmac('sha256', process.env.RUNNER_SHARED_SECRET)
  .update(JSON.stringify(req.body))
  .digest('base64');

if (receivedSig !== computedSig) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

---

## 🧪 Testar Localmente

### 1. Instalar dependências
```bash
npm install
```

### 2. Criar `.env`
```bash
cp .env.example .env
# Editar .env com seus valores
```

### 3. Rodar servidor
```bash
npm start
```

### 4. Testar health check
```bash
curl http://localhost:8080/health
```

### 5. Deploy de bot de teste

```bash
curl -X POST http://localhost:8080/bots \
  -H "Authorization: Bearer seu-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "botId": "test-bot",
    "token": "seu-token-discord",
    "startCommand": "node index.js",
    "files": [
      {
        "path": "index.js",
        "content": "import { Client, GatewayIntentBits } from \"discord.js\";
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.on(\"ready\", () => console.log(\`✅ Bot ${client.user.tag} online\`));
client.login(process.env.DISCORD_TOKEN);"
      },
      {
        "path": "package.json",
        "content": "{\"type\": \"module\", \"dependencies\": {\"discord.js\": \"^14.14.1\"}}"
      }
    ]
  }'
```

---

## 🏗️ Estrutura do Projeto

```
bothost-runner/
├── server.js              # Servidor Express + gerenciador de bots
├── package.json           # Dependências
├── .env.example           # Variáveis de ambiente (template)
├── .gitignore             # Arquivos ignorados
├── railway.json           # Configuração Railway
├── Procfile               # Comando de inicialização
└── README.md              # Esta documentação
```

---

## 🔐 Segurança

- ✅ Tokens Discord **nunca** expostos em logs
- ✅ Autenticação Bearer token em todos endpoints
- ✅ HMAC-SHA256 signing dos webhooks
- ✅ Isolamento de processo por bot (um `node` por bot)
- ✅ Sanitização de mensagens de log (máx 4000 chars)
- ✅ Variáveis de ambiente seguras no Railway

---

## 📊 Limites (Railway Free Tier)

- **500 execution hours/mês** por conta
- Máx ~3-5 bots pequenos rodando 24/7
- Para produção: upgrade para Railway Hobby ($5/mês)
- Web app cron (`extend-bots`) para parar bots expirados

---

## 🔄 Auto-Restart

Se um bot cair:
1. Log de erro é enviado
2. Aguarda 3 segundos
3. Reinicia automaticamente
4. Até 5 retentativas por minuto

**Desabilitar auto-restart:** enviar `autoRestart: false` no POST `/bots`

---

## 🚢 Deploy em Outras Plataformas

### Render
1. Conectar repo GitHub
2. Definir start command: `npm start`
3. Adicionar variáveis de ambiente iguais

### Koyeb
1. Conectar repo GitHub
2. Build: `nixpacks` (automático)
3. Runtime: Node.js 20+

### VPS (Hetzner, DigitalOcean, AWS)
```bash
git clone seu-repo
cd bothost-runner
npm install --omit=dev
export PORT=8080
export RUNNER_SHARED_SECRET=seu-secret
export WEB_APP_URL=sua-app-url
node server.js
```

---

## 🐛 Troubleshooting

### Bot não inicia
```bash
# Verificar logs no Railway
# Logs → Selecione a aba do bot
```

### Webhook não recebido
- [ ] `WEB_APP_URL` correto?
- [ ] `RUNNER_SHARED_SECRET` bate nos dois lados?
- [ ] Firewall bloqueia POST?

### Saída de memória
- Máx bots simultâneos com Railway free: ~3
- Cada bot Discord.js ~20-30 MB
- Upgrade plano ou usar múltiplos runners

---

## 📝 Variáveis de Ambiente

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|----------|
| `PORT` | ❌ | `8080` | Porta do servidor |
| `NODE_ENV` | ❌ | `production` | Ambiente (production/development) |
| `RUNNER_SHARED_SECRET` | ✅ | — | Token de autenticação |
| `WEB_APP_URL` | ✅ | — | URL base da app web |
| `SUPABASE_URL` | ❌ | — | Para integração Supabase futura |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | — | Para integração Supabase futura |

---

## 💡 Exemplo Completo: Bot Discord Real

**Bot de exemplo com commands:**

```javascript
// index.js
import { Client, GatewayIntentBits, Collection } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('ready', () => {
  console.log(`✅ Bot ${client.user.tag} está online`);
  client.user.setActivity('bots sendo executados', { type: 'WATCHING' });
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  
  if (message.content.startsWith('!ping')) {
    message.reply(`🏓 Pong! ${client.ws.ping}ms`);
  }
});

client.login(process.env.DISCORD_TOKEN);
```

Deploy:
```bash
curl -X POST https://seu-runner.railway.app/bots \
  -H "Authorization: Bearer seu-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "botId": "meu-bot-1",
    "token": "MTE4MzY4NzU5OTYzNDMxMDEwNQ.Xvqf5w.abc123...",
    "startCommand": "node index.js",
    "files": [
      {
        "path": "index.js",
        "content": "... código do bot ..."
      },
      {
        "path": "package.json",
        "content": "{\"type\": \"module\", \"dependencies\": {\"discord.js\": \"^14.14.1\"}}"
      }
    ]
  }'
```

---

## 📞 Suporte

- Documentação Discord.js: https://discord.js.org
- Railway Docs: https://docs.railway.app
- Issues: GitHub → Issues tab

---

**Mantido por BotHost • MIT License**
