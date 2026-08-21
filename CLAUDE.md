# CLAUDE.md

## Project Structure

ExcaliPPT is a **monorepo** (a fork of Excalidraw) with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Workflow

1. **Package Development**: Work in `packages/*` for editor features
2. **App Development**: Work in `excalidraw-app/` for app-specific features
3. **Testing**: Always run `yarn test:update` before committing
4. **Type Safety**: Use `yarn test:typecheck` to verify TypeScript

## Development Commands

```bash
yarn test:typecheck  # TypeScript type checking
yarn test:update     # Run all tests (with snapshot updates)
yarn fix             # Auto-fix formatting and linting issues
```

## 本地启动与测试

**端口分离**(3000 被 Obsidian 占用):dev server / e2e 用 **3001**,docker 用 **3100**——dev/e2e 与 docker 解耦,可同时运行。

- **dev server**:`yarn start`(→ `excalidraw-app` 的 `vite`)。端口真源是 `.env.development` 的 `VITE_APP_PORT=3001`;`excalidraw-app/vite.config.mts` 的 `server.port` 读它(`|| 3001` 兜底,`strictPort: true` 防漂移)。访问 http://localhost:3001 。临时覆盖:`VITE_APP_PORT=xxxx yarn start`。
- **e2e**:`yarn test:e2e`(Playwright `webServer` 自动起 vite on 3001,`baseURL` http://localhost:3001)。首次需 `npx playwright install chromium`;本地复用已运行的 dev server(同端口 3001)。
- **类型/单元**:`yarn test:typecheck` / `yarn test:update`(vitest)。

> dev/e2e(3001)与 docker(3100)端口分离,**不再互斥**,可同时运行。dev 与 e2e 共用 3001,但不同时跑(e2e 默认 `reuseExistingServer` 复用已运行的 dev server)。

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration

## Docker 部署

部署文档与命令详见 `DEPLOYMENT.md`。要点:

- **权威源(本仓库根,git 跟踪)**:`Dockerfile`、`.dockerignore`、`docker-compose.yml`、`docker-compose.dev.yml`、`DEPLOYMENT.md`。
- **部署运行入口**:`~/Documents/Docker/excalippt/`(本机其他 docker 服务 funasr、lunatv 亦集中于此)。内含 `docker-compose.yml` + `DEPLOYMENT.md` 的**副本**(从仓库根 cp 而来)。
- **改 compose / 文档后**:先在仓库根改,再 `cp docker-compose.yml DEPLOYMENT.md ~/Documents/Docker/excalippt/`,随后在部署目录 `docker compose up --build -d`。
- **build.context 为本机绝对路径**(`/Users/zzb/Documents/Project/IMAGE/ExcaliPPT`),使副本能在部署目录找到源码构建;**换机器需更新此路径**。
- **`Dockerfile` / `.dockerignore` 留仓库根**,勿移走——CI(`.github/workflows/*-docker.yml` 的 `docker build .` / `context: .`)依赖它。
- 端口 `3100:80`(3000 被 Obsidian 占用)。

## Docker 部署注意事项(2026-08-14 事故教训)

- **构建耗时约 15 分钟**(容器内 yarn install + 生产构建;BuildKit 历史实测 14~18 分钟)。远超 Claude 工具 10 分钟前台超时——自动化部署一律**拆两步**:`docker compose build` 成功后再 `docker compose up -d`(后者秒级原子替换,无中断窗口)。
- **不要中途杀 compose**:`up --build -d` 会在构建未完成时先停旧容器(经 Docker Desktop 进程执行,日志表现为 GUI 通道的 `ContainerStopComposeLinux`);此时杀掉 compose(超时清理 / pkill)→ 新镜像没产出、旧容器已停 → 3100 永久中断,只能重新完整构建。
- **`up -d` 不带 `--build` 不重建镜像**:镜像未更新时它无事可做(只显示 Running)。部署后用 `docker image inspect <image> --format '{{.Created}}'` 核对镜像日期,确认跑的是新代码。
- 排查依据:`docker buildx history ls` 可查每次构建的时长/状态/取消记录(定位"构建是否真的跑过/被谁中断");`docker inspect` 时间戳为 UTC,`buildx history` 为本地时区,对照时先换算。
