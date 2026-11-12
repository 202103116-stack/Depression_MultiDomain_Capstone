"""팀 Canva PPTX에 포함된 글꼴을 중간발표 통합본에 옮겨 넣는다.

실행: python -X utf8 presentation/embed_fonts.py   (node presentation/build_midterm.js 실행 후)
대상: presentation/midterm_integrated.pptx (제자리 수정)
글꼴이 설치되지 않은 PC에서도 BRAND_midterm.md의 글꼴(강한놈소프트보일드, 210 디딤고딕 등)로 보이게 한다.
<p:embeddedFontLst>는 스키마 순서대로 <p:notesSz> 바로 뒤에 넣는다.
"""
import os
import re
import shutil
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "우울연구 자체제작.pptx"
DST = HERE / "midterm_integrated.pptx"
USED = ["강한놈소프트보일드", "210 디딤고딕", "210 디딤고딕 Bold", "JASO Sans", "Poppins Medium", "Nanum Square Ultra-Bold"]
REL_FONT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"


def source_fonts(z):
    """원본에서 글꼴 이름별 <p:font .../> 요소와 fntdata 경로를 읽는다."""
    pres = z.read("ppt/presentation.xml").decode("utf-8")
    rels = z.read("ppt/_rels/presentation.xml.rels").decode("utf-8")
    target = {}
    for rel in re.findall(r"<Relationship [^>]*/>", rels):
        rid, tgt = re.search(r'Id="([^"]+)"', rel).group(1), re.search(r'Target="([^"]+)"', rel).group(1)
        target[rid] = tgt
    out = {}
    for ef in re.findall(r"<p:embeddedFont>(.*?)</p:embeddedFont>", pres, re.S):
        font = re.search(r"<p:font [^>]*/>", ef).group(0)
        name = re.search(r'typeface="([^"]+)"', font).group(1)
        rid = re.search(r'<p:regular r:id="([^"]+)"', ef).group(1)
        out[name] = (font, "ppt/" + target[rid])
    return out


def main():
    src = zipfile.ZipFile(SRC)
    fonts = source_fonts(src)
    missing = [n for n in USED if n not in fonts]
    assert not missing, f"원본 PPTX에 없는 글꼴: {missing}"

    dst = zipfile.ZipFile(DST)
    names = dst.namelist()
    pres = dst.read("ppt/presentation.xml").decode("utf-8")
    rels = dst.read("ppt/_rels/presentation.xml.rels").decode("utf-8")
    ctypes = dst.read("[Content_Types].xml").decode("utf-8")
    assert "<p:embeddedFontLst>" not in pres, "이미 글꼴이 포함되어 있다(build_midterm.js부터 다시 실행)"

    used_ids = {int(x) for x in re.findall(r'Id="rId(\d+)"', rels)}
    next_id = max(used_ids) + 1
    entries, new_rels, files = [], [], {}
    for i, name in enumerate(USED):
        font_el, path = fonts[name]
        rid = f"rId{next_id + i}"
        part = f"fonts/font{i + 1}.fntdata"
        files["ppt/" + part] = src.read(path)
        new_rels.append(f'<Relationship Id="{rid}" Type="{REL_FONT}" Target="{part}"/>')
        entries.append(f'<p:embeddedFont>{font_el}<p:regular r:id="{rid}"/></p:embeddedFont>')

    lst = "<p:embeddedFontLst>" + "".join(entries) + "</p:embeddedFontLst>"
    pres, k = re.subn(r"(<p:notesSz [^>]*/>)", r"\1" + lst.replace("\\", "\\\\"), pres, count=1)
    assert k == 1, "<p:notesSz>를 찾지 못했다"
    head = re.search(r"<p:presentation [^>]*>", pres).group(0)
    attrs = "".join(f' {a}="1"' for a in ("embedTrueTypeFonts", "saveSubsetFonts") if f"{a}=" not in head)  # pptxgenjs가 이미 쓴 속성은 그대로 둔다
    pres = pres.replace(head, head.replace("<p:presentation", "<p:presentation" + attrs, 1), 1)
    rels = rels.replace("</Relationships>", "".join(new_rels) + "</Relationships>")
    if 'Extension="fntdata"' not in ctypes:
        ctypes = ctypes.replace(
            "<Default ", '<Default Extension="fntdata" ContentType="application/x-fontdata"/><Default ', 1)

    fd, tmp = tempfile.mkstemp(suffix=".pptx")
    os.close(fd)
    tmp = Path(tmp)
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
        for n in names:
            data = {"ppt/presentation.xml": pres, "ppt/_rels/presentation.xml.rels": rels, "[Content_Types].xml": ctypes}.get(n)
            out.writestr(n, data.encode("utf-8") if data is not None else dst.read(n))
        for n, b in files.items():
            out.writestr(n, b)
    dst.close()
    shutil.move(str(tmp), DST)
    print(f"글꼴 {len(USED)}개 포함: {DST} ({DST.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
