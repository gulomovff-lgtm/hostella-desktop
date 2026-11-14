; Своё окно установки Hostella (13.11.2026): вместо серого окна NSIS —
; заставка assets/hostella-splash.ps1 (логотип, сменяющиеся подписи, полоса,
; вращающийся гирих). Она прячет стандартное окно установщика и гаснет, когда
; установщик закончил. При тихой установке (обновление) заставку показывает
; сама программа перед перезапуском — здесь её не запускаем.
!macro customInit
  ${IfNot} ${Silent}
    InitPluginsDir
    File /oname=$PLUGINSDIR\hostella-splash.ps1 "${BUILD_RESOURCES_DIR}\hostella-splash.ps1"
    File /oname=$PLUGINSDIR\splash-logo.png "${BUILD_RESOURCES_DIR}\splash-logo.png"
    System::Call 'kernel32::GetCurrentProcessId() i .r0'
    ExecShell "open" "powershell.exe" '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$PLUGINSDIR\hostella-splash.ps1" -Mode install -WatchPid $0 -Logo "$PLUGINSDIR\splash-logo.png" -Version ${VERSION}' SW_HIDE
  ${EndIf}
!macroend
