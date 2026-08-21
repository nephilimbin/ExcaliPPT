import { GithubIcon, eyeIcon } from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React, { useState } from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";
import { generateCanvasId } from "../app_constants";

import { CanvasManageDialog } from "./CanvasManageDialog";
import { saveDebugState } from "./DebugCanvas";

// 「新建画布」菜单项图标(grep 确认 icons.tsx 无现成加号图标,故内联)
const newCanvasIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M10 4v12M4 10h12"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

// 「画布管理」菜单项图标(列举/列表语义)
const manageCanvasIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M7 5.5h9M7 10h9M7 14.5h9M4 5.5h.01M4 10h.01M4 14.5h.01"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
}> = React.memo((props) => {
  const [manageOpen, setManageOpen] = useState(false);
  return (
    <>
      <MainMenu>
        <MainMenu.DefaultItems.LoadScene />
        <MainMenu.DefaultItems.SaveToActiveFile />
        <MainMenu.DefaultItems.Export />
        <MainMenu.DefaultItems.SaveAsImage />
        {props.isCollabEnabled && (
          <MainMenu.DefaultItems.LiveCollaborationTrigger
            isCollaborating={props.isCollaborating}
            onSelect={() => props.onCollabDialogOpen()}
          />
        )}
        <MainMenu.DefaultItems.CommandPalette className="highlighted" />
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.Help />
        <MainMenu.Item
          icon={newCanvasIcon}
          onSelect={() => {
            const url = `${
              window.location.pathname
            }?canvas=${generateCanvasId()}`;
            window.open(url, "_blank", "noopener,noreferrer");
          }}
          data-testid="new-canvas-button"
        >
          新建画布
        </MainMenu.Item>
        <MainMenu.Item
          icon={manageCanvasIcon}
          onSelect={() => setManageOpen(true)}
          data-testid="manage-canvases-button"
        >
          画布管理…
        </MainMenu.Item>
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <MainMenu.ItemLink
          icon={GithubIcon}
          href="https://github.com/nephilimbin/ExcaliPPT"
        >
          GitHub
        </MainMenu.ItemLink>
        {isDevEnv() && (
          <MainMenu.Item
            icon={eyeIcon}
            onSelect={() => {
              if (window.visualDebug) {
                delete window.visualDebug;
                saveDebugState({ enabled: false });
              } else {
                window.visualDebug = { data: [] };
                saveDebugState({ enabled: true });
              }
              props?.refresh();
            }}
          >
            Visual Debug
          </MainMenu.Item>
        )}
        <MainMenu.Separator />
        <MainMenu.DefaultItems.Preferences />
        <MainMenu.DefaultItems.ToggleTheme
          allowSystemTheme
          theme={props.theme}
        />
        <MainMenu.ItemCustom>
          <LanguageList style={{ width: "100%" }} />
        </MainMenu.ItemCustom>
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
      {manageOpen && (
        <CanvasManageDialog onClose={() => setManageOpen(false)} />
      )}
    </>
  );
});
