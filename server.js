// BotHost Runner — deploy to Railway / Render / Koyeb
// Spawns one Node.js child process per Discord bot, supervised by PM2
// Streams status + logs back to the BotHost web app via HMAC-signed webhook

import express from "express";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";

const PORT = process.env.PORT || 8080;
const SHARED_SECRET = process.env.RUNNER_SHARED_SECRET;
const WEB_APP_URL = process.env.WEB_APP_URL;
const NODE_ENV = process.env.NODE_ENV || "production";

if (!SHARED_SECRET || !WEB_APP_URL) {
  console.error("❌ FATAL: RUNNER_SHARED_SECRET and WEB_APP_URL are required.");
  process.exit(1);
}

const WORKDIR = "/tmp/bots";
const processes = new Map(); // botId -> { proc, status, startedAt, token, startCommand, env, dir, autoRestart }

const app = express();
app.use(express.json({ limit: "10mb" }));

// ========== MIDDLEWARE ==========

// Health check - no auth required
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    botsRunning: processes.size,
    timestamp: new Date().toISOString(),
  });
});

// Auth middleware
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/, "");
  
  if (token !== SHARED_SECRET) {
    console.warn(`❌ Unauthorized access attempt from ${req.ip}`);
    return res.status(401).json({ error: "unauthorized" });
  }
  
  next();
});

// ========== WEBHOOK ==========

async function postWebhook(payload) {
  try {
    const body = JSON.stringify(payload);
    const sig = createHmac("sha256", SHARED_SECRET).update(body).digest("base64");
    
    const response = await fetch(`${WEB_APP_URL}/api/public/runner-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Runner-Signature": sig,
      },
      body,
    });
    
    if (!response.ok) {
      console.warn(`⚠️  Webhook returned ${response.status}`);
    }
  } catch (e) {
    console.error(`❌ Webhook failed: ${e?.message}`);
  }
}

function emitStatus(botId, status) {
  console.log(`📡 Bot ${botId}: status=${status}`);
  postWebhook({
    botId,
    type: "status",
    status,
    timestamp: new Date().toISOString(),
  });
}

function emitLog(botId, level, message) {
  const logMsg = message.slice(0, 4000);
  console.log(`[${level.toUpperCase()}] ${botId}: ${logMsg}`);
  postWebhook({
    botId,
    type: "log",
    log: {
      level,
      message: logMsg,
      timestamp: new Date().toISOString(),
    },
  });
}

// ========== BOT LIFECYCLE ==========

async function writeFiles(botId, files) {
  const dir = join(WORKDIR, botId);
  
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
  
  await mkdir(dir, { recursive: true });
  
  for (const f of files) {
    const p = join(dir, f.path);
    await mkdir(join(p, ".."), { recursive: true });
    await writeFile(p, f.content);
  }
  
  return dir;
}

async function installAndStart(botId, dir, token, startCommand, env, autoRestart = true) {
  // Install dependencies
  if (existsSync(join(dir, "package.json"))) {
    emitLog(botId, "info", "📦 Installing dependencies (npm install --omit=dev)...");
    
    await new Promise((resolve) => {
      const p = spawn("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], {
        cwd: dir,
        stdio: "pipe",
      });
      
      p.stdout.on("data", (d) => {
        const msg = d.toString().trim();
        if (msg) emitLog(botId, "info", msg);
      });
      
      p.stderr.on("data", (d) => {
        const msg = d.toString().trim();
        if (msg) emitLog(botId, "warn", msg);
      });
      
      p.on("close", (code) => {
        if (code !== 0) {
          emitLog(botId, "error", `npm install exited with code ${code}`);
        }
        resolve();
      });
    });
  }

  // Start bot process
  emitLog(botId, "info", `🚀 Starting: ${startCommand}`);
  const [cmd, ...args] = startCommand.split(" ");
  
  const proc = spawn(cmd, args, {
    cwd: dir,
    env: {
      ...process.env,
      ...env,
      DISCORD_TOKEN: token,
      NODE_ENV,
    },
    stdio: "pipe",
  });

  const record = {
    proc,
    status: "starting",
    startedAt: Date.now(),
    autoRestart,
    token,
    startCommand,
    env,
    dir,
  };
  
  processes.set(botId, record);
  emitStatus(botId, "starting");

  // Handle stdout/stderr
  proc.stdout.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) emitLog(botId, "info", msg);
  });

  proc.stderr.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) emitLog(botId, "error", msg);
  });

  // Mark as online after 3 seconds if still running
  setTimeout(() => {
    const rec = processes.get(botId);
    if (rec && !rec.proc.killed && rec.proc.exitCode === null && rec.status === "starting") {
      rec.status = "online";
      emitStatus(botId, "online");
      emitLog(botId, "success", "✅ Bot is online");
    }
  }, 3000);

  // Handle exit
  proc.on("exit", (code, signal) => {
    const rec = processes.get(botId);
    if (!rec) return;

    const exitMsg = signal ? `killed by ${signal}` : `exited with code ${code}`;
    emitLog(botId, code === 0 ? "info" : "error", `Process ${exitMsg}`);

    if (rec.autoRestart && rec.status !== "stopping") {
      emitLog(botId, "warn", "⚠️  Auto-restart in 3s...");
      setTimeout(() => {
        installAndStart(botId, dir, rec.token, rec.startCommand, rec.env, true).catch(
          (e) => emitLog(botId, "error", `Restart failed: ${e.message}`)
        );
      }, 3000);
    } else {
      processes.delete(botId);
      emitStatus(botId, code === 0 ? "offline" : "error");
    }
  });
}

// ========== ROUTES ==========

// POST /bots — Deploy a new bot
app.post("/bots", async (req, res) => {
  const { botId, token, startCommand, files, env } = req.body;

  if (!botId || !token || !files) {
    return res.status(400).json({ error: "missing fields: botId, token, files" });
  }

  try {
    const dir = await writeFiles(botId, files);
    processes.set(botId, {
      dir,
      token,
      startCommand: startCommand || "node index.js",
      env: env || {},
      status: "offline",
      autoRestart: true,
    });
    emitLog(botId, "success", "Bot deployed to runner");
    res.json({ ok: true, botId });
  } catch (e) {
    emitLog(botId, "error", `Deployment failed: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// POST /bots/:id/start — Start a bot
app.post("/bots/:id/start", async (req, res) => {
  const botId = req.params.id;
  const rec = processes.get(botId);

  if (!rec) {
    return res.status(404).json({ error: "bot not deployed" });
  }

  if (rec.proc && rec.proc.exitCode === null) {
    return res.json({ ok: true, note: "already running" });
  }

  try {
    await installAndStart(botId, rec.dir, rec.token, rec.startCommand, rec.env, true);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /bots/:id/stop — Stop a bot
app.post("/bots/:id/stop", (req, res) => {
  const botId = req.params.id;
  const rec = processes.get(botId);

  if (!rec || !rec.proc) {
    return res.json({ ok: true });
  }

  rec.status = "stopping";
  rec.proc.kill("SIGTERM");
  emitStatus(botId, "offline");
  emitLog(botId, "info", "Bot stopped");
  res.json({ ok: true });
});

// POST /bots/:id/restart — Restart a bot
app.post("/bots/:id/restart", async (req, res) => {
  const botId = req.params.id;
  const rec = processes.get(botId);

  if (!rec) {
    return res.status(404).json({ error: "not found" });
  }

  if (rec.proc) {
    rec.status = "stopping";
    rec.proc.kill("SIGTERM");
  }

  emitStatus(botId, "restarting");
  emitLog(botId, "info", "Bot restarting...");

  setTimeout(() => {
    installAndStart(botId, rec.dir, rec.token, rec.startCommand, rec.env, true).catch((e) =>
      emitLog(botId, "error", `Restart failed: ${e.message}`)
    );
  }, 1500);

  res.json({ ok: true });
});

// GET /bots/:id/status — Get bot status
app.get("/bots/:id/status", (req, res) => {
  const botId = req.params.id;
  const rec = processes.get(botId);

  if (!rec) {
    return res.json({ status: "offline" });
  }

  res.json({
    status: rec.status,
    uptimeSeconds: rec.startedAt ? Math.floor((Date.now() - rec.startedAt) / 1000) : 0,
    pid: rec.proc?.pid || null,
  });
});

// DELETE /bots/:id — Delete a bot
app.delete("/bots/:id", async (req, res) => {
  const botId = req.params.id;
  const rec = processes.get(botId);

  if (rec?.proc) {
    rec.proc.kill("SIGKILL");
  }

  if (rec?.dir) {
    await rm(rec.dir, { recursive: true, force: true }).catch(() => {});
  }

  processes.delete(botId);
  emitLog(botId, "info", "Bot deleted");
  res.json({ ok: true });
});

// ========== ERROR HANDLING ==========

app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ error: "internal server error" });
});

app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

// ========== STARTUP ==========

app.listen(PORT, () => {
  console.log(`\n✅ BotHost Runner listening on port ${PORT}`);
  console.log(`🔒 Shared secret configured: ${SHARED_SECRET ? "yes" : "no"}`);
  console.log(`📡 Webhook URL: ${WEB_APP_URL}\n`);
});
