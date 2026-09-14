from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "catatan_matriks_printable.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H = A4
INK = HexColor("#000000")
MUTED = HexColor("#657084")
ACCENT = HexColor("#000000")
RULE = HexColor("#ffffff")
PAPER = HexColor("#ffffff")
MARGIN = 42


def register_fonts():
    candidates = [
        ("C:/Windows/Fonts/arial.ttf", "Hand"),
        ("C:/Windows/Fonts/comic.ttf", "Hand"),
        ("C:/Windows/Fonts/arial.ttf", "Hand"),
    ]
    bold_candidates = [
        ("C:/Windows/Fonts/arialbd.ttf", "HandBold"),
        ("C:/Windows/Fonts/comicbd.ttf", "HandBold"),
        ("C:/Windows/Fonts/arialbd.ttf", "HandBold"),
    ]
    for path, name in candidates:
        if Path(path).exists():
            pdfmetrics.registerFont(TTFont(name, path))
            break
    else:
        return "Helvetica", "Helvetica-Bold"
    for path, name in bold_candidates:
        if Path(path).exists():
            pdfmetrics.registerFont(TTFont(name, path))
            return "Hand", name
    return "Hand", "Hand"


FONT, FONT_BOLD = register_fonts()


def ruled_page(c, page_no, title, subtitle):
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setStrokeColor(RULE)
    c.setLineWidth(0.45)
    y = H - 91
    while y > 36:
        c.line(30, y, W - 30, y)
        y -= 26
    c.setStrokeColor(HexColor("#E2A0A0"))
    c.line(67, 35, 67, H - 35)

    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 20)
    c.drawString(84, H - 61, title)
    c.setFillColor(MUTED)
    c.setFont(FONT, 9.5)
    c.drawString(85, H - 78, subtitle)
    c.setStrokeColor(INK)
    c.setLineWidth(0.8)
    c.line(82, H - 84, W - 43, H - 84)

    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawRightString(W - 35, 20, f"Catatan Matriks  |  {page_no}")


def matrix(c, x, y_top, values, cell_w=33, row_h=26, size=14, color=INK):
    rows = len(values)
    cols = len(values[0])
    height = rows * row_h
    width = cols * cell_w
    c.setStrokeColor(color)
    c.setLineWidth(1.2)
    # square brackets
    c.line(x + 5, y_top, x, y_top)
    c.line(x, y_top, x, y_top - height)
    c.line(x, y_top - height, x + 5, y_top - height)
    xr = x + width + 8
    c.line(xr - 5, y_top, xr, y_top)
    c.line(xr, y_top, xr, y_top - height)
    c.line(xr, y_top - height, xr - 5, y_top - height)
    c.setFillColor(color)
    c.setFont(FONT, size)
    for r, row in enumerate(values):
        baseline = y_top - (r + 0.68) * row_h
        for col, val in enumerate(row):
            cx = x + 8 + col * cell_w + cell_w / 2
            c.drawCentredString(cx, baseline, str(val))
    return width + 8, height


def fraction(c, x, y, numerator, denominator, size=13, width=None):
    c.setFont(FONT, size)
    width = width or max(c.stringWidth(str(numerator), FONT, size), c.stringWidth(str(denominator), FONT, size)) + 8
    c.setFillColor(INK)
    c.drawCentredString(x + width / 2, y + 5, str(numerator))
    c.setLineWidth(0.8)
    c.line(x, y + 2, x + width, y + 2)
    c.drawCentredString(x + width / 2, y - size + 1, str(denominator))
    return width


def text(c, x, y, value, size=13, bold=False, color=INK):
    c.setFillColor(color)
    c.setFont(FONT_BOLD if bold else FONT, size)
    c.drawString(x, y, value)


def inverse_example(c, label, vals, det_expr, adj, result, x, y):
    text(c, x, y, label, 14, True, ACCENT)
    text(c, x, y - 28, f"{label[0]} =", 14)
    matrix(c, x + 35, y - 12, vals, cell_w=29, row_h=24, size=13)
    text(c, x, y - 85, f"det({label[0]}) = {det_expr}", 12)
    text(c, x, y - 116, f"{label[0]}^-1 =", 13)
    fraction(c, x + 49, y - 112, "1", det_expr.split("=")[-1].strip(), 11, 28)
    text(c, x + 83, y - 116, "x", 12)
    matrix(c, x + 101, y - 99, adj, cell_w=28, row_h=23, size=12)
    text(c, x, y - 176, "=", 14)
    matrix(c, x + 27, y - 159, result, cell_w=37, row_h=24, size=12)


def page_one(c):
    ruled_page(c, 1, "Invers Matriks 2 x 2", "Rumus ringkas dan contoh perhitungan")
    text(c, 84, H - 119, "Jika", 12, color=MUTED)
    text(c, 122, H - 120, "A =", 15)
    matrix(c, 158, H - 103, [["a", "b"], ["c", "d"]], cell_w=34, row_h=25, size=14)
    text(c, 250, H - 120, ", maka", 12, color=MUTED)

    text(c, 84, H - 182, "A^-1 =", 15, True)
    fraction(c, 145, H - 178, "1", "ad - bc", 12, 58)
    matrix(c, 222, H - 161, [["d", "-b"], ["-c", "a"]], cell_w=38, row_h=26, size=14)
    text(c, 329, H - 181, ", dengan det(A) = ad - bc != 0", 11)

    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.2)
    c.line(84, H - 224, W - 43, H - 224)
    text(c, 84, H - 249, "Contoh", 15, True, ACCENT)

    inverse_example(c, "A", [[1, 2], [3, 4]], "1(4) - 2(3) = -2", [[4, -2], [-3, 1]], [[-2, 1], ["3/2", "-1/2"]], 84, H - 280)
    inverse_example(c, "B", [[-3, 5], [2, -2]], "(-3)(-2) - 5(2) = -4", [[-2, -5], [-2, -3]], [["1/2", "5/4"], ["1/2", "3/4"]], 323, H - 280)

    c.setStrokeColor(RULE)
    c.setLineWidth(0.8)
    c.line(W / 2 + 20, H - 263, W / 2 + 20, H - 490)

    inverse_example(c, "C", [[-3, -2], [4, 3]], "(-3)(3) - (-2)(4) = -1", [[3, 2], [-4, -3]], [[-3, -2], [4, 3]], 84, H - 544)
    text(c, 323, H - 550, "Catatan penting", 14, True, ACCENT)
    text(c, 323, H - 580, "- Invers hanya ada jika determinan != 0.", 10.5)
    text(c, 323, H - 606, "- Tukar posisi a dan d.", 10.5)
    text(c, 323, H - 632, "- Ubah tanda b dan c.", 10.5)
    text(c, 323, H - 658, "- Kalikan dengan 1/det(A).", 10.5)


def page_two(c):
    ruled_page(c, 2, "Determinan Matriks 3 x 3", "Ekspansi kofaktor baris pertama")
    text(c, 84, H - 120, "Misalkan", 12, color=MUTED)
    text(c, 149, H - 120, "A =", 15)
    matrix(c, 184, H - 101, [["a", "b", "c"], ["d", "e", "f"], ["g", "h", "i"]], cell_w=34, row_h=25, size=14)

    text(c, 84, H - 207, "det(A) =", 15, True)
    text(c, 157, H - 207, "a(ei - fh) - b(di - fg) + c(dh - eg)", 14)
    text(c, 84, H - 240, "Pola tanda kofaktor baris pertama:", 11, color=MUTED)
    text(c, 310, H - 240, "+     -     +", 14, True, ACCENT)

    c.setStrokeColor(ACCENT)
    c.setLineWidth(1.2)
    c.line(84, H - 276, W - 43, H - 276)
    text(c, 84, H - 303, "Contoh", 15, True, ACCENT)
    text(c, 84, H - 339, "D =", 15)
    matrix(c, 121, H - 320, [[1, 2, 3], [0, 4, 5], [1, 0, 6]], cell_w=34, row_h=26, size=14)

    text(c, 84, H - 427, "det(D)", 14, True)
    text(c, 145, H - 427, "= 1[(4)(6) - (5)(0)]", 13)
    text(c, 145, H - 459, "  - 2[(0)(6) - (5)(1)]", 13)
    text(c, 145, H - 491, "  + 3[(0)(0) - (4)(1)]", 13)
    text(c, 145, H - 532, "= 1(24) - 2(-5) + 3(-4)", 13)
    text(c, 145, H - 566, "= 24 + 10 - 12", 13)
    text(c, 145, H - 606, "= 22", 19, True, ACCENT)

    text(c, 343, H - 341, "Cara cepat mengingat", 14, True, ACCENT)
    text(c, 343, H - 375, "1. Pilih satu baris/kolom.", 10.5)
    text(c, 343, H - 402, "2. Tutup baris dan kolom elemen.", 10.5)
    text(c, 343, H - 429, "3. Hitung determinan minor 2 x 2.", 10.5)
    text(c, 343, H - 456, "4. Ikuti pola tanda +, -, +.", 10.5)

    text(c, 84, H - 680, "Cek hasil: determinan D = 22, sehingga D memiliki invers.", 11.5, color=MUTED)


def build():
    c = canvas.Canvas(str(OUT), pagesize=A4)
    c.setTitle("Catatan Invers dan Determinan Matriks")
    c.setAuthor("Codex")
    page_one(c)
    c.showPage()
    page_two(c)
    c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
