; Custom NSIS script for auto-launch

!macro customInstall
  ; Ajouter au démarrage automatique Windows
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SpotlightForWindows" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!macroend

!macro customUninstall
  ; Retirer du démarrage automatique
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SpotlightForWindows"
!macroend