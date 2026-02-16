$dir = "C:\Users\chalh\Dropbox\SOFTWARE POS\pos"

# Read .docx files using Word COM
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

# Read .rtf files using RichTextBox
Add-Type -AssemblyName System.Windows.Forms
$rtfFiles = Get-ChildItem -Path $dir -Filter "*.rtf" | Where-Object { $_.Name -notlike "~*" -and $_.Length -gt 100 }
foreach ($f in $rtfFiles) {
    Write-Host "========== $($f.Name) =========="
    try {
        $rtb = New-Object System.Windows.Forms.RichTextBox
        $rtb.Rtf = [System.IO.File]::ReadAllText($f.FullName)
        Write-Host $rtb.Text
        $rtb.Dispose()
    }
    catch {
        Write-Host "[Error reading file: $_]"
    }
    Write-Host ""
}

# List small/empty RTF files
$emptyRtfs = Get-ChildItem -Path $dir -Filter "*.rtf" | Where-Object { $_.Name -notlike "~*" -and $_.Length -le 100 }
if ($emptyRtfs) {
    Write-Host "========== EMPTY/PLACEHOLDER RTF FILES =========="
    foreach ($f in $emptyRtfs) {
        Write-Host "  - $($f.Name) ($($f.Length) bytes)"
    }
}
