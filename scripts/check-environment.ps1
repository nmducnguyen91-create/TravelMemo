$ErrorActionPreference = 'Stop'
foreach ($tool in @('node','npm','git','claude')) {
  if (Get-Command $tool -ErrorAction SilentlyContinue) { & $tool --version } else { Write-Warning "$tool not found" }
}
Write-Host "Workspace: $(Get-Location)"
