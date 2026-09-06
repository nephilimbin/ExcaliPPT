// 桌面版更新通知卡(Win):订阅主进程更新状态,右下角前台显示检查/下载进度/完成安装。
// 渲染在 Excalidraw children 位置(.excalidraw 子树内):主题变量与 theme--dark 类天然继承;
// fixed 相对 viewport(children 到 viewport 的祖先链无 transform,先例 SlidesPanel 同层定位)。
// 提词器子窗(?teleprompter=1)入口分流不挂主应用,天然无此卡片。
import React, { useEffect, useRef, useState } from "react";

import { getDesktopBridge, type UpdateStatus } from "../desktop-bridge";

import "./DesktopUpdateNotifier.scss";

/** 下载相关字节数 → "x.x MB" 文案。 */
const formatMB = (bytes: number): string =>
  `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** 手动下载兜底地址(与 desktop/src/main.ts 的 RELEASES_URL 同步维护)。 */
const RELEASES_URL = "https://github.com/nephilimbin/ExcaliPPT/releases";

/** 用户点过「稍后」后不再打扰的瞬态(终态 downloaded/error 仍会重新出现)。 */
const TRANSIENT_TYPES = new Set(["checking", "available", "downloading"]);

type CardStatus = UpdateStatus | { type: "idle" };

/** 版本号展示(空串降级为不带版本——预发布号等语义分歧场景防「下载新版本 v(3%)」)。 */
const versionLabel = (version: string): string =>
  version ? ` v${version}` : "";

export const DesktopUpdateNotifier: React.FC = React.memo(() => {
  const [status, setStatus] = useState<CardStatus>({ type: "idle" });
  // 点击「重启更新」后置禁用:quitAndInstall 前有窗口关闭过程,防重复触发;
  // 退出被 beforeunload 否决(如录制中)时应用不退出,数秒后恢复按钮允许重试
  const [installing, setInstalling] = useState(false);
  // 用户对本次下载会话点过「稍后」:抑制后续瞬态推送,downloaded/error 仍放行
  const suppressedTransient = useRef(false);

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      return;
    }
    const off = bridge.updates.onStatus((s) => {
      // checking 只由手动检查广播(后台周期检查不发):作为解除抑制的信号,
      // 用户点过「稍后」后再次主动检查时重新显示完整流程
      if (s.type === "checking") {
        suppressedTransient.current = false;
      }
      if (suppressedTransient.current && TRANSIENT_TYPES.has(s.type)) {
        return;
      }
      if (s.type === "downloaded" || s.type === "error") {
        suppressedTransient.current = false;
      }
      setStatus(s);
    });
    // 晚挂载窗口补偿纯推送漏掉的终态;仅当尚无推送到达(idle)时应用,避免旧快照覆盖新推送
    void bridge.updates.status().then((s) => {
      if (s) {
        setStatus((cur) => (cur.type === "idle" ? s : cur));
      }
    });
    return () => off();
  }, []);

  // 「已是最新」6s 自动消失;出错卡片不自动消失——须留时间读原因/点手动下载,
  // 由「稍后」按钮关闭(桌面壳中外链经 setWindowOpenHandler 交系统浏览器打开)
  useEffect(() => {
    if (status.type === "not-available") {
      const timer = window.setTimeout(() => setStatus({ type: "idle" }), 6000);
      return () => window.clearTimeout(timer);
    }
  }, [status]);

  if (status.type === "idle") {
    return null;
  }

  return (
    <div className="desktop-update-notifier">
      {status.type === "checking" && (
        <>
          <p className="desktop-update-notifier__title">正在检查更新…</p>
          <DismissButton
            setStatus={setStatus}
            onDismiss={() => {
              suppressedTransient.current = true;
            }}
          />
        </>
      )}
      {status.type === "available" && (
        <>
          <p className="desktop-update-notifier__title">
            发现新版本{versionLabel(status.version)}
          </p>
          <p className="desktop-update-notifier__detail">即将开始下载…</p>
          <DismissButton
            setStatus={setStatus}
            onDismiss={() => {
              suppressedTransient.current = true;
            }}
          />
        </>
      )}
      {status.type === "downloading" && (
        <>
          <p className="desktop-update-notifier__title">
            正在下载新版本{versionLabel(status.version)}（
            {Math.floor(status.percent)}%）
          </p>
          <div
            className="desktop-update-notifier__progress"
            role="progressbar"
            aria-valuenow={Math.floor(status.percent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, status.percent))}%`,
              }}
            />
          </div>
          <p className="desktop-update-notifier__detail">
            {formatMB(status.transferred)}
            {status.total > 0 ? ` / ${formatMB(status.total)}` : ""}
            {status.bytesPerSecond > 0
              ? ` · ${formatMB(status.bytesPerSecond)}/s`
              : ""}
          </p>
          <DismissButton
            setStatus={setStatus}
            onDismiss={() => {
              suppressedTransient.current = true;
            }}
          />
        </>
      )}
      {status.type === "downloaded" && (
        <>
          <p className="desktop-update-notifier__title">
            新版本{versionLabel(status.version)}已就绪
          </p>
          <p className="desktop-update-notifier__detail">
            重启应用后完成安装。
          </p>
          <div className="desktop-update-notifier__actions">
            <button
              type="button"
              className="desktop-update-notifier__btn desktop-update-notifier__btn--primary"
              disabled={installing}
              onClick={() => {
                setInstalling(true);
                getDesktopBridge()?.updates.install();
                // 退出被否决时应用仍在:恢复按钮允许重试(正常退出时定时器无关紧要)
                window.setTimeout(() => setInstalling(false), 4000);
              }}
            >
              {installing ? "正在重启…" : "重启更新"}
            </button>
            <button
              type="button"
              className="desktop-update-notifier__btn"
              onClick={() => setStatus({ type: "idle" })}
            >
              稍后
            </button>
          </div>
        </>
      )}
      {status.type === "not-available" && (
        <p className="desktop-update-notifier__title">
          已是最新版本（v{status.currentVersion}）
        </p>
      )}
      {status.type === "error" && (
        <>
          <p className="desktop-update-notifier__title">
            更新出错：{status.message}
          </p>
          <p className="desktop-update-notifier__detail">
            可前往 GitHub 手动下载最新安装包。
          </p>
          <div className="desktop-update-notifier__actions">
            <button
              type="button"
              className="desktop-update-notifier__btn desktop-update-notifier__btn--primary"
              onClick={() =>
                window.open(RELEASES_URL, "_blank", "noopener,noreferrer")
              }
            >
              前往手动下载
            </button>
            <button
              type="button"
              className="desktop-update-notifier__btn"
              onClick={() => setStatus({ type: "idle" })}
            >
              稍后
            </button>
          </div>
        </>
      )}
    </div>
  );
});

/** 瞬态卡的「稍后」:仅关闭本窗显示,不中断主进程下载;可携带抑制后续瞬态的回调。 */
const DismissButton: React.FC<{
  setStatus: React.Dispatch<React.SetStateAction<CardStatus>>;
  onDismiss?: () => void;
}> = ({ setStatus, onDismiss }) => (
  <div className="desktop-update-notifier__actions">
    <button
      type="button"
      className="desktop-update-notifier__btn"
      onClick={() => {
        onDismiss?.();
        setStatus({ type: "idle" });
      }}
    >
      稍后
    </button>
  </div>
);
