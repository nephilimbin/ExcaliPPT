// ExcaliPPT 桌面壳主进程:
// - app:// 自定义协议托管与 nginx 同一份 SPA 构建产物(离线、无服务器)
// - 主窗口:位置/尺寸/最大化状态持久化,显示器拔除时回落主屏可见区域
// - window.open 分流:站内(画布)开窗继承 preload,外链交系统浏览器
// - Teleprompter 原生置顶子窗:独立路由自渲染,跟随主窗画布,宿主关闭随行关闭
// - electron-updater:Win 全自动;「检查更新」菜单项(macOS 半自动:提示 + 下载链接,见 ADR-0005)
// - --smoke:脚本化冒烟,加载成功打 [desktop-smoke] OK 并 exit 0
//
// 开发:EXCALIPPT_DEV_SERVER_URL=http://localhost:3001 可指向 vite dev server。

import fs from "node:fs";
import path from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  screen,
  shell,
} from "electron";
import { autoUpdater } from "electron-updater";

import { IPC } from "./ipc-channels";

const DEV_SERVER_URL = process.env.EXCALIPPT_DEV_SERVER_URL;
/** 冒烟模式:加载成功即退出,供脚本 / CI 断言。 */
const SMOKE = process.argv.includes("--smoke");

/** SPA 构建产物根(dev:仓库内 build;打包:resources/app,由 electron-builder extraResources 放置)。 */
const webRoot = app.isPackaged
  ? path.join(process.resourcesPath, "app")
  : path.resolve(__dirname, "../../excalidraw-app/build");

const RELEASES_URL = "https://github.com/nephilimbin/ExcaliPPT/releases";

// ---------------------------------------------------------------------------
// app:// 协议:托管 SPA 构建产物
// ---------------------------------------------------------------------------

// 必须在 app ready 前注册 scheme 特权(SPA 的 fetch / 字体加载依赖 supportFetchAPI)
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

/** 路径 → 本地文件;防目录穿越;不存在 / 目录 → SPA 回落 index.html。 */
const resolveWebFile = (pathname: string): string | null => {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  const target = path.normalize(path.join(webRoot, rel));
  if (target !== webRoot && !target.startsWith(webRoot + path.sep)) {
    return null; // 越界访问
  }
  // 单次 stat(存在性 + 目录判定合一),协议热路径不留重复系统调用
  let stat: fs.Stats | null = null;
  try {
    stat = fs.statSync(target);
  } catch {
    // 不存在 → SPA 回落
  }
  if (!rel || !stat || stat.isDirectory()) {
    return path.join(webRoot, "index.html");
  }
  return target;
};

const registerAppProtocol = (): void => {
  protocol.handle("app", (request) => {
    const file = resolveWebFile(new URL(request.url).pathname);
    if (!file) {
      return new Response("forbidden", { status: 403 });
    }
    return net.fetch(`file://${file.split(path.sep).join("/")}`);
  });
};

// ---------------------------------------------------------------------------
// 窗口公共配置与 window.open 分流
// ---------------------------------------------------------------------------

/** 所有承载 SPA 的窗口共用的 webPreferences:preload 注入桌面桥,缺了它门禁整体失效。 */
const baseWebPreferences = (): Electron.WebPreferences => ({
  preload: path.join(__dirname, "preload.js"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false,
});

const isInternalUrl = (url: string): boolean => {
  // 相对路径(画布开窗等)与 app:// / dev server 同源 → 站内新窗口
  if (url.startsWith("/") || url.startsWith("?") || url.startsWith("#")) {
    return true;
  }
  if (url.startsWith("app://")) {
    return true;
  }
  return DEV_SERVER_URL ? url.startsWith(DEV_SERVER_URL) : false;
};

/** 仅 http(s) 允许交系统浏览器(Electron 安全清单:openExternal 必须按协议白名单)。 */
const openExternalSafe = (url: string): void => {
  if (!/^https?:/i.test(url)) {
    return; // file://、smb://、任意自定义 scheme 一律不触系统 handler
  }
  try {
    void shell.openExternal(url);
  } catch {
    // 忽略
  }
};

/**
 * window.open 分流:站内(如 Scratch Canvas)开新窗口并**继承 preload**——
 * 否则第二窗口拿不到桌面桥,SW/AI/提词器门禁整体失效(评审 #156);
 * 外链(http 等)交系统浏览器打开。经 did-create-window 递归应用到孙窗口。
 */
const wireWindowOpenHandling = (win: BrowserWindow): void => {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          webPreferences: baseWebPreferences(),
        },
      };
    }
    if (url === "about:blank") {
      // packages 的防 tab-nabbing 模式:window.open(undefined,"_blank") 后再赋 location。
      // 放行一个**隐形承接窗**(不闪屏),其后续导航在 will-navigate 移交后自闭
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          show: false,
          webPreferences: baseWebPreferences(),
        },
      };
    }
    openExternalSafe(url);
    return { action: "deny" };
  });
  // 可见窗口的外部导航接管:站内导航放行,外链交系统浏览器
  win.webContents.on("will-navigate", (event, url) => {
    if (isInternalUrl(url) || url === "about:blank") {
      return;
    }
    event.preventDefault();
    openExternalSafe(url);
  });
  win.webContents.on("did-create-window", (child, details) => {
    if (details.url === "about:blank") {
      // 隐形承接窗的唯一使命是承接 window.open(undefined) 后移交外链。
      // **任何**后续导航(含 app:// 站内)一律拦截并关窗——不留永生隐藏窗,
      // 也不给恶意 .excalidraw 的元素链接借道加载带 preload 桥的 SPA(安全评审)
      child.webContents.on("will-navigate", (event, url) => {
        event.preventDefault();
        openExternalSafe(url);
        if (!child.isDestroyed()) {
          child.close();
        }
      });
    }
    wireWindowOpenHandling(child);
  });
};

// ---------------------------------------------------------------------------
// 主窗口 + 状态持久化(位置 / 尺寸 / 最大化)
// ---------------------------------------------------------------------------

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const DEFAULT_STATE: WindowState = {
  width: 1440,
  height: 900,
  isMaximized: false,
};

const stateFilePath = (): string =>
  path.join(app.getPath("userData"), "window-state.json");

const loadWindowState = (): WindowState => {
  try {
    const state = JSON.parse(
      fs.readFileSync(stateFilePath(), "utf-8"),
    ) as WindowState;
    if (
      typeof state.width !== "number" ||
      typeof state.height !== "number" ||
      state.width < 200 ||
      state.height < 200
    ) {
      return { ...DEFAULT_STATE };
    }
    // 记忆位置所在显示器已拔除(外接屏场景)→ 回落默认,避免窗口落在不可见区域
    const visible =
      typeof state.x === "number" &&
      typeof state.y === "number" &&
      screen
        .getAllDisplays()
        .some(
          (d) =>
            (state.x! >= d.workArea.x &&
              state.x! < d.workArea.x + d.workArea.width &&
              state.y! >= d.workArea.y &&
              state.y! < d.workArea.y + d.workArea.height) as boolean,
        );
    if (!visible) {
      return { ...DEFAULT_STATE, isMaximized: state.isMaximized };
    }
    return { ...state };
  } catch {
    return { ...DEFAULT_STATE };
  }
};

const saveWindowState = (win: BrowserWindow, isMaximized: boolean): void => {
  try {
    // getNormalBounds:最大化时也能拿到还原尺寸
    const b = win.getNormalBounds();
    const state: WindowState = {
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      isMaximized,
    };
    fs.writeFileSync(stateFilePath(), JSON.stringify(state));
  } catch {
    // 持久化失败不影响退出
  }
};

let mainWindow: BrowserWindow | null = null;

const createMainWindow = (): BrowserWindow => {
  const state = loadWindowState();
  // macOS 关闭动画期间窗口会先退出最大化,'close' 时 isMaximized() 已不可靠
  // (实测恒为 false,导致重开变小)→ 用事件持续跟踪真实状态
  let maximized = state.isMaximized;
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    ...(state.x !== undefined && state.y !== undefined
      ? { x: state.x, y: state.y }
      : {}),
    show: false,
    title: "ExcaliPPT",
    webPreferences: baseWebPreferences(),
  });
  wireWindowOpenHandling(win);
  win.on("maximize", () => {
    maximized = true;
  });
  win.on("unmaximize", () => {
    maximized = false;
  });
  win.once("ready-to-show", () => {
    // 先 maximize 再 show:macOS 上 show 后紧跟 maximize 会被窗口系统吞掉(实测不生效)
    if (state.isMaximized) {
      win.maximize();
    }
    win.show();
  });
  win.on("close", () => saveWindowState(win, maximized));
  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    win.loadURL("app://static/index.html");
  }
  return win;
};

// ---------------------------------------------------------------------------
// Teleprompter 原生置顶子窗
// ---------------------------------------------------------------------------

let teleprompterWin: BrowserWindow | null = null;

const buildTeleprompterUrl = (search: string): string => {
  const base = DEV_SERVER_URL ?? "app://static/index.html";
  const s = search.startsWith("?") ? search.slice(1) : search;
  return `${base}?${s ? `${s}&` : ""}teleprompter=1`;
};

const searchOf = (url: string): string => {
  try {
    return new URL(url).search;
  } catch {
    return "";
  }
};

/** 向所有承载 SPA 的窗口广播子窗已关闭(多画布窗口场景按钮态一致,评审 #230)。 */
const broadcastTeleprompterClosed = (): void => {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) {
      w.webContents.send(IPC.teleprompterClosed);
    }
  }
};

const closeTeleprompter = (): void => {
  const w = teleprompterWin;
  if (!w) {
    return;
  }
  // 先清引用再关窗:close→open 快速连发时,后续 open 不会聚焦将死窗口(评审 #243)。
  // closed 事件侧按 identity 守卫去重,广播只发这一次。
  teleprompterWin = null;
  broadcastTeleprompterClosed();
  if (!w.isDestroyed()) {
    w.close();
  }
};

// 当前宿主绑定:子窗跟随哪个主窗(画布导航 + 随行关闭)。复用窗口换宿主时重绑。
let boundSender: BrowserWindow | null = null;
let unbindSender: (() => void) | null = null;

const bindTeleprompterTo = (
  senderWin: BrowserWindow,
  win: BrowserWindow,
): void => {
  unbindSender?.();
  boundSender = senderWin;
  let lastSearch = searchOf(senderWin.webContents.getURL());
  // 跟随主窗画布:切画布是整页导航,子窗须重载到新 ?canvas=,
  // 否则静默读写错误画布的文稿(评审 #199)
  const onNavigate = (_e: unknown, url: string): void => {
    if (teleprompterWin !== win || win.isDestroyed()) {
      return;
    }
    const next = searchOf(url);
    if (next === lastSearch) {
      return;
    }
    lastSearch = next;
    void win.loadURL(buildTeleprompterUrl(next)).catch(() => {
      // 重载时窗口恰好被关闭:忽略
    });
  };
  // 宿主窗口关闭 → 子窗随行关闭,避免只剩提词小窗的孤儿态(评审 #449)
  const onSenderClosed = (): void => closeTeleprompter();
  senderWin.webContents.on("did-navigate", onNavigate);
  senderWin.once("closed", onSenderClosed);
  unbindSender = () => {
    // 宿主先关(449 随行关闭路径)时 senderWin 已销毁,访问 .webContents 会抛
    // "Object has been destroyed" —— 清理前必须守卫
    if (!senderWin.isDestroyed()) {
      senderWin.webContents.removeListener("did-navigate", onNavigate);
      senderWin.removeListener("closed", onSenderClosed);
    }
  };
};

const openTeleprompter = async (senderWin: BrowserWindow): Promise<boolean> => {
  if (teleprompterWin && !teleprompterWin.isDestroyed()) {
    // 复用已开的子窗,但宿主可能已换窗口(多画布窗口):重绑跟随并载到新宿主画布,
    // 否则子窗仍跟旧窗口的画布、显示错误画布的文稿(评审)
    if (boundSender !== senderWin) {
      // 旧宿主按钮复位:子窗已改随新宿主,旧窗口的 active 态不应残留(评审)
      const old = boundSender;
      if (old && !old.isDestroyed()) {
        old.webContents.send(IPC.teleprompterClosed);
      }
      bindTeleprompterTo(senderWin, teleprompterWin);
      void teleprompterWin
        .loadURL(
          buildTeleprompterUrl(searchOf(senderWin.webContents.getURL())),
        )
        .catch(() => {});
    }
    teleprompterWin.focus();
    return true;
  }
  const win = (teleprompterWin = new BrowserWindow({
    width: 520,
    height: 320,
    alwaysOnTop: true,
    title: "ExcaliPPT 提词器",
    // 桌面端特权:无边框(网页端 Document PiP 的标题栏是 Chrome 强制的,Electron 无此限制);
    // 拖拽移动与关闭由 Teleprompter 底部工具栏承担(nativeWindowDrag,与画布内浮窗手势一致)
    frame: false,
    webPreferences: baseWebPreferences(),
  }));
  wireWindowOpenHandling(win);
  bindTeleprompterTo(senderWin, win);

  win.on("closed", () => {
    unbindSender?.();
    unbindSender = null;
    boundSender = null;
    // identity 守卫:被更新的窗口(或已按请求关闭的)不再二次广播
    if (teleprompterWin === win) {
      teleprompterWin = null;
      broadcastTeleprompterClosed();
    }
  });

  try {
    await win.loadURL(
      buildTeleprompterUrl(searchOf(senderWin.webContents.getURL())),
    );
  } catch {
    if (teleprompterWin === win) {
      teleprompterWin = null;
    }
    if (!win.isDestroyed()) {
      win.destroy();
    }
    return false;
  }
  return true;
};

const wireIpc = (): void => {
  ipcMain.handle(IPC.teleprompterOpen, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return false;
    }
    return openTeleprompter(win);
  });
  ipcMain.on(IPC.teleprompterClose, () => closeTeleprompter());
};

// ---------------------------------------------------------------------------
// 更新器(GitHub Releases,仓库 public 零 token):Win 全自动 / Mac 半自动
// ---------------------------------------------------------------------------

const UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000;

const notifyUpdateDownloaded = (): void => {
  void dialog
    .showMessageBox({
      type: "info",
      message: "新版本已下载",
      detail: "重启应用以完成安装。",
      buttons: ["重启更新", "稍后"],
      defaultId: 0,
    })
    .then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
};

const setupAutoUpdater = (): void => {
  // macOS 全自动更新需要签名(Squirrel.Mac 校验),本应用不签名 → Mac 不自动下载
  autoUpdater.autoDownload = process.platform === "win32";
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-downloaded", notifyUpdateDownloaded);
  autoUpdater.on("error", (e) => {
    // 尚未发布任何 release 等场景:静默,不干扰使用
    console.warn(`[updater] ${e.message}`);
  });

  if (process.platform === "win32") {
    const check = (): void => {
      autoUpdater.checkForUpdates().catch(() => {});
    };
    check();
    setInterval(check, UPDATE_INTERVAL_MS);
  }
};

/** 菜单「检查更新」:Win 走自动下载;Mac 检查后给下载链接(半自动)。 */
const checkForUpdatesManually = (): void => {
  if (process.platform === "win32") {
    autoUpdater.checkForUpdates().catch(async (e: Error) => {
      await dialog.showMessageBox({
        type: "info",
        message: "检查更新失败",
        detail: e.message,
      });
    });
    return;
  }
  autoUpdater
    .checkForUpdates()
    .then(async (result) => {
      const remote = result?.updateInfo?.version;
      const current = autoUpdater.currentVersion.version;
      if (remote && remote !== current) {
        const { response } = await dialog.showMessageBox({
          type: "info",
          message: `发现新版本 ${remote}(当前 ${current})`,
          detail: "未签名应用不走自动安装,请从 Releases 下载新安装包。",
          buttons: ["前往下载", "取消"],
          defaultId: 0,
        });
        if (response === 0) {
          void shell.openExternal(RELEASES_URL);
        }
      } else {
        await dialog.showMessageBox({
          type: "info",
          message: "已是最新版本",
          detail: `当前 ${current}`,
        });
      }
    })
    .catch(async (e: Error) => {
      await dialog.showMessageBox({
        type: "info",
        message: "检查更新失败",
        detail: `${e.message}(若从未发布过 Release 属预期)`,
      });
    });
};

const buildMenu = (): void => {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: "appMenu" },
    {
      label: "文件",
      submenu: [
        // close role 挂 ⌘W:Electron 的快捷键必须绑定在菜单项上,系统不会默认送
        { role: "close", label: "关闭窗口" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      label: "帮助",
      submenu: [
        {
          label: "检查更新…",
          click: () => checkForUpdatesManually(),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

// ---------------------------------------------------------------------------
// 冒烟模式(--smoke)
// ---------------------------------------------------------------------------

/** 从构建产物中挑一个真实字体文件路径(验证 app:// 能供出离线字体,#6 的自动化代理)。 */
const pickSampleFontRelPath = (): string | null => {
  const fontsDir = path.join(webRoot, "fonts");
  try {
    for (const family of fs.readdirSync(fontsDir)) {
      const familyDir = path.join(fontsDir, family);
      const woff2 = fs.readdirSync(familyDir).find((f) => f.endsWith(".woff2"));
      if (woff2) {
        return `fonts/${family}/${woff2}`;
      }
    }
  } catch {
    // fonts 目录缺失
  }
  return null;
};

const runSmoke = (win: BrowserWindow): void => {
  const fail = (reason: string): void => {
    console.error(`[desktop-smoke] FAIL ${reason}`);
    app.exit(1);
  };
  const watchdog = setTimeout(() => fail("timeout"), 45_000);
  win.webContents.on("did-fail-load", (_e, code, desc, url) =>
    fail(`did-fail-load ${code} ${desc} ${url}`),
  );
  win.webContents.once("did-finish-load", () => {
    setTimeout(async () => {
      clearTimeout(watchdog);
      if (win.isDestroyed() || win.webContents.isCrashed()) {
        fail("crashed");
        return;
      }
      // 字体经 app:// 离线可取(渲染进程 fetch 走同一协议,断言非 404)
      const fontRel = pickSampleFontRelPath();
      if (fontRel) {
        try {
          const res = (await win.webContents.executeJavaScript(
            `fetch("${fontRel}").then((r) => r.status)`,
          )) as number;
          if (res !== 200) {
            fail(`font ${fontRel} status ${res}`);
            return;
          }
          // eslint-disable-next-line no-console
          console.log(`[desktop-smoke] font OK ${fontRel}`);
        } catch (e) {
          fail(`font ${fontRel} fetch error ${(e as Error).message}`);
          return;
        }
      } else {
        fail("no woff2 found in build output");
        return;
      }
      // eslint-disable-next-line no-console
      console.log(`[desktop-smoke] OK ${win.webContents.getURL()}`);
      app.exit(0);
    }, 2000);
  });
};

// ---------------------------------------------------------------------------
// 生命周期
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  registerAppProtocol();
  mainWindow = createMainWindow();
  wireIpc();
  buildMenu();
  setupAutoUpdater();
  if (SMOKE && mainWindow) {
    runSmoke(mainWindow);
  }
});

app.on("window-all-closed", () => {
  // 单窗口工具:关窗即彻底退出(红 ✕ = 退出应用,不留驻 Dock 躲猫猫)
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});
