# Word로 docx를 열어 목차·필드(쪽 번호, [표 n]/[그림 n])를 갱신해 저장하고 PDF도 함께 만든다.
# 사용: powershell -ExecutionPolicy Bypass -File finalize.ps1 <docx 절대경로> [pdf 절대경로]
param([string]$Docx, [string]$Pdf = "")
$ErrorActionPreference = 'Stop'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($Docx, $false, $false)
    $doc.Fields.Update() | Out-Null
    foreach ($t in $doc.TablesOfContents) { $t.Update() }
    $doc.Repaginate()
    foreach ($t in $doc.TablesOfContents) { $t.UpdatePageNumbers() }
    # 한국외대체·휴먼명조는 다른 PC에 없을 수 있어 사용한 글자만 docx 안에 포함(fsType 4: 인쇄·미리보기 포함 허용)
    $doc.EmbedTrueTypeFonts = $true
    $doc.SaveSubsetFonts = $true
    $doc.DoNotEmbedSystemFonts = $true
    $doc.Save()
    if ($Pdf -ne "") { $doc.ExportAsFixedFormat($Pdf, 17) }
    "pages: " + $doc.ComputeStatistics(2)
    $doc.Close($false)
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
