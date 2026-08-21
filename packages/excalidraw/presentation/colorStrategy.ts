/**
 * Rainbow colour at phase `t` (loops every 1). Uses HSL hue 0→360°, which
 * walks the spectrum smoothly — far more natural than interpolating a few RGB
 * stops. Saturation/lightness are fixed for a vivid, consistent rainbow.
 */
export const rainbow = (t: number): string => {
  const h = (((t % 1) + 1) % 1) * 360;
  return hslToHex(h, 1, 0.5);
};

/** h in [0,360], s/l in [0,1] → #rrggbb */
const hslToHex = (h: number, s: number, l: number): string => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    [r, g, b] = [c, x, 0];
  } else if (hp < 2) {
    [r, g, b] = [x, c, 0];
  } else if (hp < 3) {
    [r, g, b] = [0, c, x];
  } else if (hp < 4) {
    [r, g, b] = [0, x, c];
  } else if (hp < 5) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  const m = l - c / 2;
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
