# Creates "Flux" shortcuts on the Desktop and in the Start menu.
$root = Split-Path -Parent $PSScriptRoot
$shell = New-Object -ComObject WScript.Shell
$places = @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'))
foreach ($p in $places) {
  $lnk = $shell.CreateShortcut((Join-Path $p 'Flux.lnk'))
  $lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
  $lnk.Arguments = '"' + (Join-Path $root 'Flux.vbs') + '"'
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = (Join-Path $root 'build\icon.ico') + ',0'
  $lnk.Description = 'Flux video editor'
  $lnk.Save()
}
