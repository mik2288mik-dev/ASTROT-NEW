"""Split the Sagittarius illustration into layers for the shooting loop.

body_erased.png: the centaur with the arrow and both string segments painted out.
arrow.png:       the arrow alone at its drawn position (shaft rebuilt from a clean
                 slice, head copied from the source), same 512x512 canvas.
geometry.json:   the fitted lines and anchor points the renderer needs.
"""
import json
import sys

import numpy as np
from PIL import Image

root = sys.argv[1]
src = np.array(Image.open(root + '/src512.png').convert('RGBA')).astype(np.float64)
H, W = src.shape[:2]

# Fitted centre lines (see measurement step): y = k*x + b
AR_K, AR_B = 0.05236144, 119.57553
UP_K, UP_B = -0.68906565, 275.23989
LO_K, LO_B = 1.31902147, -206.98565

yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)


def signed_dist(k, b):
    """Signed perpendicular distance to y=kx+b, positive on the +normal side."""
    n = np.array([-k, 1.0]) / np.hypot(k, 1.0)
    return (xx - 0.0) * n[0] + (yy - b) * n[1], n


AR_HALF, UP_HALF, LO_HALF = 3.4, 3.4, 3.4
ar_d, ar_n = signed_dist(AR_K, AR_B)
up_d, up_n = signed_dist(UP_K, UP_B)
lo_d, lo_n = signed_dist(LO_K, LO_B)

arrow_band = (np.abs(ar_d) <= AR_HALF) & (xx >= 211) & (xx <= 421)
head_box = (xx >= 418) & (xx <= 448) & (yy >= 131) & (yy <= 155)
up_band = (np.abs(up_d) <= UP_HALF) & (xx >= 214) & (xx <= 333)
lo_x0 = (188 - LO_B) / LO_K
lo_x1 = (244 - LO_B) / LO_K
lo_band = (np.abs(lo_d) <= LO_HALF) & (xx >= lo_x0) & (xx <= lo_x1)
mask = arrow_band | head_box | up_band | lo_band

prem = src.copy()
prem[:, :, :3] *= prem[:, :, 3:4] / 255.0


def sample(px, py):
    """Bilinear premultiplied sample; outside the canvas is transparent."""
    if px < 0 or py < 0 or px > W - 1 or py > H - 1:
        return np.zeros(4)
    x0, y0 = int(np.floor(px)), int(np.floor(py))
    x1, y1 = min(x0 + 1, W - 1), min(y0 + 1, H - 1)
    fx, fy = px - x0, py - y0
    top = prem[y0, x0] * (1 - fx) + prem[y0, x1] * fx
    bot = prem[y1, x0] * (1 - fx) + prem[y1, x1] * fx
    return top * (1 - fy) + bot * fy


def clean_sample(px, py, nx, ny, sgn):
    """Walk outward along the normal until the sample is clear of every mask."""
    for extra in np.arange(0, 7, 0.5):
        qx, qy = px + sgn * nx * extra, py + sgn * ny * extra
        ix, iy = int(round(qx)), int(round(qy))
        if 0 <= ix < W and 0 <= iy < H and mask[iy, ix]:
            continue
        return sample(qx, qy)
    return sample(px + sgn * nx * 7, py + sgn * ny * 7)


def fill(region, dist, n, half):
    out = {}
    nx, ny = n
    edge = half + 1.0
    ys, xs = np.where(region)
    for y, x in zip(ys, xs):
        s = dist[y, x]
        # project onto both band edges along the normal
        c1 = clean_sample(x - nx * (s + edge), y - ny * (s + edge), nx, ny, -1)
        c2 = clean_sample(x + nx * (edge - s), y + ny * (edge - s), nx, ny, 1)
        a1, a2 = c1[3], c2[3]
        if (a1 < 60 and a2 > 190) or (a2 < 60 and a1 > 190):
            # silhouette edge hidden under the line: keep it crisp at the centre
            near, far = (c1, c2) if s < 0 else (c2, c1)
            if abs(s) < 0.5:
                out[(y, x)] = (near + far) * 0.5
            else:
                out[(y, x)] = near
        else:
            t = (s + edge) / (2 * edge)
            out[(y, x)] = c1 * (1 - t) + c2 * t
    return out


filled = prem.copy()
for region, dist, n, half in (
    (arrow_band, ar_d, ar_n, AR_HALF),
    (up_band & ~arrow_band, up_d, up_n, UP_HALF),
    (lo_band, lo_d, lo_n, LO_HALF),
):
    for (y, x), val in fill(region, dist, n, half).items():
        filled[y, x] = val
# the arrowhead sits on clear background: just remove it
head_only = head_box & ~arrow_band
filled[head_only] = 0

body = filled.copy()
a = body[:, :, 3:4]
body[:, :, :3] = np.where(a > 0, body[:, :, :3] * 255.0 / np.maximum(a, 1e-6), 0)
Image.fromarray(np.clip(body, 0, 255).astype(np.uint8), 'RGBA').save(root + '/body_erased.png')

# Arrow sprite: shaft rebuilt from a clean slice over transparent background,
# head copied pixel for pixel.
slice_x = 330
centre = AR_K * slice_x + AR_B
rows = np.arange(int(centre) - 5, int(centre) + 6)
profile = src[rows, slice_x]
offsets = rows - centre

arrow = np.zeros_like(src)
for x in range(211, 420):
    c = AR_K * x + AR_B
    for dy in range(-6, 7):
        y = int(np.floor(c)) + dy
        off = y - c
        val = np.array([np.interp(off, offsets, profile[:, ch]) for ch in range(4)])
        if val[3] > arrow[y, x, 3]:
            arrow[y, x] = val
arrow[head_box] = src[head_box]
Image.fromarray(np.clip(arrow, 0, 255).astype(np.uint8), 'RGBA').save(root + '/arrow.png')

geo = {
    'arrow': {'k': AR_K, 'b': AR_B, 'nock_x': 210.0, 'tip_x': 445.0},
    'upper': {'k': UP_K, 'b': UP_B},
    'lower': {'k': LO_K, 'b': LO_B},
    'top_tip': [336.5, UP_K * 336.5 + UP_B],
    'bottom_tip': [(246.5 - LO_B) / LO_K, 246.5],
    'nock': [210.0, AR_K * 210.0 + AR_B],
    'lower_hidden': [(130.6 - LO_B) / LO_K, 130.6],
}
with open(root + '/geometry.json', 'w') as f:
    json.dump(geo, f, indent=1)
print('masked px', int(mask.sum()))
