#$url = "https://api.github.com/repos/HedCET/paytm-movies/contents/BheeshmaParvam"
#$url = "https://api.github.com/repos/HedCET/bms/contents/BheeshmaParvam"

$bmsTrackerMovieNames = @("BheeshmaParvam", "Pathaan")
$bmsTrackerUrl = "https://api.github.com/repos/HedCET/bms/contents/"
$paytmTrackerMovieNames = @("BheeshmaParvam", "Pathaan")
$paytmTrackerUrl = "https://api.github.com/repos/HedCET/paytm-movies/contents/"
$storePath = "store\dump"

# bms diff store
foreach ($movieName in $bmsTrackerMovieNames) {
    $movieUrl = $bmsTrackerUrl + $movieName
    Write-Host "downloading $movieUrl"
    $r = Invoke-WebRequest -Uri $movieUrl
    $movieFiles = ConvertFrom-Json $r.content

    foreach ($movieFile in $movieFiles) {
        $movieFile.name -match '^(.*)\.(\d\d\d\d-\d\d-\d\d)'
        $movieId = $matches[1]
        $movieDate = $matches[2]
        $movieFilePath = "$storePath\$movieName.bms.$movieId.$movieDate.csv"

        if (!(Test-Path $movieFilePath -PathType Leaf)) {
            $movieFileUrl = $movieFile.download_url
            Write-Host "downloading $movieFileUrl"
            $r = Invoke-WebRequest -Uri $movieFileUrl
            $movieFileData = ConvertFrom-CSV $r.content
            foreach ($movieFileRow in $movieFileData) {
                # add-member -InputObject $movieFileRow -NotePropertyName "Source" -NotePropertyValue "bms"
                add-member -InputObject $movieFileRow -NotePropertyName "Movie" -NotePropertyValue $movieName
            }
            $movieFileData | export-csv -Path $movieFilePath -Encoding "UTF8" -NoTypeInformation
        }
    }
}

# paytm diff store
foreach ($movieName in $paytmTrackerMovieNames) {
    $movieUrl = $paytmTrackerUrl + $movieName
    Write-Host "downloading $movieUrl"
    $r = Invoke-WebRequest -Uri $movieUrl
    $movieFiles = ConvertFrom-Json $r.content

    foreach ($movieFile in $movieFiles) {
        $movieFile.name -match '^(.*)\.(\d\d\d\d-\d\d-\d\d)'
        $movieId = $matches[1]
        $movieDate = $matches[2]
        $movieFilePath = "$storePath\$movieName.paytm.$movieId.$movieDate.csv"

        if (!(Test-Path $movieFilePath -PathType Leaf)) {
            $movieFileUrl = $movieFile.download_url
            Write-Host "downloading $movieFileUrl"
            $r = Invoke-WebRequest -Uri $movieFileUrl
            $movieFileData = ConvertFrom-CSV $r.content
            foreach ($movieFileRow in $movieFileData) {
                # add-member -InputObject $movieFileRow -NotePropertyName "Source" -NotePropertyValue "paytm"
                add-member -InputObject $movieFileRow -NotePropertyName "Movie" -NotePropertyValue $movieName
            }
            $movieFileData | export-csv -Path $movieFilePath -Encoding "UTF8" -NoTypeInformation
        }
    }
}
