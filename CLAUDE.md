# CLAUDE.md

## Project Structure

ExcaliPPT is a **monorepo** (a fork of Excalidraw) with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`desktop/`** - Electron 桌面壳(离线运行、原生置顶提词器、GitHub Releases 更新)
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

详见 **[DEPLOYMENT.md](./DEPLOYMENT.md)**(权威源说明、双 compose、本机部署目录与同步命令、2026-08-14 事故教训)。三条安全要点:

- 端口 `3100:80`(3000 被 Obsidian 占用;与 dev/e2e 的 3001 互不冲突)
- **构建约 15 分钟**(BuildKit 实测 14~18 分钟):自动化部署一律**拆两步**——`docker compose build` 成功后再 `docker compose up -d`(秒级替换,无中断窗口)
- **不要中途杀 compose 构建**:构建未完成时杀掉 → 新镜像没产出、旧容器已停 → 3100 永久中断,只能完整重建

## 桌面版(Electron)

打包 / 发布 / 更新机制见 [desktop/README.md](./desktop/README.md),买家安装说明见 [desktop/INSTALL.md](./desktop/INSTALL.md)。产物命名统一 `ExcaliPPT_<版本>_<系统>_<架构>`,构建入口 `yarn desktop:dist:mac` / `yarn desktop:dist:win`。
