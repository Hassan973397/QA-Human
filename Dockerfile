# Hasan QA Humans — containerized runner.
# Based on the official Playwright image so all browsers are preinstalled and
# match the bundled Playwright version.
FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app
ENV CI=1

# pnpm via corepack. A hoisted node-linker makes every dependency (including the
# workspace packages) resolvable from a single /app/node_modules, which the
# entrypoint symlinks into the mounted project so qa.config.ts imports resolve.
RUN corepack enable && printf 'node-linker=hoisted\n' > /app/.npmrc

# Install deps first (better layer caching), then the sources, then build.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile && pnpm build

COPY docker-entrypoint.sh /usr/local/bin/hqa-entrypoint
RUN chmod +x /usr/local/bin/hqa-entrypoint

# Browsers are preinstalled at this path inside the Playwright image.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Run against the *mounted* project (use `-w /work -v "$PWD":/work`).
WORKDIR /work
ENTRYPOINT ["hqa-entrypoint"]
CMD ["--help"]
