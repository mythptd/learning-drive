# Gộp dữ liệu 600 câu từ 2 nguồn + lời giải thích, sinh data/questions.js cho web.
#   -GplxRepo : clone của github.com/lttkiet/gplx-vietnam (câu hỏi, đáp án, cờ điểm liệt, trích dẫn luật)
#   -LaixeRepo: clone của github.com/tducn110/laixe (ảnh minh họa, giải thích 115 câu sa hình)
# Giải thích bổ sung đọc từ data/explanations/*.json dạng { "id": { "why": "...", "tip": "..." } }.
param(
  [Parameter(Mandatory)] [string] $GplxRepo,
  [Parameter(Mandatory)] [string] $LaixeRepo,
  [string] $DumpMerged
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
function ReadText($p) { [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8) }

$gplx  = (ReadText "$GplxRepo\src\lib\question-bank-2025.json" | ConvertFrom-Json).questions
$laixe = ReadText "$LaixeRepo\data\questions.json" | ConvertFrom-Json
$lx = @{}; foreach ($q in $laixe) { $lx[[int]$q.id] = $q }

# Giải thích 115 câu sa hình nằm trong rules.js (window.QUESTION_RULES = {...};)
$rulesJs = ReadText "$LaixeRepo\data\rules.js"
$m = [regex]::Match($rulesJs, 'window\.QUESTION_RULES\s*=\s*(\{[\s\S]*?\r?\n\});')
if (-not $m.Success) { throw 'Không tìm thấy QUESTION_RULES trong rules.js' }
$saHinh = $m.Groups[1].Value | ConvertFrom-Json

$extra = @{}
Get-ChildItem "$root\data\explanations\*.json" -ErrorAction SilentlyContinue | ForEach-Object {
  $obj = ReadText $_.FullName | ConvertFrom-Json
  foreach ($p in $obj.PSObject.Properties) { $extra[[int]$p.Name] = $p.Value }
}

$chapterOf = @{
  'Quy định chung và quy tắc giao thông đường bộ' = 1
  'Văn hóa giao thông, đạo đức và cứu hộ'         = 2
  'Kỹ thuật lái xe'                               = 3
  'Cấu tạo và sửa chữa'                           = 4
  'Báo hiệu đường bộ'                             = 5
  'Sa hình và xử lý tình huống'                   = 6
}

$imgDir = "$root\assets\questions"
New-Item -ItemType Directory -Force $imgDir, "$root\data" | Out-Null
$out = New-Object System.Collections.Generic.List[object]
$missing = @()

foreach ($g in ($gplx | Sort-Object { [int]$_.id })) {
  $id = [int]$g.id
  $l = $lx[$id]
  if ($null -eq $l) { throw "laixe thiếu câu $id" }
  if ([int]$g.correct -ne [int]$l.answer) { throw "Lệch đáp án câu $id" }

  $imgs = @()
  foreach ($src in @($l.images)) {
    $name = Split-Path -Leaf $src
    Copy-Item "$LaixeRepo\$src" "$imgDir\$name" -Force
    $imgs += "assets/questions/$name"
  }

  $law = @($g.evidence | Where-Object { $_.kind -eq 'law' } | ForEach-Object {
    [ordered]@{ title = $_.title; cite = $_.citation; quote = $_.quote; url = $_.url }
  })

  $exp = $null
  $r = $saHinh.PSObject.Properties[[string]$id]
  if ($r) {
    $steps = @($r.Value.steps | Where-Object { $_ } | ForEach-Object { [ordered]@{ t = $_.title; c = $_.content } })
    $exp = [ordered]@{ why = $r.Value.why; rule = $r.Value.rule; tip = $r.Value.tip; steps = $steps; src = 'laixe' }
  }
  elseif ($extra.ContainsKey($id)) { $e = $extra[$id]; $exp = [ordered]@{ why = $e.why; rule = $e.rule; tip = $e.tip; src = 'claude' } }
  else { $missing += $id }

  $out.Add([ordered]@{
    id   = $id
    ch   = $chapterOf[$g.category]
    q    = $g.question
    a    = @($g.answers)
    c    = [int]$g.correct
    crit = [bool]$g.critical
    img  = $imgs
    law  = $law
    exp  = $exp
  })
}

$json = $out | ConvertTo-Json -Depth 6 -Compress
$header = "// Sinh tự động bởi tools/build-data.ps1 — không sửa tay.`n// Nguồn: Bộ 600 câu hỏi sát hạch lái xe cơ giới đường bộ, Cục CSGT - Bộ Công an (2025), CV 2262/CSGT-P5.`n"
[IO.File]::WriteAllText("$root\data\questions.js", $header + "window.QUESTIONS = $json;`n", $utf8)
if ($DumpMerged) { [IO.File]::WriteAllText($DumpMerged, $json, $utf8) }

"Đã ghi $($out.Count) câu, $((Get-ChildItem $imgDir).Count) ảnh. Câu chưa có giải thích: $($missing.Count)"
