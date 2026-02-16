$dir = "C:\Users\chalh\Dropbox\SOFTWARE POS"

# Read .docx files using Word COM
$word = New-Object -ComObject Word.Application
$word.Visible = $false

$docxFiles = @("250330.docx", "MORE DETAILES.docx")
foreach ($f in $docxFiles) {
    $path = Join-Path $dir $f
    if (Test-Path $path) {
        Write-Host "========== $f =========="
        $doc = $word.Documents.Open($path)
        Write-Host $doc.Content.Text
        $doc.Close($false)
        Write-Host ""
    }
}
$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null

# Read .rtf files using RichTextBox
Add-Type -AssemblyName System.Windows.Forms
$rtfFiles = @("NEW ROAD MAP.rtf", "New Rich Text Format.rtf", "PURSHASE ORDER.rtf", "ROAD MAP.rtf")
foreach ($f in $rtfFiles) {
    $path = Join-Path $dir $f
    if (Test-Path $path) {
        Write-Host "========== $f =========="
        $rtb = New-Object System.Windows.Forms.RichTextBox
        $rtb.Rtf = [System.IO.File]::ReadAllText($path)
        Write-Host $rtb.Text
        $rtb.Dispose()
        Write-Host ""
    }
}

# Read PDFs - try to extract text
$pdfFiles = @("POS SOFTWARE DETAILS.pdf", "Project Milestone (2).pdf", "logo TSF-2.pdf")
foreach ($f in $pdfFiles) {
    $path = Join-Path $dir $f
    if (Test-Path $path) {
        Write-Host "========== $f =========="
        Write-Host "[PDF file - attempting raw text extraction]"
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $text = [System.Text.Encoding]::UTF8.GetString($bytes)
        # Extract text between stream/endstream
        $matches = [regex]::Matches($text, 'BT\s*(.*?)\s*ET', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        foreach ($m in $matches) {
            $tjMatches = [regex]::Matches($m.Groups[1].Value, '\((.*?)\)\s*Tj')
            foreach ($tj in $tjMatches) {
                Write-Host $tj.Groups[1].Value -NoNewline
                Write-Host " " -NoNewline
            }
        }
        Write-Host ""
    }
}
