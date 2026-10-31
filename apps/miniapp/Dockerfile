# ------------------------------------------------------------
# Postora — Mini App (بناء ثابت يُخدَم من أي استضافة ساكنة + nginx)
# ------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/markdown-engine/package.json packages/markdown-engine/
COPY apps/server/package.json apps/server/
COPY apps/miniapp/package.json apps/miniapp/

RUN npm ci --workspace @postora/miniapp --workspace @postora/shared --workspace @postora/markdown-engine

COPY packages ./packages
COPY apps/miniapp ./apps/miniapp

RUN npm run build --workspace @postora/miniapp

FROM nginx:1.27-alpine
COPY --from=build /app/apps/miniapp/dist /usr/share/nginx/html
COPY apps/miniapp/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
