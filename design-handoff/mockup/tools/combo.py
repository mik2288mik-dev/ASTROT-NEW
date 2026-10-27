# usage: python3 combo.py out.png a.png b.png ... (half size, side by side)
import sys
from PIL import Image
ims = [Image.open(p) for p in sys.argv[2:]]
ims = [i.resize((i.width // 2, i.height // 2)) for i in ims]
out = Image.new('RGB', (sum(i.width for i in ims) + 20 * (len(ims) - 1), max(i.height for i in ims)), 'white')
x = 0
for i in ims:
    out.paste(i, (x, 0)); x += i.width + 20
out.save(sys.argv[1])
