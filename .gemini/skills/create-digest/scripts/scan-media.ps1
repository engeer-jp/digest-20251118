param (
    [Parameter(Mandatory=$true)]
    [string]$FolderPath
)

# 対象フォルダの存在チェック
if (-not (Test-Path $FolderPath)) {
    Write-Error "エラー: フォルダが見つかりません: $FolderPath"
    exit 1
}

$FolderPath = (Resolve-Path $FolderPath).Path

# 対象拡張子
$imageExtensions = @(".jpg", ".jpeg", ".png", ".heic")
$videoExtensions = @(".mp4", ".mov")
$allExtensions = $imageExtensions + $videoExtensions

# ファイル取得（サブフォルダを含む）
$allFiles = Get-ChildItem -Path $FolderPath -File -Recurse | Where-Object {
    $allExtensions -contains $_.Extension.ToLower()
}

# ファイル名から日付を抽出する関数
function Get-DateFromFilename {
    param ([string]$Filename)

    # パターン1: YYYYMMDD (例: IMG_20250715_143022.jpg)
    if ($Filename -match '(\d{4})(\d{2})(\d{2})') {
        $year = [int]$Matches[1]
        $month = [int]$Matches[2]
        $day = [int]$Matches[3]
        if ($year -ge 2000 -and $year -le 2099 -and $month -ge 1 -and $month -le 12 -and $day -ge 1 -and $day -le 31) {
            return "{0:D4}-{1:D2}-{2:D2}" -f $year, $month, $day
        }
    }

    # パターン2: YYYY-MM-DD (例: 2025-07-15_photo.jpg)
    if ($Filename -match '(\d{4})-(\d{2})-(\d{2})') {
        return $Matches[0]
    }

    return $null
}

# 動画の長さを取得する関数 (Windows Shell COM)
function Get-VideoDuration {
    param ([string]$FilePath)

    try {
        $shell = New-Object -ComObject Shell.Application
        $folder = $shell.Namespace((Split-Path $FilePath))
        $file = $folder.ParseName((Split-Path $FilePath -Leaf))

        # プロパティ27 = Length (duration)
        $duration = $folder.GetDetailsOf($file, 27)

        if ($duration -and $duration -ne "") {
            # "HH:MM:SS" 形式をパース
            $parts = $duration.Split(":")
            if ($parts.Count -eq 3) {
                $totalSeconds = [int]$parts[0] * 3600 + [int]$parts[1] * 60 + [int]$parts[2]
                return $totalSeconds
            } elseif ($parts.Count -eq 2) {
                $totalSeconds = [int]$parts[0] * 60 + [int]$parts[1]
                return $totalSeconds
            }
        }
    } catch {
        # 取得失敗時はnullを返す
    }

    return $null
}

# 画像ファイル情報を収集
$images = @()
$videos = @()

foreach ($file in $allFiles) {
    $ext = $file.Extension.ToLower()
    $dateFromFilename = Get-DateFromFilename -Filename $file.Name
    $sortDate = if ($dateFromFilename) { $dateFromFilename } else { $file.LastWriteTime.ToString("yyyy-MM-dd") }

    # ルートからの相対パス（staticFile("media/<relativePath>") で使用）
    $relativePath = $file.FullName.Substring($FolderPath.Length + 1).Replace('\', '/')

    $baseInfo = [ordered]@{
        filename        = $relativePath
        fullPath        = $file.FullName
        extension       = $ext
        sizeBytes       = $file.Length
        lastWriteTime   = $file.LastWriteTime.ToString("yyyy-MM-ddTHH:mm:ss")
        dateFromFilename = $dateFromFilename
        sortDate        = $sortDate
    }

    if ($imageExtensions -contains $ext) {
        $images += [PSCustomObject]$baseInfo
    } elseif ($videoExtensions -contains $ext) {
        $durationSeconds = Get-VideoDuration -FilePath $file.FullName
        $baseInfo["durationSeconds"] = $durationSeconds
        $videos += [PSCustomObject]$baseInfo
    }
}

# 日付順でソート
$images = $images | Sort-Object sortDate
$videos = $videos | Sort-Object sortDate

# 日付範囲を計算
$allDates = @()
foreach ($img in $images) { $allDates += $img.sortDate }
foreach ($vid in $videos) { $allDates += $vid.sortDate }
$allDates = $allDates | Sort-Object

$dateRange = [ordered]@{
    earliest = if ($allDates.Count -gt 0) { $allDates[0] } else { $null }
    latest   = if ($allDates.Count -gt 0) { $allDates[-1] } else { $null }
}

# sortDateフィールドを出力から除去
$imagesOutput = $images | ForEach-Object {
    $obj = [ordered]@{
        filename         = $_.filename
        fullPath         = $_.fullPath
        extension        = $_.extension
        sizeBytes        = $_.sizeBytes
        lastWriteTime    = $_.lastWriteTime
        dateFromFilename = $_.dateFromFilename
    }
    [PSCustomObject]$obj
}

$videosOutput = $videos | ForEach-Object {
    $obj = [ordered]@{
        filename         = $_.filename
        fullPath         = $_.fullPath
        extension        = $_.extension
        sizeBytes        = $_.sizeBytes
        lastWriteTime    = $_.lastWriteTime
        dateFromFilename = $_.dateFromFilename
        durationSeconds  = $_.durationSeconds
    }
    [PSCustomObject]$obj
}

# 結果をJSON出力
$result = [ordered]@{
    folderPath = $FolderPath
    images     = @($imagesOutput)
    videos     = @($videosOutput)
    dateRange  = $dateRange
    totalFiles = $allFiles.Count
}

$result | ConvertTo-Json -Depth 4
