"""렌더링된 원고 PDF에서 절 제목이 처음 나오는 쪽을 찾아 체크리스트용 JSON으로 저장.

실행: .venv/Scripts/python paper/section_pages.py   (render_check.py로 manuscript_v2.1.pdf를 만든 뒤)
산출: paper/section_pages.json
"""
import json
from pathlib import Path

import pymupdf

DIR = Path(__file__).resolve().parent
HEADINGS = [
    "저자 노트", "국문 초록", "Abstract", "서론", "연구방법", "연구설계와 자료", "연구대상", "변수", "결과변수", "독립변수",
    "결측 처리", "통계분석", "기술통계와 조사설계 기반 회귀분석", "생활요인 선정과 건강 생활요인 점수", "머신러닝", "연구윤리", "연구결과", "연구대상자의 특성",
    "머신러닝 모형의 분류 성능", "영역별 기여도", "변수 수준의 관련 요인", "연령대별 차이", "신체활동과 생활요인의 조합",
    "논의", "주요 결과", "선행연구와의 비교", "우울 증상 극복을 위한 실천 제언", "스포츠산업 측면의 함의", "강점과 한계",
    "결론", "참고문헌", "부록", "표 S1", "표 S2", "표 S3", "그림 1",
]

doc = pymupdf.open(DIR / "manuscript_v2.1.pdf")
pages = {}
for i, page in enumerate(doc, start=1):
    lines = [ln.strip() for ln in page.get_text().splitlines()]
    for h in HEADINGS:
        if h not in pages and h in lines:
            pages[h] = i
missing = [h for h in HEADINGS if h not in pages]
assert not missing, f"PDF에서 찾지 못한 제목: {missing}"
(DIR / "section_pages.json").write_text(json.dumps(pages, ensure_ascii=False, indent=1), encoding="utf-8")
print(pages)
