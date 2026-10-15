"""원고 렌더링 확인 — MS Word로 docx → PDF 변환 후 페이지 이미지 생성.

실행: .venv/Scripts/python paper/render_check.py paper/manuscript_v2.docx
산출: 같은 이름의 .pdf, 임시 폴더의 page-NN.png (렌더링 점검용)
"""
import subprocess
import sys
from pathlib import Path

docx = Path(sys.argv[1]).resolve()
pdf = docx.with_suffix(".pdf")
ps = (
    "$w = New-Object -ComObject Word.Application; $w.Visible = $false; "
    f"$d = $w.Documents.Open('{docx}', $false, $true); "
    f"$d.SaveAs([ref]'{pdf}', [ref]17); $d.Close([ref]0); $w.Quit()"
)
subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)

import pymupdf  # noqa: E402

out = Path(sys.argv[2]) if len(sys.argv) > 2 else docx.parent / "_render"
out.mkdir(parents=True, exist_ok=True)
doc = pymupdf.open(pdf)
for i, page in enumerate(doc, start=1):
    page.get_pixmap(dpi=70).save(out / f"page-{i:02d}.png")
print(f"PDF {pdf.name}: {doc.page_count}쪽 → {out}")
