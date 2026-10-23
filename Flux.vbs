' Starts Flux without a black terminal window.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
exe = dir & "\node_modules\electron\dist\electron.exe"
If Not fso.FileExists(exe) Then
  MsgBox "Flux isn't installed yet." & vbCrLf & "Double-click 'Install Flux.bat' first.", 48, "Flux"
  WScript.Quit
End If
sh.CurrentDirectory = dir
sh.Run """" & exe & """ """ & dir & """", 1, False
