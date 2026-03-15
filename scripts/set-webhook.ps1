# Set Telegram webhook for Stars payment flow
# Requires BOT_TOKEN and WEBHOOK_SECRET_TOKEN in env or .env
# Usage: .\scripts\set-webhook.ps1
# Or: $env:BOT_TOKEN="..."; $env:WEBHOOK_SECRET_TOKEN="..."; .\scripts\set-webhook.ps1

$url = "https://astrot-production.up.railway.app/api/telegram/webhook"
$bot = $env:BOT_TOKEN
$secret = $env:WEBHOOK_SECRET_TOKEN

if (-not $bot) { Write-Host "Error: BOT_TOKEN not set"; exit 1 }
if (-not $secret) { Write-Host "Error: WEBHOOK_SECRET_TOKEN not set"; exit 1 }

$body = @{ url = $url; secret_token = $secret } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri "https://api.telegram.org/bot$bot/setWebhook" -Method Post -ContentType "application/json" -Body $body
Write-Host ($resp | ConvertTo-Json -Depth 3)
