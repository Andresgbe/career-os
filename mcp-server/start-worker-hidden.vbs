' Lanza start-worker.bat sin abrir ninguna ventana de consola.
' Lo usa la tarea programada de Windows para que el worker arranque solo
' al iniciar sesión, sin que tengas que ver ni tocar nada.
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = scriptDir & "\start-worker.bat"

Set shell = CreateObject("WScript.Shell")
shell.Run """" & batPath & """", 0, False
