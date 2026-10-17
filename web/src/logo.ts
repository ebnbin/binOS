// 36 × 36 网格：竖线是 1，圆环是 0，两笔分开。0 只压住 1 四分之一线宽，1 停在 0 的圆心高度；左右边距 9 / 8 用来平衡偏左的重心
export const logo = {
  size: 36,
  // 圆角只用于 binOS 自己画的方块；交给系统的图标是全方形，由系统加圆角
  radius: 8,
  stroke: 4,
  one: 'M11 8V21',
  zero: { cx: 20, cy: 21, r: 6 },
}

export function logoSvg({ ink, on, rounded, dark }: { ink: string; on: string; rounded: boolean; dark?: boolean }) {
  // 深色模式下黑白反转
  const style = dark ? `<style>@media (prefers-color-scheme: dark){.bg{fill:${on}}.fg{stroke:${ink}}}</style>` : ''
  const { size, radius, stroke, one, zero } = logo
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${style}` +
    `<rect class="bg" width="${size}" height="${size}"${rounded ? ` rx="${radius}"` : ''} fill="${ink}"/>` +
    `<path class="fg" d="${one}" stroke="${on}" stroke-width="${stroke}" stroke-linecap="round" fill="none"/>` +
    `<circle class="fg" cx="${zero.cx}" cy="${zero.cy}" r="${zero.r}" stroke="${on}" stroke-width="${stroke}" fill="none"/>` +
    `</svg>`
  )
}
