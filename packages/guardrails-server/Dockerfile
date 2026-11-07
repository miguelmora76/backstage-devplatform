# syntax=docker/dockerfile:1
#
# Guardrails server image (NFR2.7, NFR5.6). Build from the project root:
#
#   docker build -f packages/guardrails-server/Dockerfile -t guardrails-server .
#
# Multi-stage: the build stage compiles the TypeScript; the final stage holds
# only the compiled output and production dependencies, runs as the
# non-root "node" user and exposes one port. Settings come from the
# environment (GUARDRAILS_SEED, GUARDRAILS_FAILURE_MODE, PORT); nothing is
# written to disk, so the root file system can be read-only.

ARG NODE_IMAGE=node:24.11.0-alpine3.22

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/guardrails-server/package.json packages/guardrails-server/
RUN yarn install --frozen-lockfile --ignore-scripts
COPY tsconfig.json ./
COPY packages/guardrails-server/tsconfig.json packages/guardrails-server/tsconfig.build.json packages/guardrails-server/
COPY packages/guardrails-server/src packages/guardrails-server/src
RUN yarn --cwd packages/guardrails-server build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=7007
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/guardrails-server/package.json packages/guardrails-server/
RUN yarn install --frozen-lockfile --production --ignore-scripts \
    && yarn cache clean
COPY --from=build /app/packages/guardrails-server/dist packages/guardrails-server/dist
USER node
EXPOSE 7007
# The probe is a Node.js script that reads PORT: the image has no curl.
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=3 \
    CMD ["node", "packages/guardrails-server/dist/probe/healthcheck.js"]
CMD ["node", "packages/guardrails-server/dist/main.js"]
