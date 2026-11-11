# 前端镜像：安装依赖、构建、运行三个阶段。运行阶段只包含 Next 的 standalone 产物，用非 root 用户运行。

FROM node:24-alpine AS deps
WORKDIR /app
# 可选：构建时指定 npm 源（国内网络可以传 https://registry.npmmirror.com）。默认用 npm 官方源，仓库里不写镜像地址。
ARG NPM_REGISTRY=""
COPY package.json package-lock.json ./
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi \
    && npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# /api 和 /demo 的转发地址在构建时写进产物，所以必须作为 build arg 传入（compose 里是 http://backend:8080）
ARG BACKEND_INTERNAL_URL=http://backend:8080
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
