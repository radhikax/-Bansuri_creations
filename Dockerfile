# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY next.config.ts tsconfig.json postcss.config.mjs ./
COPY app ./app
COPY src ./src
ENV NEXT_TELEMETRY_DISABLED=1
# next build() calls next.config.ts's rewrites() once to bake routes-manifest.json,
# so API_INTERNAL_URL must be set here too, not only at container runtime (where the
# orchestrator — compose/docker run — sets it again for the server's own fetches).
# NEXT_PUBLIC_SITE_URL is inlined into client bundles at build time only.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ARG NEXT_PUBLIC_SITE_URL=http://localhost:8080
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
# The published node:24-bookworm-slim base can lag Debian's security fixes; pull
# them in before dropping to the unprivileged user (Trivy fails the CI build on
# fixable HIGH/CRITICAL findings). CI passes today's date: a new value re-runs
# this layer instead of reusing a cached one from before the latest fixes.
ARG OS_UPDATES_DATE
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
USER node
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8080/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
