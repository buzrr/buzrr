# Buzrr web app (Next.js standalone, hosts Better Auth). Build from the repo
# root:
#
#   docker build -f apps/web/Dockerfile -t buzrr-web \
#     --build-arg PUBLIC_API_URL=http://localhost:3001 .
#
# NEXT_PUBLIC_* values are compiled into the browser bundle, so the URL
# browsers use to reach the API is a *build* argument: rebuild the image when
# it changes. Everything else (database, auth secret, sign-in methods) is
# read at runtime.

FROM node:20-bookworm-slim AS build
WORKDIR /app

ARG PUBLIC_API_URL=http://localhost:3001
ARG PUBLIC_WEB_URL=http://localhost:3000
# Empty hides Knowledge Spaces (the optional apps/ai service).
ARG PUBLIC_AI_API_URL=
ENV NEXT_PUBLIC_API_URL=$PUBLIC_API_URL \
    NEXT_PUBLIC_SOCKET_URL=$PUBLIC_API_URL \
    NEXT_PUBLIC_APP_URL=$PUBLIC_WEB_URL \
    NEXT_PUBLIC_AI_API_URL=$PUBLIC_AI_API_URL \
    NEXT_IMAGE_UNOPTIMIZED=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    DIRECT_URL=postgresql://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime \
    AUTH_EMAIL_PASSWORD=ON
# ^ Build-time only: prerendering initialises auth, which needs *a* sign-in
#   method. The running container reads its own env (lib/auth-methods.ts).

COPY package.json yarn.lock .yarnrc.yml tsconfig.json prisma.config.ts ./
COPY .yarn/releases ./.yarn/releases
COPY packages ./packages
COPY apps/web/package.json ./apps/web/
RUN yarn workspaces focus web @buzrr/prisma @buzrr/contract

COPY apps/web ./apps/web
RUN yarn workspace @buzrr/contract build \
 && yarn workspace @buzrr/prisma build \
 && yarn workspace web build

# --------------------------------------------------------------------------- #

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Standalone output mirrors the monorepo (outputFileTracingRoot is the repo
# root), so the server lives at apps/web/server.js.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
