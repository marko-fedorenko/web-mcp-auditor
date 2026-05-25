FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      xvfb \
      ca-certificates \
      fonts-liberation \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    XVFB_AVAILABLE=1 \
    NODE_ENV=production \
    AUDIT_CONCURRENCY=2

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

# Wrap in xvfb-run so the headed fallback works without extra setup.
CMD ["xvfb-run", "-a", "--server-args=-screen 0 1280x800x24", "node", "server.js"]
