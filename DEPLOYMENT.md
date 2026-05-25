# Deployment guide — Web MCP Auditor

Аудитор — це Node.js Express-сервер + headless Chromium ≥ 149. Цей документ покриває локальний запуск, Docker, реверс-проксі з subpath, та хмарні платформи.

> ⚠ **Chromium ≥ 149 required.** Web MCP runtime з'являється тільки в Chrome 149+. Якщо твій Chromium старіший — runtime checks будуть `n/a` (degraded mode). Для повного аудиту встанови `chrome@beta`:
> ```bash
> npx @puppeteer/browsers install chrome@beta
> ```
> Шлях до бінарника передай через env `PUPPETEER_EXECUTABLE_PATH` — або просто залиш Chrome у каталозі `./chrome/` чи `~/.cache/puppeteer/chrome/`, аудитор знайде сам.

---

## 1. Локально

```bash
npm install
npm start
```

Відкрий **http://localhost:3000**. Натисни одну з кнопок-фікстур під формою для швидкого тесту.

Тести: `npm test`.

### Перемикач мови
- Кнопки **EN / UK** у шапці.
- Альтернативно: `?lang=uk` у URL.
- Вибір зберігається у `localStorage`.

### Аудит локальних URL
За замовчуванням заблоковано (захист від SSRF). Дозволити:
```bash
ALLOW_LOCAL=1 npm start         # macOS/Linux
$env:ALLOW_LOCAL='1'; npm start # Windows PowerShell
```

---

## 2. Docker (single command)

```bash
docker build -t webmcp-auditor .
docker run --rm -p 3000:3000 --shm-size=1g webmcp-auditor
```

Образ — Debian slim + `chromium` + `xvfb`. `xvfb-run` гарантує, що headed-fallback працює навіть якщо headless mode не підтримує WebMCP.

> ⚠ Якщо Debian-`chromium` < 149 — runtime буде `unavailable`. У цьому випадку перейди на образ, що тягне свіжий Chromium:
> ```dockerfile
> FROM ghcr.io/puppeteer/puppeteer:24
> ```
> (більший образ, ~1.5 GB, але матчиться з найновішим Chromium що знає Puppeteer).

### Environment variables

| Var | Default | Призначення |
|---|---|---|
| `PORT` | `3000` | HTTP порт |
| `BASE_PATH` | (none) | Subpath, під яким монтується додаток. Напр. `/webmcp` → доступно на `http://host/webmcp/` |
| `AUDIT_CONCURRENCY` | `2` | Макс. одночасних аудитів |
| `ALLOW_LOCAL` | unset | `1` — дозволити localhost/RFC1918 URL |
| `XVFB_AVAILABLE` | unset | `1` — дозволити headed-Xvfb fallback на Linux |
| `WEBMCP_DISABLE` | unset | `1` — примусово degraded mode (для тестування) |
| `PUPPETEER_EXECUTABLE_PATH` | unset | Шлях до конкретного Chrome бінарника |
| `PUPPETEER_SKIP_DOWNLOAD` | `1` (у Dockerfile) | Не качати Puppeteer-bundled Chromium |

Приклад з кастомним префіксом і дозволеним localhost:
```bash
docker run --rm -p 3000:3000 --shm-size=1g \
  -e BASE_PATH=/webmcp \
  -e ALLOW_LOCAL=1 \
  webmcp-auditor
# → відкрий http://localhost:3000/webmcp/
```

---

## 3. Реверс-проксі + subpath

Аудитор працює під будь-яким префіксом, бо в HTML стоїть `<base href="./">`, а всі URL у фронті відносні.

### Варіант A: Проксі скидає префікс
Найпростіше. nginx видаляє `/webmcp/`, бекенд бачить запити на `/`.

```nginx
location /webmcp/ {
  proxy_pass http://127.0.0.1:3000/;   # ← trailing slash важлива
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_read_timeout 60s;
  proxy_send_timeout 60s;
}
```
Бекенд: `BASE_PATH` НЕ встановлюй, запускай як зазвичай.

### Варіант B: Проксі передає префікс
nginx залишає `/webmcp/` у URL, бекенд має знати про нього.

```nginx
location /webmcp/ {
  proxy_pass http://127.0.0.1:3000;    # ← БЕЗ trailing slash
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_read_timeout 60s;
}
```
Бекенд: `BASE_PATH=/webmcp npm start`. Або у docker run: `-e BASE_PATH=/webmcp`.

### Traefik (Docker labels)
```yaml
services:
  webmcp:
    image: webmcp-auditor
    environment:
      - BASE_PATH=/webmcp
    labels:
      - traefik.enable=true
      - traefik.http.routers.webmcp.rule=PathPrefix(`/webmcp`)
      - traefik.http.services.webmcp.loadbalancer.server.port=3000
```

### Caddy
```caddy
example.com {
  handle_path /webmcp/* {
    reverse_proxy localhost:3000
  }
}
# Бекенд: BASE_PATH не потрібен (Caddy скинув префікс).
```

---

## 4. Хмарні платформи

### Fly.io
```bash
fly launch --no-deploy            # генерує fly.toml
# Відредагуй fly.toml:
#   [build]
#     dockerfile = "Dockerfile"
#   [http_service]
#     internal_port = 3000
#     force_https = true
#     auto_stop_machines = "stop"
#     auto_start_machines = true
#     min_machines_running = 0
# Рекомендована машина: 1 vCPU, 1024 MB RAM
fly deploy
```

Memory ≥ 1 GB. Per-page Chromium може жерти 200–300 MB.

### Render
1. Створи **Web Service** → під'єднай GitHub-репо.
2. Environment: **Docker** (Render знайде Dockerfile).
3. Instance: **Starter** (512 MB) для тестів, **Standard** (2 GB) для прод.
4. Env vars: `AUDIT_CONCURRENCY=2`, опційно `BASE_PATH`, `ALLOW_LOCAL`.

### Railway
```bash
railway init
railway up
# Налаштуй env vars у UI: PORT (Railway сам) + опційні.
```

### VPS (Ubuntu + systemd)
```bash
# 1. Встанови node + chrome beta
apt install -y nodejs npm chromium xvfb \
  libnss3 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2 fonts-liberation
git clone <repo> /opt/webmcp-auditor && cd /opt/webmcp-auditor
npm ci --omit=dev
npx @puppeteer/browsers install chrome@beta

# 2. systemd unit /etc/systemd/system/webmcp-auditor.service
cat <<'EOF' > /etc/systemd/system/webmcp-auditor.service
[Unit]
Description=Web MCP Auditor
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/webmcp-auditor
Environment=PORT=3000
Environment=PUPPETEER_SKIP_DOWNLOAD=1
Environment=XVFB_AVAILABLE=1
ExecStart=/usr/bin/xvfb-run -a --server-args="-screen 0 1280x800x24" /usr/bin/node server.js
Restart=on-failure
RestartSec=5s
MemoryMax=1500M

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now webmcp-auditor
# nginx — див. розділ 3.
```

---

## 5. Resource sizing

| Метрика | Значення |
|---|---|
| Base RSS | ~150 MB (Node + lazy Chromium) |
| Per audit peak | +200–300 MB (Chromium page) |
| Перший аудит | 5–10 s (Chrome launch) |
| Наступні аудити (warm) | 2–5 s без execute, 5–15 s з execute |
| Recommended | 1 vCPU, 1 GB RAM, 1 GB disk |
| Hard cap | `AUDIT_CONCURRENCY=2` за замовчуванням; >4 ризиковано на 1 GB |

Browser перевикористовується між аудитами (`browserPromise` кешується), recycle після 50 аудитів.

---

## 6. Перевірка деплою

Швидкий smoke-тест після підняття:
```bash
# 1. Health endpoint (must show webmcpRuntime: "headless-new")
curl https://your-host/api/health

# 2. Audit example.com (will say "does not implement Web MCP" — that's correct)
curl -X POST https://your-host/api/audit \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'

# 3. UI
open https://your-host/        # або https://your-host/webmcp/ якщо є BASE_PATH
```

Шукай у health-відповіді:
- `webmcpRuntime: "headless-new"` ✓ — все добре
- `webmcpRuntime: "unavailable"` ⚠ — Chrome застарий, аудит працюватиме в degraded mode
- `chromeSource: "system-chrome-149"` чи інша версія ≥ 149 — правильний бінарник

---

## 7. Безпека

- За замовчуванням аудитор **не виконує tools** на цільовому сайті (опція `execute: false`). Опціональний `execute: true` запускає synthesized inputs — може мутувати стан, якщо tools не readOnly.
- SSRF захист: localhost / RFC1918 заблоковано якщо `ALLOW_LOCAL` не встановлено.
- Frontend санітизує усі рядки з відповіді API через `textContent` (не `innerHTML`) — XSS не пройде, навіть якщо аудитований сайт має `tool.description` з `<script>`.
- Sandbox: за замовчуванням Chrome запускається з `--no-sandbox` (потрібно для контейнерів). На VPS можеш прибрати цей флаг — додай `cap_add: SYS_ADMIN` або користуй sandbox-friendly Chromium.
- Recommended: додай rate-limit на `/api/audit` (token-bucket по IP) перед production-експозицією.

---

## 8. Troubleshooting

**`webmcpRuntime: "unavailable"` хоча Chrome 149 встановлено**
- Перевір що `PUPPETEER_EXECUTABLE_PATH` веде до правильного бінарника
- Лог: `chromeSource` показує, який бінарник було обрано
- WebMCP не доступний на opaque-origin (data:, blob:) — аудитуй HTTP(S) URL

**Аудит зависає**
- Перевір системні chrome-процеси: `ps aux | grep chrome | grep web-mcp`
- Recycle браузер: рестартуй сервіс
- Зменши `AUDIT_CONCURRENCY` до 1 на маленьких машинах

**"executeTool timeout" на declarative tools**
- Очікувано: declarative форми часто чекають на user gesture, чого в headless немає
- Це показано як `safety.execute-smoke: fail` — не баг аудитора

**Subpath деплой 404 на статику**
- Якщо проксі НЕ скидає префікс — встанови `BASE_PATH`
- Якщо проксі скидає префікс — `BASE_PATH` повинен бути порожнім
- Перевір що `<base href="./">` у HTML (так)

---

## 9. Файли

| Файл | Призначення |
|---|---|
| `server.js` | Express + BASE_PATH routing |
| `audit/runner.js` | Orchestrator (queue, timeout, page lifecycle) |
| `audit/browser.js` | Puppeteer launch + Chrome detection |
| `audit/probe.js` | Injected у сторінку, збирає raw data |
| `audit/checks.js` | Pure rawProbe → findings[] |
| `audit/checks-catalog.js` | Catalog: id, title, severity, howToFix (EN) |
| `audit/scoring.js` | Findings → score per category |
| `audit/schema-tools.js` | ajv + json-schema-faker для execute path |
| `public/index.html` | Frontend з `<base href="./">` |
| `public/app.js` | URL form handler, language toggle |
| `public/render.js` | DOM rendering, XSS-safe |
| `public/i18n.js` | EN + UK словник |
| `public/styles.css` | Lighthouse-стиль |
| `Dockerfile` | Production image |
| `test/checks.test.js` | vitest юніт-тести |
| `test/fixtures/*.html` | 3 тестові сторінки |
