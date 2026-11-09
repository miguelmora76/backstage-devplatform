# syntax=docker/dockerfile:1
#
# App image of the guardrails sample (u5-compose-and-ci): u4's backend with the
# built frontend. Build from the project root:
#
#   docker build -f packages/backend/Dockerfile -t guardrails-app .
#
# Multi-stage: the build stage compiles the frontend and the backend bundle;
# the final stage holds only the unpacked bundle, production dependencies and
# the built frontend. It runs as the non-root "node" user and exposes one
# port. Settings come from the environment (see compose.yaml); no secret is a
# build argument or in a layer.

ARG NODE_IMAGE=node:24.11.0-alpine3.22

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json yarn.lock tsconfig.json ./
COPY packages/app/package.json packages/app/
COPY packages/backend/package.json packages/backend/
COPY packages/e2e/package.json packages/e2e/
COPY packages/guardrails-server/package.json packages/guardrails-server/
COPY packages/plugin-guardrails/package.json packages/plugin-guardrails/
COPY packages/plugin-guardrails-backend/package.json packages/plugin-guardrails-backend/
RUN yarn install --frozen-lockfile --ignore-scripts
COPY packages packages
RUN yarn workspace app build
RUN yarn --cwd packages/backend backstage-cli package build
# The frontend twice over would add 30 MB: the runtime image keeps the static
# files once (the pristine copy) and an empty static directory to mount over.
RUN cp -R packages/app/dist /frontend \
    && rm -rf /frontend/static/* \
    && chmod -R a+rX /frontend packages/app/dist/static

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
# The skeleton holds the package.json files; the install takes production
# dependencies only (no development dependencies, no test code).
COPY package.json yarn.lock ./
COPY --from=build /app/packages/backend/dist/skeleton.tar.gz ./
RUN tar xzf skeleton.tar.gz --no-same-permissions --no-same-owner \
    && rm skeleton.tar.gz
# Production install, then remove what the running backend never loads (type
# declarations, the compiler, test tooling and the unused SQLite client: the
# compose run uses PostgreSQL). Removed in the same layer, so the image does
# not keep them (NFR1.4: at most 550 MB).
RUN yarn install --frozen-lockfile --production --ignore-scripts \
    && yarn cache clean \
    && cd node_modules \
    && rm -rf @types typescript @swc mockttp better-sqlite3 ts-json-schema-generator apache-arrow
COPY --from=build /app/packages/backend/dist/bundle.tar.gz ./
RUN tar xzf bundle.tar.gz --no-same-permissions --no-same-owner \
    && rm bundle.tar.gz
# The backend plugin package names its TypeScript source as "main" (it has no
# publishConfig), but the bundle holds its compiled files in dist: point the
# entry there. (A finding for u2: a publishConfig would make this unnecessary.)
RUN node -e "const fs=require('fs');const f='packages/plugin-guardrails-backend/package.json';const p=JSON.parse(fs.readFileSync(f,'utf8'));p.main='dist/index.js';p.types='dist/index.d.ts';fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
# The app backend plugin looks for the package named "app".
COPY --from=build /app/packages/app/package.json node_modules/app/package.json
COPY --from=build /frontend node_modules/app/dist
# Pristine copy of the static files: the start command copies it into the
# tmpfs that covers the static directory at run time (compose.yaml).
COPY --from=build /app/packages/app/dist/static /app/app-static-src
# The settings files and the committed catalog, read from /app.
COPY packages/backend/app-config.yaml packages/backend/app-config.postgres.yaml ./
COPY packages/backend/catalog ./catalog
USER node
EXPOSE 7007
CMD ["sh", "-c", "cp -R /app/app-static-src/. /app/node_modules/app/dist/static/ && exec node packages/backend --config app-config.yaml --config app-config.postgres.yaml"]
