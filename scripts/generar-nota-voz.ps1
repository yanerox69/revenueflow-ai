<#
    Genera una nota de voz sintética para probar el agente en otros idiomas.

    Usa WinRT y no System.Speech a propósito: System.Speech solo ve las voces
    registradas como SAPI5 (tres, en esta máquina), mientras que WinRT ve
    todas las OneCore (seis). Una voz recién instalada aparece en OneCore,
    así que por la vía vieja no se vería.

        .\scripts\generar-nota-voz.ps1 -Idioma pt-BR -Texto "Oi, boa tarde..."
        .\scripts\generar-nota-voz.ps1 -Listar
#>
[CmdletBinding()]
param(
    [string] $Idioma = 'en-US',
    [string] $Texto,
    [string] $Salida,
    [switch] $Listar
)

$ErrorActionPreference = 'Stop'

# El puente entre WinRT y .NET vive en este ensamblado, y en PowerShell 5.1
# no está cargado de serie: sin él, [System.WindowsRuntimeSystemExtensions]
# no existe y no hay forma de esperar las operaciones asíncronas.
Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Cargar los tipos WinRT. Sin esta línea, el acelerador de tipos no resuelve.
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]

$voces = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices

if ($Listar) {
    Write-Host "`nVoces disponibles:`n"
    $voces | ForEach-Object { "  {0,-30} {1}" -f $_.DisplayName, $_.Language }
    Write-Host ''
    return
}

if (-not $Texto) {
    Write-Host 'Falta -Texto.'
    exit 1
}

$voz = $voces | Where-Object { $_.Language -eq $Idioma } | Select-Object -First 1

if (-not $voz) {
    # Se acepta el idioma sin región: pt-BR también responde a "pt".
    $voz = $voces | Where-Object { $_.Language -like "$Idioma*" } | Select-Object -First 1
}

if (-not $voz) {
    Write-Host "`nNo hay ninguna voz para '$Idioma'. Instalada las hay para:`n"
    $voces | ForEach-Object { "  {0,-30} {1}" -f $_.DisplayName, $_.Language }
    Write-Host "`nPara instalar una, en PowerShell COMO ADMINISTRADOR:"
    Write-Host "  Add-WindowsCapability -Online -Name `"Language.TextToSpeech~~~$Idioma~0.0.1.0`"`n"
    exit 1
}

if (-not $Salida) {
    $dir = Join-Path $env:TEMP 'claude\voz'
    New-Item -ItemType Directory -Force $dir | Out-Null
    $Salida = Join-Path $dir "nota-$($Idioma.ToLower()).wav"
}

# --- Síntesis -------------------------------------------------------------
# Las operaciones WinRT son asíncronas; desde PowerShell 5.1 se esperan
# convirtiéndolas a Task con AsTask y bloqueando.
function Wait-WinRT {
    param($Operacion, [Type] $Tipo)

    $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {
            $_.Name -eq 'AsTask' -and
            $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
        } | Select-Object -First 1

    $tarea = $asTask.MakeGenericMethod($Tipo).Invoke($null, @($Operacion))
    $tarea.Wait(30000) | Out-Null
    return $tarea.Result
}

$sint = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::new()
$sint.Voice = $voz

$stream = Wait-WinRT $sint.SynthesizeTextToStreamAsync($Texto) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])

$lector = [Windows.Storage.Streams.DataReader]::new($stream.GetInputStreamAt(0))
Wait-WinRT $lector.LoadAsync($stream.Size) ([uint32]) | Out-Null

$bytes = New-Object byte[] $stream.Size
$lector.ReadBytes($bytes)
[System.IO.File]::WriteAllBytes($Salida, $bytes)

$sint.Dispose()

Write-Host ''
Write-Host "  voz      $($voz.DisplayName) ($($voz.Language))"
Write-Host "  archivo  $Salida"
Write-Host ("  tamano   {0} KB" -f [math]::Round($bytes.Length / 1KB))
Write-Host ''
Write-Host '  Para pasarla por el agente:'
Write-Host "    node --conditions=react-server --import tsx scripts/try-agent.mts `"$Salida`" VE"
Write-Host ''
