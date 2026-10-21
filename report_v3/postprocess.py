"""docx-js가 만든 docx에서 제목 1~4 스타일을 'heading' 다단계 목록(Ⅰ./1./가./1))에 연결한다.

docx-js는 스타일 정의에 번호(numPr)를 넣지 못해서, 이대로면 Word에서 제목 스타일만 적용했을 때
번호가 붙지 않는다. 이 스크립트가 styles.xml(스타일→번호)과 numbering.xml(번호 수준→스타일)을
양방향으로 연결해, Word의 '제목 1~4' 스타일을 적용하기만 하면 번호가 자동으로 매겨지게 만든다.

사용: python postprocess.py 파일.docx
"""
import re
import shutil
import sys
import tempfile
import zipfile


def main(path):
    with zipfile.ZipFile(path) as z:
        files = {n: z.read(n) for n in z.namelist()}

    numbering = files['word/numbering.xml'].decode('utf-8')
    styles = files['word/styles.xml'].decode('utf-8')

    # 'heading' 목록 = 0수준이 upperRoman인 abstractNum
    abs_id = None
    for m in re.finditer(r'<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>(.*?)</w:abstractNum>', numbering, re.S):
        if re.search(r'<w:lvl w:ilvl="0"[^>]*>.*?<w:numFmt w:val="upperRoman"', m.group(2), re.S):
            abs_id = m.group(1)
            break
    assert abs_id is not None, 'heading 목록(upperRoman)을 찾지 못함'
    # docx-js는 문단에서 직접 쓴 목록만 <w:num>을 만든다 → 제목용 목록은 없으면 새로 만든다
    found = re.search(r'<w:num w:numId="(\d+)"[^>]*>\s*<w:abstractNumId w:val="%s"/>' % abs_id, numbering)
    if found:
        num_id = found.group(1)
    else:
        num_id = str(max([int(x) for x in re.findall(r'<w:num w:numId="(\d+)"', numbering)] or [0]) + 1)
        numbering = numbering.replace(
            '</w:numbering>',
            '<w:num w:numId="%s"><w:abstractNumId w:val="%s"/></w:num></w:numbering>' % (num_id, abs_id))

    # numbering.xml: 각 수준에 pStyle 추가 (lvlRestart/numFmt 뒤, suff/lvlText 앞)
    def add_pstyle(m):
        block = m.group(0)
        if '<w:pStyle' in block:
            return block
        lvl = int(m.group(1))
        return re.sub(r'(<w:numFmt [^>]*/>)', r'\1<w:pStyle w:val="Heading%d"/>' % (lvl + 1), block, count=1)

    abs_block = re.search(r'<w:abstractNum\b[^>]*w:abstractNumId="%s"[^>]*>.*?</w:abstractNum>' % abs_id, numbering, re.S)
    new_abs = re.sub(r'<w:lvl w:ilvl="(\d)"[^>]*>.*?</w:lvl>', add_pstyle, abs_block.group(0), flags=re.S)
    numbering = numbering.replace(abs_block.group(0), new_abs)

    # styles.xml: Heading1~4의 pPr에 numPr 삽입 (스키마 순서상 keepNext/keepLines 뒤, pBdr/spacing 등 앞)
    for lvl in range(4):
        sid = 'Heading%d' % (lvl + 1)
        sm = re.search(r'<w:style [^>]*w:styleId="%s"[^>]*>.*?</w:style>' % sid, styles, re.S)
        assert sm, sid + ' 스타일 없음'
        block = sm.group(0)
        if '<w:numPr>' in block:
            continue
        numpr = '<w:numPr><w:ilvl w:val="%d"/><w:numId w:val="%s"/></w:numPr>' % (lvl, num_id)
        if '<w:pPr>' not in block:
            block2 = re.sub(r'(<w:rPr>)', '<w:pPr>%s</w:pPr>\\1' % numpr, block, count=1)
        else:
            ppr = re.search(r'<w:pPr>(.*?)</w:pPr>', block, re.S)
            inner = ppr.group(1)
            anchor = re.search(r'<w:(suppressLineNumbers|pBdr|shd|tabs|suppressAutoHyphens|spacing|ind|jc|outlineLvl)\b', inner)
            inner2 = inner[:anchor.start()] + numpr + inner[anchor.start():] if anchor else inner + numpr
            block2 = block.replace(ppr.group(0), '<w:pPr>%s</w:pPr>' % inner2)
        styles = styles.replace(block, block2)

    files['word/numbering.xml'] = numbering.encode('utf-8')
    files['word/styles.xml'] = styles.encode('utf-8')

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
    tmp.close()
    with zipfile.ZipFile(tmp.name, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, data in files.items():
            z.writestr(n, data)
    shutil.move(tmp.name, path)
    print('heading numbering linked: abstractNum', abs_id, '/ numId', num_id)


if __name__ == '__main__':
    main(sys.argv[1])
