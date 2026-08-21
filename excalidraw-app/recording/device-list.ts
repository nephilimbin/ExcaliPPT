// Slice 4: 设备枚举 + deviceId 加载对账(stale→null)。
// 纯逻辑(navigator.mediaDevices 注入),可独立单测。无 enumerateDevices(老浏览器/SSR)→ 空列表。

export interface MediaDevice {
  deviceId: string;
  label: string;
}

const safeEnumerate = async (): Promise<MediaDeviceInfo[]> => {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [];
  }
  try {
    return await navigator.mediaDevices.enumerateDevices();
  } catch {
    return [];
  }
};

const mapDevices = (
  all: MediaDeviceInfo[],
  kind: MediaDeviceInfo["kind"],
  fallbackPrefix: string,
): MediaDevice[] =>
  all
    .filter((d) => d.kind === kind)
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `${fallbackPrefix} ${i + 1}`,
    }));

/** 列出可用摄像头(videoinput),label 空时回退「摄像头 N」。 */
export const listVideoInputs = async (): Promise<MediaDevice[]> =>
  mapDevices(await safeEnumerate(), "videoinput", "摄像头");

/** 列出可用麦克风(audioinput),label 空时回退「麦克风 N」。 */
export const listAudioInputs = async (): Promise<MediaDevice[]> =>
  mapDevices(await safeEnumerate(), "audioinput", "麦克风");

/**
 * 该类型设备是否已有【真实】label(授权后才有)。
 * 注意:listVideoInputs 的 fallback "摄像头 N" 也是非空字符串,不能用它判断;
 * 此处查原始 enumerate 的 label。无该类型设备 → true(无需等待)。
 */
export const hasDeviceLabels = async (
  kind: "video" | "audio",
): Promise<boolean> => {
  const k = kind === "video" ? "videoinput" : "audioinput";
  const ofKind = (await safeEnumerate()).filter((d) => d.kind === k);
  return ofKind.length === 0 || ofKind.some((d) => !!d.label);
};

/**
 * 存的 deviceId 是否仍存在于枚举列表;不存在(拔掉/换 id)→ null(回退系统默认)。
 * 设备列表为空(未授权/无设备)时,保留 stored(让浏览器自选默认时仍记着偏好)。
 */
export const reconcileDeviceId = (
  stored: string | null,
  devices: { deviceId: string }[],
): string | null => {
  if (!stored) {
    return null;
  }
  if (devices.length === 0) {
    return stored;
  }
  return devices.some((d) => d.deviceId === stored) ? stored : null;
};
