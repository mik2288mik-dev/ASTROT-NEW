"""Paint the arrow and string out of the Sagittarius illustration with OpenCV.

Writes body_erased.png (and a variant per method for comparison) next to src512.png.
The arrow sprite and geometry come from prep.py; this only replaces the body layer.
"""
import sys

import cv2
import numpy as np
from PIL import Image

root = sys.argv[1]
method = sys.argv[2] if len(sys.argv) > 2 else 'telea'
src = np.array(Image.open(root + '/src512.png').convert('RGBA')).astype(np.float64)
H, W = src.shape[:2]

AR_K, AR_B = 0.05236144, 119.57553
UP_K, UP_B = -0.68906565, 275.23989
LO_K, LO_B = 1.31902147, -206.98565
yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)


def dist(k, b):
    return np.abs(k * xx - yy + b) / np.hypot(k, 1.0)


HALF = 3.9
arrow_band = (dist(AR_K, AR_B) <= HALF) & (xx >= 211) & (xx <= 421)
head_box = (xx >= 418) & (xx <= 448) & (yy >= 131) & (yy <= 155)
up_band = (dist(UP_K, UP_B) <= HALF) & (xx >= 214) & (xx <= 333)
lo_band = (dist(LO_K, LO_B) <= HALF) & (xx >= (188 - LO_B) / LO_K) & (xx <= (244 - LO_B) / LO_K)
# small pocket under the chin that the string used to cover
chin = (xx >= 229) & (xx <= 236) & (yy >= 107) & (yy <= 111)
mask = (arrow_band | up_band | lo_band | chin).astype(np.uint8) * 255

alpha = src[:, :, 3]
prem = src[:, :, :3] * (alpha[:, :, None] / 255.0)

flag = cv2.INPAINT_TELEA if method == 'telea' else cv2.INPAINT_NS
radius = 5
rgb = cv2.inpaint(np.clip(prem, 0, 255).astype(np.uint8), mask, radius, flag).astype(np.float64)
al = cv2.inpaint(np.clip(alpha, 0, 255).astype(np.uint8), mask, radius, flag).astype(np.float64)

# straight colour from the inpainted premultiplied colour and alpha
safe = np.maximum(al, 1.0)[:, :, None]
straight = np.clip(rgb * 255.0 / safe, 0, 255)

# keep hidden silhouettes crisp: inside the mask push alpha towards 0 or 255
m = mask > 0
t = np.clip((al - 70.0) / 110.0, 0, 1)
crisp = t * t * (3 - 2 * t) * 255.0
al = np.where(m, crisp, al)

# smooth reconstructed contours: blur alpha around the mask and re-threshold
grow = cv2.dilate(mask, np.ones((5, 5), np.uint8)) > 0
blur = cv2.GaussianBlur(al, (0, 0), 1.3)
t2 = np.clip((blur - 90.0) / 80.0, 0, 1)
smooth = t2 * t2 * (3 - 2 * t2) * 255.0
al = np.where(grow & (src[:, :, 3] < 250) | m, smooth, al)

out = np.zeros_like(src)
out[:, :, 3] = al
out[:, :, :3] = np.where(al[:, :, None] > 0, straight, 0)
# the arrowhead sits on clear background beyond the bow
out[head_box & ~arrow_band] = 0
out[(xx > 410) & head_box] = 0
img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
img.save(root + '/body_erased_%s.png' % method)
print('ok', method, int(m.sum()))
