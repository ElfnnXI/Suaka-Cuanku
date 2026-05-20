Write-Host ""
Write-Host "PostgreSQL host-level checks for Suaka Cuanku" -ForegroundColor Cyan

Write-Host ""
Write-Host "A. Check PostgreSQL listener on port 5432"
Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, State, OwningProcess

Write-Host ""
Write-Host "B. Check common backup files under project directory"
Get-ChildItem -Path . -Recurse -Include *.json,*.dump,*.backup -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match 'backup|dump' } |
  Select-Object FullName, Length, LastWriteTime

Write-Host ""
Write-Host "C. Check Windows scheduled tasks related to PostgreSQL / backup"
Get-ScheduledTask -ErrorAction SilentlyContinue |
  Where-Object {
    $_.TaskName -match 'postgres|backup|suaka' -or
    $_.TaskPath -match 'postgres|backup|suaka'
  } |
  Select-Object TaskName, TaskPath, State

Write-Host ""
Write-Host "D. Check if pg_dump / pg_restore are available in PATH"
Get-Command pg_dump, pg_restore -ErrorAction SilentlyContinue |
  Select-Object Name, Source
