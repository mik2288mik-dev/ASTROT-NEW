# syntax=docker/dockerfile:1.7

# Stage 1: install dependencies, compile native modules, and build Next.js.
# Keep the Docker runtime aligned with package.json/.nvmrc and Capacitor 8.
FROM node:22-alpine AS builder

WORKDIR /app

# node-gyp toolchain is needed only during build stage.
RUN apk add --no-cache python3 make g++ libc6-compat && \
    ln -sf python3 /usr/bin/python

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

ENV NEXT_TELEMETRY_DISABLED=1
# The server deployment is the Telegram WebApp. Native store artifacts always
# set their own explicit channel in scripts/android-release.mjs.
ARG DISTRIBUTION_CHANNEL=telegram
ENV NEXT_PUBLIC_DISTRIBUTION_CHANNEL=${DISTRIBUTION_CHANNEL}

COPY . .

RUN npm run build

# Next standalone already traces the server's runtime dependencies. Railway's
# pre-deploy migrations also need the TypeScript CLI and PostgreSQL packages;
# stage only that small dependency closure instead of copying all of npm.
RUN set -eu; \
    mkdir -p runtime-deps/node_modules/.bin runtime-deps/node_modules/@next; \
    for package in \
      tsx esbuild get-tsconfig resolve-pkg-maps \
      pg pg-connection-string pg-int8 pg-pool pg-protocol pg-types pgpass \
      postgres-array postgres-bytea postgres-date postgres-interval split2 xtend; do \
      cp -a "node_modules/$package" "runtime-deps/node_modules/$package"; \
    done; \
    if [ -d node_modules/pg-cloudflare ]; then \
      cp -a node_modules/pg-cloudflare runtime-deps/node_modules/pg-cloudflare; \
    fi; \
    cp -a node_modules/@next/env runtime-deps/node_modules/@next/env; \
    cp -a node_modules/@esbuild runtime-deps/node_modules/@esbuild; \
    ln -s ../tsx/dist/cli.mjs runtime-deps/node_modules/.bin/tsx; \
    (cd runtime-deps && node_modules/.bin/tsx --version && \
      node -e "require('pg'); require('@next/env')")


# Stage 2: minimal production runtime (no npm install, no compilers).
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN apk add --no-cache ca-certificates libc6-compat && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# RuStore's -m API hosts use the Russian Trusted certificate chain. Keep the
# chain in the image and expose the system bundle to Node before any Public API
# authentication or purchase validation can run.
COPY config/rustore-certificates/russian_trusted_root_ca.crt /usr/local/share/ca-certificates/russian_trusted_root_ca.crt
COPY config/rustore-certificates/russian_trusted_sub_ca.crt /usr/local/share/ca-certificates/russian_trusted_sub_ca.crt
RUN update-ca-certificates

# Standalone bundle contains only files needed at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Railway has historically retained an older standalone start path on some
# deployments. Keep that path valid so either "node server.js" or the legacy
# "node .next/standalone/server.js" starts the exact same standalone server.
RUN mkdir -p .next/standalone && \
    printf "require('../../server.js');\n" > .next/standalone/server.js && \
    chown -R nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Production validation and migrations run in Railway's pre-deploy container.
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/runtime-deps/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
# Ensure Swiss Ephemeris native binary is always present in runtime image.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/swisseph-v2/build ./node_modules/swisseph-v2/build
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/ephe ./ephe
COPY --from=builder --chown=nextjs:nodejs /app/metadata.json ./metadata.json

USER nextjs

EXPOSE 3000

# Healthcheck hits /api/health: this endpoint also idempotently ensures the
# in-process notification scheduler is running.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "const port=process.env.PORT||3000;require('node:http').get({host:'127.0.0.1',port,path:'/api/health'},(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
