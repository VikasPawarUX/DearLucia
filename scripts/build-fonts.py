"""Make the web fonts in assets/font/ from the source .ttf files next to them.

The three original fonts (Cinzel, Playfair Display, Lora) are converted to WOFF2 with every glyph
kept. The fonts added for Vietnamese, Russian, Thai and Arabic are large, so each is cut down to the
scripts it is used for. All OpenType layout features are kept, so Vietnamese marks still stack,
Thai vowels and tone marks still position, and Arabic letters still join.

Run with fontTools and brotli installed:  python3 scripts/build-fonts.py
"""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

FONTS = Path(__file__).resolve().parent.parent / 'assets' / 'font'

COMMON = [
    (0x0020, 0x007E), (0x00A0, 0x00FF),  # Basic Latin, digits and Latin-1 punctuation
    (0x2000, 0x206F),  # General punctuation: dashes, curly quotes, ellipsis, bidi marks
    (0x25CC, 0x25CC),  # Dotted circle, used by shaping engines for stray marks
]
LATIN_VIETNAMESE_CYRILLIC = COMMON + [
    (0x0100, 0x024F),  # Latin Extended-A and -B (Ă Đ Ơ Ư)
    (0x0300, 0x0323),  # Combining accents
    (0x1EA0, 0x1EF9),  # Vietnamese precomposed letters
    (0x20AB, 0x20AB),  # Đồng sign
    (0x0400, 0x045F), (0x0490, 0x0491),  # Cyrillic
]
THAI = COMMON + [(0x0E01, 0x0E5B), (0x200B, 0x200D)]
# The Arabic block itself. Joining forms and ligatures are reached through the fonts' shaping rules,
# so they stay in; the legacy presentation-form code points aren't needed for typed text.
ARABIC = COMMON + [(0x0600, 0x06FF), (0xFDF2, 0xFDF2)]

# (source, subset ranges or None to keep every glyph)
WEB_FONTS = {
    'Cinzel-SemiBold.ttf': None,
    'PlayfairDisplay-Bold.ttf': None,
    'Lora-MediumItalic.ttf': None,
    'CormorantGaramond-SemiBold.ttf': LATIN_VIETNAMESE_CYRILLIC,
    'NotoSerifThai-Regular.ttf': THAI,
    'NotoSerifThai-SemiBold.ttf': THAI,
    'NotoSerifThai-Bold.ttf': THAI,
    'Amiri-Regular.ttf': ARABIC,
    'Amiri-Bold.ttf': ARABIC,
    'ArefRuqaa-Bold.ttf': ARABIC,
}


def main() -> None:
    for name, ranges in WEB_FONTS.items():
        source = FONTS / name
        target = source.with_suffix('.woff2')
        if ranges is None:
            font = TTFont(source)
            font.flavor = 'woff2'
            font.save(target)
        else:
            unicodes = [code for start, end in ranges for code in range(start, end + 1)]
            # Keep every shaping/positioning feature and the copyright and licence notices.
            subset.main([str(source), f'--output-file={target}', '--flavor=woff2', '--layout-features=*',
                         '--name-IDs=*', '--notdef-outline',
                         '--unicodes=' + ','.join(f'{code:04X}' for code in unicodes)])
        print(f'{target.name:34} {source.stat().st_size / 1024:7.1f} KB -> {target.stat().st_size / 1024:6.1f} KB')


if __name__ == '__main__':
    main()
