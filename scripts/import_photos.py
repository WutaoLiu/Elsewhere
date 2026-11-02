#!/usr/bin/env python3
"""Generate web copies and update the gallery without modifying originals."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
from PIL import Image, ImageCms, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--series', required=True)
    parser.add_argument('--full-resolution', action='store_true', help='Also export an original-resolution quality=95 WebP')
    args = parser.parse_args()
    if not args.source.is_dir():
        parser.error('source must be a readable directory')
    manifest = ROOT / 'site/photos.json'
    old = json.loads(manifest.read_text()) if manifest.exists() else {}
    photos = [] if old.get('demo') else old.get('photos', [])
    known = {p['id'] for p in photos if 'id' in p}
    output = ROOT / 'site/assets/photos'
    output.mkdir(parents=True, exist_ok=True)
    count, failed = 0, 0
    for path in sorted(args.source.rglob('*')):
        if path.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'} or path.name.startswith('._'):
            continue
        try:
            digest = hashlib.sha256(args.series.encode() + b'\0' + path.read_bytes()).hexdigest()[:20]
            if digest in known:
                continue
            with Image.open(path) as original:
                exif = original.getexif()
                date = str(exif.get(36867, '')).split(' ')[0].replace(':', '-')
                profile = original.info.get('icc_profile')
                image = ImageOps.exif_transpose(original)
                if profile:
                    image = ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(profile)), ImageCms.createProfile('sRGB'), outputMode='RGB')
                if image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info):
                    rgba = image.convert('RGBA')
                    background = Image.new('RGBA', rgba.size, '#f4f2ed')
                    image = Image.alpha_composite(background, rgba).convert('RGB')
                else:
                    image = image.convert('RGB')
                width, height = image.size
                tiny = image.copy()
                tiny.thumbnail((32, 32), Image.Resampling.LANCZOS)
                tiny.info.clear()
                buffer = io.BytesIO()
                tiny.save(buffer, format='WEBP', quality=45)
                placeholder = 'data:image/webp;base64,' + base64.b64encode(buffer.getvalue()).decode()
                variants = [('thumb', 800, 82), ('screen', 1440, 82)]
                if args.full_resolution:
                    variants.append(('full', None, 95))
                for label, size, quality in variants:
                    copy = image.copy()
                    if size:
                        copy.thumbnail((size, size), Image.Resampling.LANCZOS)
                    copy.info.clear()
                    copy.save(output / f'{digest}-{label}.webp', quality=quality, method=4 if label == 'full' else 6)
            photos.append({'id': digest, 'title': path.stem, 'alt': path.stem, 'series': args.series, 'date': date, 'width': width, 'height': height,
                           'thumbnail': f'assets/photos/{digest}-thumb.webp', 'preview': f'assets/photos/{digest}-screen.webp', 'previewEdge': 1440, 'placeholder': placeholder})
            if args.full_resolution:
                photos[-1]['full'] = f'assets/photos/{digest}-full.webp'
            known.add(digest)
            count += 1
        except Exception as error:
            failed += 1
            print(f'Could not import {path.name}: {error}')
    if count:
        temporary = manifest.with_suffix('.json.tmp')
        temporary.write_text(json.dumps({'demo': False, 'photos': photos}, ensure_ascii=False, indent=2) + '\n')
        temporary.replace(manifest)
    print(f'Imported {count}; failed {failed}. Originals unchanged.')
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
