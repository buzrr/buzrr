# Buzrr API (NestJS + Socket.IO). Build from the repo root:
#
#   docker build -f apps/server/Dockerfile -t buzrr-server .
#
# The same image runs database migrations (see docker-compose.yml, `migrate`).

FROM node:20-bookworm-slim AS build
# The Prisma CLI's schema engine links OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# prisma.config.ts reads a URL while `prisma generate` runs during install;
# nothing connects to it at build time.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    DIRECT_URL=postgresql://build:build@localhost:5432/build

# Manifests and shared packages first so dependency layers cache across
# application edits.
COPY package.json yarn.lock .yarnrc.yml tsconfig.json prisma.config.ts ./
COPY .yarn/releases ./.yarn/releases
COPY packages ./packages
COPY apps/server/package.json ./apps/server/
RUN yarn workspaces focus server @buzrr/prisma @buzrr/contract

COPY apps/server ./apps/server
RUN yarn workspace @buzrr/contract build \
 && yarn workspace @buzrr/prisma build \
 && yarn workspace server build

# --------------------------------------------------------------------------- #

FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    STORAGE_LOCAL_DIR=/data/uploads

# Dev dependencies stay: the Prisma CLI in them is how this image runs
# `migrate deploy`.
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node

EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "apps/server/dist/src/main.js"]
