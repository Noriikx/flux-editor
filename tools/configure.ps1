# Fills in your GitHub name and Lemon Squeezy details everywhere they're needed.
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding $false
function Edit($file, $pattern, $value) {
  $p = Join-Path $root $file
  $t = [IO.File]::ReadAllText($p)
  $t = [regex]::Replace($t, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $value })
  [IO.File]::WriteAllText($p, $t, $utf8)
}
Write-Host ""
Write-Host "=== Flux setup ===" -ForegroundColor Magenta
$gh = Read-Host "1) Your GitHub username"
$buy = Read-Host "2) Your Stripe Payment Link (starts with https://buy.stripe.com)"
$gh = $gh.Trim(); $buy = $buy.Trim()

Edit 'website\index.html' "const GITHUB = '[^']*';" "const GITHUB = '$gh/flux';"
Edit 'website\index.html' "const CHECKOUT_URL = '[^']*';" "const CHECKOUT_URL = '$buy';"
Edit 'src\pro.js' "const CHECKOUT_URL = '[^']*';" "const CHECKOUT_URL = '$buy';"
Edit 'src\pro.js' "const OWNER_UNLOCKED = (true|false);" "const OWNER_UNLOCKED = false;"
Edit 'package.json' '"repository": "[^"]*"' "`"repository`": `"https://github.com/$gh/flux`""

$wf = Join-Path $root '.github\workflows'
New-Item -ItemType Directory -Force -Path $wf | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'release.yml') (Join-Path $wf 'release.yml') -Force

Write-Host ""
Write-Host "Done! Everything is filled in." -ForegroundColor Green
