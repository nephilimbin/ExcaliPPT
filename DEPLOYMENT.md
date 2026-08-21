# Docker 部署

本项目自带 Docker 部署方案(`Dockerfile` + `docker-compose.yml`),采用**多阶段构建**:`node:24` 中执行 `yarn build:app:docker` 出生产包,再装入 `nginx:stable-alpine-slim` 托管静态文件。

> 构建出的镜像 = 当前项目源码的生产版本,**包含本仓库的所有定制功能**(单端口多画布、主菜单「新建画布」、文字字号滑块/数字框等)。

## 前置要求

- Docker(实测 29.x 可用)
- Docker Compose v2(实测 2.40 可用)

## 一、生产部署(推荐)

```bash
docker compose up --build -d
```

完成后访问:**http://localhost:3100**

- 首次构建约几分钟(拉取 `node:24`、`nginx` 基础镜像 + `yarn install` + `vite build`),之后有缓存会很快。
- 容器默认健康检查启用(基于 Dockerfile 的 `HEALTHCHECK`),`docker compose ps` 可见 `healthy`。

## 二、端口说明

默认 `3100:80`(宿主 3100 → 容器内 nginx 80)。

- 选用 3100 是因为本机 3000 已被 Obsidian 占用;如需更换,编辑 `docker-compose.yml` 的 `ports`(同时改 `docker-compose.dev.yml`)。
- 容器内 nginx 固定监听 80,只改宿主映射端口即可。

## 三、两份 compose 文件

| 文件 | 用途 | 特点 |
| --- | --- | --- |
| `docker-compose.yml` | **生产(默认)** | 不挂载源码、`NODE_ENV=production`、启用健康检查、`restart: unless-stopped` |
| `docker-compose.dev.yml` | 开发式(原配置) | 挂载源码卷、`NODE_ENV=development`、禁用健康检查、`stdin_open` |

开发式用法:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## 四、镜像与容器大小

- **最终镜像**:`nginx` 基础(≈10–15MB)+ ExcaliPPT 静态产物(≈30–50MB)≈ **约 60MB**(实测 59.6MB)。`node_modules`、源码都在构建阶段,**不进最终镜像**。
- **容器**:磁盘 ≈ 镜像大小 + 极小可写层;运行内存 nginx 仅托管静态文件,**几 MB ~ 几十 MB**。
- 构建中间的 `node` 阶段镜像较大,但属临时构建层,不保留进最终镜像。

## 五、常用命令

```bash
docker compose ps                # 查看容器状态
docker compose logs -f           # 实时日志
docker compose restart           # 重启容器
docker compose down              # 停止并移除容器
docker compose up --build -d     # 改代码后重新构建并启动(务必带 --build)
```

## 六、手动 docker 命令(不使用 compose)

```bash
docker build -t excalippt-app .
docker run -d -p 3100:80 --name excalippt excalippt-app
# 停止:docker rm -f excalippt
```

## 七、改代码后更新部署

镜像在构建时 `COPY . .` 把源码打包。**修改代码后必须带 `--build` 重新构建**,否则会复用旧镜像:

```bash
docker compose up --build -d
```

## 八、注意事项

- 画布数据存储在**浏览器**(localStorage / IndexedDB),容器**不持久化**画布内容 —— 每个浏览器/设备各自独立(详见多画布 `?canvas=` 机制)。
- 生产构建通过 `VITE_APP_DISABLE_SENTRY=true` 禁用 Sentry 上报。
- `docker-compose.dev.yml` 中的源码挂载对 nginx 运行无实际影响(nginx 用的是构建产物),仅保留作开发存档。

## 九、集中部署目录(本机)

为便于与本机其他 docker 服务(funasr、lunatv 等)统一管理,部署运行入口集中在:

```
~/Documents/Docker/excalippt/
```

该目录存放本仓库根文件的**副本**:

- `docker-compose.yml`(生产配置,副本)
- `DEPLOYMENT.md`(本文档,副本)

> `Dockerfile` / `.dockerignore` **不复制**——它们留仓库根(CI 的 `docker build .` 依赖;且 compose 的 `build.context` 已指向仓库源码根,构建时直接用)。

### 权威源 vs 运行副本

- **权威源 = 仓库根**(git 跟踪):改 compose / 文档都改这里。
- **运行副本 = `~/Documents/Docker/excalippt/`**:部署时从这里 `docker compose up`。

### 改了 compose / 文档后,同步到部署目录

```bash
cp docker-compose.yml DEPLOYMENT.md ~/Documents/Docker/excalippt/
```

然后在部署目录运行(不必回仓库):

```bash
cd ~/Documents/Docker/excalippt
docker compose up --build -d          # 改代码后务必带 --build 重建
```

### 为什么 build.context 写成绝对路径

compose 副本运行在 `~/Documents/Docker/excalippt/`,若用 `build: .` 会指向该空目录、拿不到源码。故 `docker-compose.yml` 把 `build.context` 显式写成仓库源码绝对路径(`/Users/zzb/Documents/Project/IMAGE/ExcaliPPT`),副本在任何位置都能找到源码 + Dockerfile 构建。**换机器需更新此路径**(同时见 `CLAUDE.md`「Docker 部署」)。
