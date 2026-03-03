---
name: create-project
description: 新しいRemotionプロジェクトをテンプレートから作成し、初期設定を行います
---

# Create Project Skill

このスキルは、`template-project` を元に、新しいRemotionプロジェクトを指定された名前で作成し、必要な初期設定（`package.json` の更新や、共有スキル向けJunctionリンクの再構築）を自動で実施する機能です。

## 使用方法

ユーザーから「〇〇という名前のプロジェクトを作成して」と依頼された場合、以下のスクリプトに引数を渡して実行してください。

```powershell
a:\SlideShow\_shared\skills\.gemini\skills\create-project\scripts\create-project.ps1 -ProjectName "<NewProjectName>"
```

### 動作内容:
1. 指定されたプロジェクト名が既に存在しないかをチェックします。
2. `a:\SlideShow\template-project` を `a:\SlideShow\<NewProjectName>` へコピーします。
3. コピーされたフォルダ内の `package.json` にある `name` フィールドを `<NewProjectName>` に書き換えます。
4. プロジェクト内の `.claude`, `.gemini`, `.github` に対して、実体のコピーを削除の上、`a:\SlideShow\_shared\skills\` を向くJunctionリンクを再構築します。

## 留意点
- 環境はWindows（PowerShell）を前提とします。
- 作業ルートは `a:\SlideShow` に固定されています。もし環境が変わった場合はスクリプト内のパスも修正してください。
