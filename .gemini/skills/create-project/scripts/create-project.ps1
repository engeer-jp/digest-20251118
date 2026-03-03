param (
    [Parameter(Mandatory=$true)]
    [string]$ProjectName
)

$RootDir = "a:\SlideShow"
$TemplatePath = Join-Path $RootDir "template-project"
$TargetPath = Join-Path $RootDir $ProjectName

if (Test-Path $TargetPath) {
    Write-Host "エラー: '$ProjectName' ディレクトリは既に存在します。" -ForegroundColor Red
    exit 1
}

Write-Host "テンプレートから '$ProjectName' を作成中..." -ForegroundColor Cyan

# テンプレートのコピー（Junctionそのものは実体としてコピーされてしまう可能性があるので、後で再作成する）
Copy-Item -Path $TemplatePath -Destination $TargetPath -Recurse

# コピー後のpackage.jsonの更新
$PackageJsonPath = Join-Path $TargetPath "package.json"
if (Test-Path $PackageJsonPath) {
    (Get-Content $PackageJsonPath) -replace '"name":\s*"[^"]+"', "`"name`": `"$ProjectName`"" | Set-Content $PackageJsonPath
    Write-Host "package.jsonのプロジェクト名を更新しました。" -ForegroundColor Green
}

# 共有スキル用Junctionの再作成
$Junctions = @(".claude", ".gemini", ".github")
$SharedSkillsDir = Join-Path $RootDir "_shared\skills"

foreach ($Junction in $Junctions) {
    $JunctionPath = Join-Path $TargetPath $Junction
    
    # コピーされた実体を削除
    if (Test-Path $JunctionPath) {
        Remove-Item -Path $JunctionPath -Recurse -Force
    }

    # 共有skillsフォルダが存在すればJunctionを作成
    $TargetSharedPath = Join-Path $SharedSkillsDir $Junction
    if (Test-Path $TargetSharedPath) {
        New-Item -ItemType Junction -Path $JunctionPath -Target $TargetSharedPath | Out-Null
    }
}

Write-Host "Junctionリンク（.claude, .gemini, .github）を _shared\skills に再設定しました。" -ForegroundColor Green
Write-Host "プロジェクト '$ProjectName' の作成が完了しました！" -ForegroundColor Cyan
Write-Host "cd $ProjectName して作業を開始してください。" -ForegroundColor Yellow
