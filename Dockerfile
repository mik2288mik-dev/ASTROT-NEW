# Multi-stage build для оптимизации размера образа

# Stage 1: Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Устанавливаем зависимости для кэширования слоя
COPY package.json package-lock.json ./

# Устанавливаем Python и компилятор для node-gyp (нужно для swisseph-v2)
RUN apk add --no-cache python3 make g++

# Устанавливаем все зависимости (нужны dev для сборки TypeScript/Tailwind)
# Используем --prefer-offline для ускорения сборки
RUN npm ci --prefer-offline --no-audit --no-fund

# Копируем остальные файлы проекта (используем .dockerignore для исключения ненужных файлов)
COPY . .

# Собираем Next.js приложение
RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Создаем непривилегированного пользователя для безопасности
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Копируем package.json для установки production зависимостей
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./

# Устанавливаем только production зависимости + tsx для миграций
# tsx нужен для запуска миграций в runtime
RUN npm ci --omit=dev --prefer-offline --no-audit --no-fund && \
    npm install --save-prod tsx && \
    npm cache clean --force

# Копируем собранное приложение и необходимые файлы
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/ephe ./ephe
COPY --from=builder --chown=nextjs:nodejs /app/metadata.json ./

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Запускаем миграции перед стартом приложения (в runtime с доступным DATABASE_URL)
CMD ["sh", "-c", "npm run migrate && npm start"]
