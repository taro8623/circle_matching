---
name: vibe-migrator
description: 他の AI ツール（Copilot CLI, Claude Engineer, Cursor 等）から開発のコンテキストや「ノリ」（スタイル・規約・進捗状況）を抽出し、Gemini CLI のメモリ（GEMINI.md 等）に移行するためのスキルです。
---

# vibe-migrator

このスキルは、以前使っていた AI 開発環境のコンテキストを Gemini CLI にスムーズに引き継ぐための手順を提供します。

## 移行のワークフロー

### 1. 情報源の特定
以下の場所から情報を収集します：
- **プロジェクトドキュメント**: `WAKE_UP.md`, `README.md`, `TODO.md` など。
- **他ツールの設定**: `.cursorrules`, `.clinerules`, `.claude/settings.local.json`, `.github/copilot-instructions.md` など。
- **既存のコード**: ファイル構造、命名規則（スネークケース vs キャメルケース）、テスト方針。
- **シェル履歴**: `gh copilot` などの使用履歴（可能であれば）。

### 2. コンテキストの抽出
収集した情報から以下の要素を抽出します：
- **プロジェクトの核心**: このアプリは何をするものか？（エレベーターピッチ）
- **技術スタックと制約**: FastAPI, PostgreSQL, Alembic などのバージョンや使い方。
- **コーディング規約**: 「コメントは日本語」「型ヒント必須」「ロジックは service 層に」など。
- **現在のフェーズ**: 次に何をすべきか、何が未実装か。
- **やり取りのスタイル**: 簡潔さを好むか、丁寧な解説を好むか。

### 3. メモリへの配置
抽出した情報を、適切な場所に配置します：

- **`GEMINI.md` (Project Shared)**: チーム全体で共有すべき規約、アーキテクチャの方針。
- **`MEMORY.md` (Private Project)**: ローカル環境の設定、DB 接続情報、個人的な TODO。
- **`~/.gemini/GEMINI.md` (Global Personal)**: 全プロジェクト共通の自分の好み（「日本語で返信して」など）。

## 実行方法

1.  `vibe-migrator` を起動し、プロジェクトスキャンを実行するよう指示してください。
2.  提示された「抽出結果」を確認し、修正や追加を行ってください。
3.  最終的な内容を `GEMINI.md` 等に書き込むよう指示してください。
