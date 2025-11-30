const steps = [0x00, 0x33, 0x66, 0x99, 0xcc, 0xff];

function toHex(n) {
  return n.toString(16).padStart(2, "0").toUpperCase();
}

function relativeLuminance(r, g, b) {
  const rgb = [r, g, b]
    .map((v) => v / 255)
    .map((v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    );
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function textColor(bg) {
  const r = parseInt(bg.slice(1, 3), 16);
  const g = parseInt(bg.slice(3, 5), 16);
  const b = parseInt(bg.slice(5, 7), 16);
  return relativeLuminance(r, g, b) > 0.5 ? "#000000" : "#FFFFFF";
}

const colors = [];
for (const r of steps)
  for (const g of steps)
    for (const b of steps) {
      const bg = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      colors.push({ "background-color": bg, color: textColor(bg) });
    }

module.exports = { colors };
