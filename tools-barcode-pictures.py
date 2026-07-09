# Generates scannable barcode "photos" for every product that has a
# samplePicture path but no file yet. Run: python tools-barcode-pictures.py
import json, os
from barcode import get_barcode_class
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'public', 'sample-pictures')
os.makedirs(OUT, exist_ok=True)
db = json.load(open(os.path.join(HERE, 'data', 'db.json')))

try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
except Exception:
    font = small = ImageFont.load_default()

made = 0
for p in db['products']:
    sp = p.get('samplePicture')
    if not sp: continue
    dest = os.path.join(OUT, os.path.basename(sp))
    if os.path.exists(dest): continue
    code = p['barcode']
    if len(code) == 12:
        cls, payload = get_barcode_class('upc'), code[:11]
    elif len(code) == 13:
        cls, payload = get_barcode_class('ean13'), code[:12]
    else:
        continue
    bc = cls(payload, writer=ImageWriter())
    tmp = os.path.join('/tmp', 'bc-' + os.path.basename(sp))
    bc.save(tmp[:-4], options={'module_height': 18.0, 'font_size': 12, 'quiet_zone': 4})
    bimg = Image.open(tmp)
    W, H = max(bimg.width + 80, 520), bimg.height + 130
    canvas = Image.new('RGB', (W, H), '#f4f4f2')
    d = ImageDraw.Draw(canvas)
    d.rectangle([10, 10, W-10, H-10], outline='#cccccc', width=2)
    d.text((30, 26), p.get('brand', ''), font=font, fill='#222222')
    t = p['title'] if len(p['title']) <= 48 else p['title'][:46] + '…'
    d.text((30, 58), t, font=small, fill='#555555')
    canvas.paste(bimg, ((W - bimg.width)//2, 95))
    canvas.save(dest)
    made += 1
print('barcode pictures created:', made)
