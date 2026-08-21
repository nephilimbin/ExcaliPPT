// Document Picture-in-Picture:把提词器渲染进一个"始终置顶"的浮动小窗。
// 仅 Chrome / Edge 116+ 支持;Safari / Firefox 不支持 → 调用方应先 supportsDocumentPiP()
// 判断,不支持则禁用"提词器"按钮(见 SlidesPanel)。

interface DocumentPictureInPicture {
  requestWindow: (options?: {
    width?: number;
    height?: number;
  }) => Promise<Window>;
}

const getPiP = (): DocumentPictureInPicture | undefined =>
  (
    window as unknown as {
      documentPictureInPicture?: DocumentPictureInPicture;
    }
  ).documentPictureInPicture;

/** 当前浏览器是否支持 Document Picture-in-Picture。 */
export const supportsDocumentPiP = (): boolean => getPiP() !== undefined;

/** 把当前文档的样式表拷进目标文档(画中画文档默认无样式,不拷会"裸"渲染)。 */
export const copyStylesInto = (dest: Document): void => {
  const source = document.styleSheets;
  for (let i = 0; i < source.length; i++) {
    const sheet = source[i];
    try {
      const css = Array.from(sheet.cssRules, (rule) => rule.cssText).join("\n");
      const style = dest.createElement("style");
      style.textContent = css;
      dest.head.appendChild(style);
    } catch {
      // 跨域样式表(cssRules 不可读)→ 改用 <link> 引用
      if (sheet.href) {
        const link = dest.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        dest.head.appendChild(link);
      }
    }
  }
};

/**
 * 打开一个始终置顶的提词器画中画窗口,并拷入样式。
 * 返回该 Window(供 createPortal 把 <Teleprompter/> 挂到其 document.body);
 * 不支持或用户取消时返回 null。
 */
export const requestTeleprompterPiP = async (
  width = 520,
  height = 320,
): Promise<Window | null> => {
  const api = getPiP();
  if (!api) {
    return null;
  }
  try {
    const pipWindow = await api.requestWindow({ width, height });
    copyStylesInto(pipWindow.document);
    return pipWindow;
  } catch {
    return null; // 用户取消 / 失败
  }
};
