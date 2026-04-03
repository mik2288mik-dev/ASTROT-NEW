# syntax=docker/dockerfile:1.7

# Stage 1: install dependencies and compile native modules (swisseph-v2)
FROM node:20-alpine AS deps

WORKDIR /app

# node-gyp toolchain is needed only during build stage
RUN apk add --no-cache python3 make g++ libc6-compat && \
    ln -sf python3 /usr/bin/python

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund


# Stage 2: build Next.js app (standalone output)
FROM node:20-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


# Stage 3: minimal production runtime (no npm install, no compilers)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN apk add --no-cache libc6-compat && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# standalone bundle contains only files needed at runtime
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Ensure Swiss Ephemeris native binary is always present in runtime image
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/swisseph-v2/build ./node_modules/swisseph-v2/build
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/ephe ./ephe
COPY --from=builder --chown=nextjs:nodejs /app/metadata.json ./metadata.json

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('node:http').get('http://127.0.0.1:3000/',(r)=>process.exit(r.statusCode>=200&&r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
