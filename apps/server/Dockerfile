# ------------------------------------------------------------
# Postora — Backend (Express + Telegraf)
# بناء متعدد المراحل لتقليل حجم الصورة النهائية.
# ------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# ننسخ ملفات الحزم فقط للاستفادة من طبقات Docker المخزّنة
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/markdown-engine/package.json packages/markdown-engine/
COPY apps/server/package.json apps/server/
COPY apps/miniapp/package.json apps/miniapp/

RUN npm ci --omit=dev --workspace @postora/server --workspace @postora/shared --workspace @postora/markdown-engine

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# مستخدم غير جذري
RUN addgroup -S postora && adduser -S postora -G postora

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY scripts/migrate.js ./scripts/migrate.js

RUN chown -R postora:postora /app
USER postora

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/src/index.js"]
