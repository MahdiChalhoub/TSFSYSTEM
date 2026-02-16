$dir = "C:\Users\chalh\Dropbox\SOFTWARE POS\pos\New folder"

$word = New-Object -ComObject Word.Application
$word.Visible = $false

$docxFiles = Get-ChildItem -Path $dir -Filter "*.docx" | Where-Object { $_.Name -notlike "~*" }
foreach ($f in $docxFiles) {
    Write-Host "========== $($f.Name) =========="
    try {
        $doc = $word.Documents.Open($f.FullName)
        Write-Host $doc.Content.Text
        $doc.Close($false)
    }
    catch {
        Write-Host "[Error reading file: $_]"
    }
    Write-Host ""
}
$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
