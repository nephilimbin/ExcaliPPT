import { useState } from "react";

import { Button } from "@excalidraw/excalidraw/components/Button";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";

import { DEFAULT_CANVAS_ID, getCanvasId } from "../app_constants";
import { LocalData } from "../data/LocalData";
import {
  type CanvasRecord,
  deleteCanvas,
  deleteCanvases,
  formatRelative,
  reconcileCanvases,
} from "../canvas/canvasRegistry";

import "./CanvasManageDialog.scss";

interface CanvasManageDialogProps {
  onClose: () => void;
}

export function CanvasManageDialog({ onClose }: CanvasManageDialogProps) {
  const [records, setRecords] = useState<CanvasRecord[]>(() =>
    reconcileCanvases(),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [batchConfirm, setBatchConfirm] = useState(false);

  const currentId = getCanvasId();
  const selectableIds = records
    .filter((r) => r.id !== DEFAULT_CANVAS_ID)
    .map((r) => r.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const refresh = () => {
    setRecords(reconcileCanvases());
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    if (id === DEFAULT_CANVAS_ID) {
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  };

  const openCanvas = (id: string) => {
    // default = 根路径(无 query);scratch = ?canvas=<id>
    const url =
      id === DEFAULT_CANVAS_ID
        ? window.location.pathname
        : `${window.location.pathname}?canvas=${id}`;
    window.location.href = url;
  };

  const handleDelete = async (id: string) => {
    // suppressFlush 必须在 await 之前:await 让出控制权期间,挂起的防抖 save 可能触发,
    // 把内存里(已删)画布的数据写回 → 复活。提前抑制 → _save + flushSave 都跳过。
    if (id === currentId) {
      LocalData.suppressFlush();
    }
    await deleteCanvas(id);
    setConfirmDeleteId(null);
    if (id === currentId) {
      window.location.href = window.location.pathname;
    } else {
      refresh();
    }
  };

  const handleBatchDelete = async () => {
    const ids = [...selected];
    setBatchConfirm(false);
    if (ids.includes(currentId)) {
      LocalData.suppressFlush();
    }
    await deleteCanvases(ids);
    setSelected(new Set());
    if (ids.includes(currentId)) {
      window.location.href = window.location.pathname;
    } else {
      setRecords(reconcileCanvases());
    }
  };

  return (
    <Dialog size="small" onCloseRequest={onClose} title="画布管理">
      <div className="canvas-manage-dialog">
        <div className="canvas-manage-dialog__toolbar">
          <label className="canvas-manage-dialog__select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              disabled={selectableIds.length === 0}
            />
            <span>
              {selected.size > 0
                ? `已选 ${selected.size} 项`
                : `共 ${records.length} 个画布`}
            </span>
          </label>
          {batchConfirm ? (
            <div className="canvas-manage-dialog__batch-confirm">
              <span>确认删除 {selected.size} 个画布?</span>
              <Button onSelect={handleBatchDelete}>确认删除</Button>
              <Button onSelect={() => setBatchConfirm(false)}>取消</Button>
            </div>
          ) : (
            <Button
              onSelect={() => setBatchConfirm(true)}
              disabled={selected.size === 0}
            >
              批量删除{selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          )}
        </div>

        <div className="canvas-manage-dialog__list">
          {records.map((record) => {
            const isCurrent = record.id === currentId;
            const isDefault = record.id === DEFAULT_CANVAS_ID;
            const isConfirming = confirmDeleteId === record.id;
            const isChecked = selected.has(record.id);

            return (
              <div
                key={record.id}
                className={
                  isChecked
                    ? "canvas-manage-dialog__row canvas-manage-dialog__row--selected"
                    : "canvas-manage-dialog__row"
                }
              >
                <input
                  type="checkbox"
                  className="canvas-manage-dialog__check"
                  checked={isChecked}
                  onChange={() => toggleSelect(record.id)}
                  disabled={isDefault}
                />

                <div className="canvas-manage-dialog__meta">
                  <span className="canvas-manage-dialog__name">
                    {record.name}
                    {isCurrent ? "（当前）" : ""}
                    <span className="canvas-manage-dialog__id">
                      {record.id}
                    </span>
                  </span>
                  <span className="canvas-manage-dialog__time">
                    {formatRelative(record.updatedAt)}
                  </span>
                </div>

                <div className="canvas-manage-dialog__actions">
                  {isConfirming ? (
                    <>
                      <span className="canvas-manage-dialog__inline-confirm">
                        删除?
                      </span>
                      <Button onSelect={() => handleDelete(record.id)}>
                        是
                      </Button>
                      <Button onSelect={() => setConfirmDeleteId(null)}>
                        否
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onSelect={() => openCanvas(record.id)}>
                        打开
                      </Button>
                      <Button
                        onSelect={() => setConfirmDeleteId(record.id)}
                        disabled={isDefault}
                      >
                        删除
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
