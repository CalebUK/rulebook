# Draws the link-preview card (assets/og-image.png, 1200x630) and app icons (assets/icon-180.png, icon-512.png).
# Windows PowerShell 5.1 with System.Drawing. Run: powershell -File scripts/make-images.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root "assets"
New-Item -ItemType Directory -Force $assets | Out-Null

function Color($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
function RoundedRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}
function NewCanvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"
  $g.TextRenderingHint = "AntiAliasGridFit"
  return @($bmp, $g)
}

$paper = Color "#f5f2ea"; $card = Color "#fffdf8"; $ink = Color "#1f1d19"; $soft = Color "#5c574d"
$faint = Color "#8d8778"; $green = Color "#1e6b47"; $red = Color "#b8402a"; $amber = Color "#c98a12"; $empty = Color "#e3ddce"

# Link preview card
$bmp, $g = NewCanvas 1200 630
$g.Clear($paper)
$serifBig = New-Object System.Drawing.Font "Georgia", 92, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$serifClue = New-Object System.Drawing.Font "Georgia", 40, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$sans = New-Object System.Drawing.Font "Segoe UI", 34, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$label = New-Object System.Drawing.Font "Segoe UI Semibold", 22, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$small = New-Object System.Drawing.Font "Segoe UI Semibold", 30, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)

$g.DrawString("Rulebook", $serifBig, (New-Object System.Drawing.SolidBrush $ink), 72, 52)
$g.DrawString("Guess the sport from its most obscure rules.", $sans, (New-Object System.Drawing.SolidBrush $soft), 78, 170)

$px = 80
foreach ($c in @($red, $amber, $green, $empty, $empty)) {
  $g.FillPath((New-Object System.Drawing.SolidBrush $c), (RoundedRect $px 252 70 16 8))
  $px += 86
}

$cardPath = RoundedRect 72 300 1056 220 22
$g.FillPath((New-Object System.Drawing.SolidBrush $card), $cardPath)
$g.DrawPath((New-Object System.Drawing.Pen $ink, 5), $cardPath)
$g.DrawString("RULE 1 OF 5", $label, (New-Object System.Drawing.SolidBrush $faint), 110, 330)
$clueRect = New-Object System.Drawing.RectangleF 108, 368, 990, 120
$g.DrawString("Only one player on each team is allowed to wear tracksuit bottoms.", $serifClue, (New-Object System.Drawing.SolidBrush $ink), $clueRect)

$g.DrawString("Five guesses. A new puzzle every day.", $small, (New-Object System.Drawing.SolidBrush $green), 76, 548)
$bmp.Save((Join-Path $assets "og-image.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

# App icons: a serif R on the game's green, with the three feedback colours beneath it
foreach ($size in @(180, 512)) {
  $bmp, $g = NewCanvas $size $size
  $g.Clear($green)
  $s = $size / 512
  $font = New-Object System.Drawing.Font "Georgia", (330 * $s), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = "Center"
  $g.DrawString("R", $font, (New-Object System.Drawing.SolidBrush $paper), (New-Object System.Drawing.RectangleF 0, (40 * $s), $size, (360 * $s)), $fmt)
  $bx = 146 * $s
  foreach ($c in @((Color "#f08a73"), (Color "#f0c35a"), $paper)) {
    $g.FillPath((New-Object System.Drawing.SolidBrush $c), (RoundedRect $bx (410 * $s) (60 * $s) (22 * $s) (11 * $s)))
    $bx += 80 * $s
  }
  $bmp.Save((Join-Path $assets "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Write-Output "Wrote og-image.png, icon-180.png, icon-512.png to $assets"
