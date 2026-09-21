# ブラウザ操作AIへの引き継ぎ指示書

このファイルは、**PCのブラウザを操作できるAI**（Claude デスクトップのコンピュータ操作 /
Claude in Chrome / ChatGPT のブラウザ機能など）に、そのまま貼って渡すための指示文です。

Claude Code（クラウド実行）側はブラウザを操作できないため、ブラウザが必要な工程だけを
ここに切り出しています。**人間（つるさん）にお願いするのは最終クリックと本人認証だけ**に
なるよう書いてあります。

---

## ▼ ここから下をコピーして、ブラウザ操作AIに渡してください ▼

あなたはPCのブラウザを操作できるAIです。以下の作業を実行してください。

### 絶対に守ること

1. **対象は `efk-camera` という新規リポジトリの作成だけです。**
   既存のリポジトリ・設定・Secrets・GitHub Actions には**一切触れないでください**。
   （既存: cloudcode / tac-view / efk-futsal-timer / efk-instagram-kpi /
   efk-instagram-analytics / instagram-automation / SNS-AI-IMAGE-PIPELINE /
   ouchi-shuno-analytics）
2. **「Create repository」ボタンは、あなたは押さないでください。**
   入力を完了し、内容を確認したら、**押す直前で停止**して人間に最終クリックを依頼します。
3. ログイン・2段階認証が求められたら、そこで停止して人間に依頼してください。
   **パスワードや認証コードを自分で入力しようとしないでください。**
4. 実行できなかった操作を「実行した」と報告しないでください。
   途中で想定と違う画面になったら、そこで止めて、何が起きたかをそのまま報告してください。

### 手順A：リポジトリ作成フォームの入力

1. ブラウザで `https://github.com/new` を開く
2. ログイン済みであること、アカウントが **`nasimentozisan-svg`** であることを確認する
   - 別アカウントだった場合は、そこで停止して人間に報告する
3. フォームに次のとおり入力・選択する

   | 項目 | 設定する値 |
   |---|---|
   | Owner | `nasimentozisan-svg` |
   | Repository name | `efk-camera` （半角小文字、ハイフン1つ、前後に空白を入れない） |
   | Description | 空欄のままで可。入れるなら `EFK CAMERA - エンフレンテ熊本フットサルクラブ専用 固定カメラ撮影アプリ` |
   | 公開設定 | **Private** を選択（Public のままにしない） |

4. 「Initialize this repository with:」の項目は、**3つとも初期状態（追加しない）のまま**にする

   | 項目 | あるべき状態 |
   |---|---|
   | Add a README file | チェックを**入れない** |
   | Add .gitignore | `None`（何も選ばない） |
   | Choose a license | `None`（何も選ばない） |

   > ここが最重要です。1つでも追加すると、空でないリポジトリができてしまい、
   > このあとの Claude Code からの push が失敗します。

5. 入力後、**画面のスクリーンショットを撮り、上の表と1項目ずつ突き合わせて自己確認**する
6. **ここで停止する。「Create repository」は押さない。**
7. 人間に次のように依頼する

   > 入力が完了しました。内容を確認のうえ、画面下部の緑色の
   > 「Create repository」ボタンを押してください。

### 手順Aの成否判定

人間がクリックしたあと、`https://github.com/nasimentozisan-svg/efk-camera` を開いて確認する。

| 見えているもの | 判定 |
|---|---|
| 「Quick setup — if you've done this kind of thing before」という**空のリポジトリの画面** | ✅ 成功 |
| ファイル一覧に `README.md` などが**すでに存在する** | ❌ 失敗（手順A-4のチェックを外し忘れ）。**自分で削除や修正をせず**、そのまま報告する |
| 404 / Not Found | ❌ 作成されていない、または別アカウント。そのまま報告する |

画面右上に **Private** のバッジが付いていることも確認する。
Public になっていたら報告する（設定変更は行わない）。

### 手順Aの報告フォーマット

作業が終わったら、次の形式でそのまま報告してください。

```
[手順A 結果]
アカウント: nasimentozisan-svg かどうか → (はい / いいえ:実際の値)
リポジトリURL: https://github.com/nasimentozisan-svg/efk-camera
作成: (成功 / 失敗)
公開設定: (Private / Public)
初期ファイル: (無し / あり:ファイル名)
気づいたこと: (あれば)
```

---

### 手順B：作成後のセキュリティ設定

**手順Bは、Claude Code から「コードを push した」と連絡が来てから実行してください。**
まだの場合はここで待機します。

#### B-1. Secret scanning と Push protection を有効化

1. `https://github.com/nasimentozisan-svg/efk-camera/settings/security_analysis` を開く
2. **Secret Protection**（または Secret scanning）の **Enable** を押す
3. **Push protection** の **Enable** を押す
4. 有効化後のスクリーンショットを撮る

> これは秘密情報を含む push をGitHub側で弾く設定です。既存リポジトリには影響しません。

#### B-2. main ブランチの保護

**Claude Code から「CIが1回完走した」と連絡が来てから**実行してください。
（CIが一度も走っていないと、必須にするチェック名が選択肢に出てきません）

1. `https://github.com/nasimentozisan-svg/efk-camera/settings/rules/new` を開く
   （または Settings → Rules → Rulesets → New branch ruleset）
2. 次のとおり設定する

   | 項目 | 設定する値 |
   |---|---|
   | Ruleset Name | `protect-main` |
   | Enforcement status | **Active** |
   | Target branches | **Add target → Include default branch**（= `main`） |

3. Rules のチェックボックスで、次の3つを **オン**にする
   - **Require a pull request before merging**
   - **Require status checks to pass**
   - **Block force pushes**

4. 「Require status checks to pass」の中の **Add checks** を押し、次の2つを追加する
   - `Secret 混入チェック`
   - `ビルド / テスト / Lint`

   > 検索しても出てこない場合は、CIがまだ完走していません。
   > **その場合は追加せずに停止し、その旨を報告してください。**

5. 画面下の **Create**（または Save changes）を押す直前で**停止**し、
   人間に最終クリックを依頼する

#### 手順Bの報告フォーマット

```
[手順B 結果]
Secret scanning: (有効 / 未実施 / 失敗:理由)
Push protection: (有効 / 未実施 / 失敗:理由)
ブランチ保護: (作成済み / 未実施 / 失敗:理由)
必須チェックに追加できたもの: (チェック名 / 追加できず:理由)
気づいたこと: (あれば)
```

---

## ▲ ここまでをコピーして渡してください ▲

---

## Claude Code 側（このリポジトリの開発担当）が、引き継ぎ後にやること

手順Aの完了報告を受け取ったら、以降は自動で進みます。

1. 新リポジトリをセッションに接続する
2. Secrets チェックを通す
3. 全ファイルを `main` へ push する
4. CI（Android CI）の結果を確認する
5. 失敗していれば原因を調べて直し、緑になるまで繰り返す
6. CI が完走したら、手順B-2を実行してよい旨を連絡する

## なぜこの分担なのか

| 作業 | 担当 | 理由 |
|---|---|---|
| コード作成・修正・テスト・push・CI対応 | Claude Code | APIで実行できる |
| リポジトリ作成フォームの入力 | ブラウザ操作AI | GitHub App にリポジトリ作成権限（Administration）が無く、APIでは `403` |
| ブランチ保護・Secret scanning の設定 | ブラウザ操作AI | 同上（設定系のAPIツールが無い） |
| **最終クリック・本人認証** | **つるさん** | 不可逆操作の承認と本人確認は人間にしかできない |
