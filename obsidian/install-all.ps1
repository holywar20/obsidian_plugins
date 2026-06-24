$plugins = @(
	'dev-utilities'
	'favorites'
	'filename-search'
	'vue-viewer'
)

$root = $PSScriptRoot

foreach ( $name in $plugins ) {
	$path = Join-Path $root $name
	Write-Host "`n==> $name" -ForegroundColor Cyan
	Push-Location $path
	npm install
	Pop-Location
}

Write-Host "`nDone." -ForegroundColor Green
