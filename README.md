# もしもコミュニティ — Web版プロトタイプ

「もしもカード」とは別アプリ。みんなで**自作のお題・仮ANSWER・名回答／プレイ結果**を投稿し合い、
他の人の投稿を見て、気になったお題はその場で遊べる（15分タイマー）コミュニティ。

- フロント：サーバー不要の単一HTML（`index.html`）
- バックエンド：Google スプレッドシート ＋ Apps Script（`Code.gs`）
- `CONFIG.GAS_URL` を設定するまでは**デモモード**（この端末の localStorage だけに保存）で動く

## できること（動くプロトタイプの範囲）

| 画面 | 内容 |
|---|---|
| はじめて画面 | 初回起動時のみ表示。「使い方を聞く／聞かずに始める」。聞くと5枚のチュートリアル |
| フィード | 投稿一覧。種類で絞り込み（すべて／お題／仮ANSWERつき／名回答・プレイ結果）、♥いいね、更新。ヘッダーの「使い方」でチュートリアルを再表示 |
| 詳細 | 1件の全文。お題系は「このお題で遊ぶ」ボタン |
| 投稿 | 種類を選んで投稿（右下「＋ 投稿」）。お題／お題＋仮ANSWER／名回答・プレイ結果でフォームが変わる |
| 遊ぶ | コミュニティのお題を Q＋条件＋15分タイマーで。仮ANSWER付きなら終了後に開ける |
| 管理者モード | 合言葉を知っている人だけ。全投稿の編集・削除ができる |

いいねの重複は端末単位で防止（`moshimoshi-community/liked`）。
チュートリアルを見たかどうかは `moshimoshi-community/onboarded` で記録（消すと初回画面が再表示）。

## 管理者モード

- **入り方**：フィード画面のタイトル「もしもコミュニティ」を**すばやく5回タップ** → 合言葉を入力
- **できること**：各カード／詳細に「編集」「削除」ボタンが出る。編集は投稿フォームを再利用（種類は変更不可）
- **合言葉の設定**：
  - デモモード（`CONFIG.GAS_URL` 空）：`CONFIG.ADMIN_KEY` が空なら何を入れても通る。値を入れるとその文字列のみ通る
  - GAS 接続時：GAS の **スクリプトプロパティ `ADMIN_KEY`** が本当の鍵。同じ値を `CONFIG.ADMIN_KEY` にも入れる（クライアント側はUI表示の切り替え用、実際の書き込み許可はサーバーが判定）
- ログイン状態は `sessionStorage`（タブを閉じると解除）。上部バーの「終了」でも解除
- ⚠ `CONFIG.ADMIN_KEY` は公開HTMLに載るため、厳密な秘匿にはなりません。真に守りたい場合は `CONFIG.ADMIN_KEY` を空のままにし、GAS のスクリプトプロパティのみで運用してください（毎回サーバー確認が入ります）

## アクセス解析（Google Analytics 4）

- `CONFIG.GA4_ID` に測定ID（`G-XXXXXXXXXX`）を入れると gtag.js を自動読み込み。空なら何も送信しない
- 送信しているイベント：`tutorial_start` / `tutorial_complete` / `tutorial_skip` / `filter_change` / `open_post` / `post_like` / `play_start` / `post_create` / `post_edit` / `post_delete` / `admin_login`
- ボタンごとの回数を増やしたい場合は、該当の click ハンドラに `track("イベント名", { 任意パラメータ })` を1行足すだけ

## 初期データ

`index.html` 内の `CARD_TOPICS`（配列）に「もしもカード」収録の**51問**が入っており、
起動時に `type: "topic_answer"` の投稿としてフィードに並びます（投稿者名は「もしもカード」）。
別途「名回答・プレイ結果」のサンプルが2件。お題を増やすときは `CARD_TOPICS` に `{ q, c:[...], a }` を足すだけ。

- GAS を接続すると、この51問はローカル表示のみ（シートには入りません）。シートにも入れたい場合は、
  一度アプリから投稿し直すか、`posts` シートに直接行を追加してください。

## デモモードで試す

`index.html` をブラウザで開くだけ。上記51問＋サンプル投稿入り。ローカルで確認する場合：

```bash
cd moshimoshi-community && python3 -m http.server 5196
```

→ http://localhost:5196

## みんなで共有する（Google スプレッドシート + GAS）

過去の「アンケート → GAS」と同じ構成。無料。

1. Google スプレッドシートを新規作成
2. **拡張機能 → Apps Script** を開く
3. `Code.gs` の中身を全部貼り付けて保存
4. **デプロイ → 新しいデプロイ → 種類「ウェブアプリ」**
   - 実行するユーザー：**自分**
   - アクセスできるユーザー：**全員**
5. 発行された **ウェブアプリ URL** をコピー
6. `index.html` の先頭の `CONFIG.GAS_URL` に貼る：

```js
const CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/XXXXXXXX/exec"
};
```

7. `index.html` を配布（GitHub Pages / Netlify / 直接共有など）

`posts` シートは初回アクセス時に見出し行つきで自動生成されます。
運営はスプレッドシート上で投稿の編集・削除・並べ替えができます（`likes` 列も直接いじれる）。

### データ構造（posts シート）

| 列 | 内容 |
|---|---|
| id | UUID（自動） |
| createdAt | 投稿時刻（ミリ秒, 自動） |
| type | `topic` / `topic_answer` / `report` |
| question | お題文 |
| conditions | 条件（JSON配列文字列） |
| modelAnswer | 仮ANSWER |
| title | 名回答・プレイ結果のタイトル |
| body | 名回答・プレイ結果の本文 |
| nickname | 投稿者名 |
| likes | いいね数 |

## 通信の仕組み（実装メモ）

- 一覧：`GET {GAS_URL}?action=list` → `{ posts: [...] }`
- 投稿：`POST {GAS_URL}` body `{"action":"create","post":{...}}`
- いいね：`POST {GAS_URL}` body `{"action":"like","id":"..."}`
- POST は `Content-Type` を付けない（text/plain 扱い）ことで CORS プリフライトを回避
- 同時書き込みは GAS 側の `LockService` で直列化

## 今後の拡張（未実装）

- 友達を招いて**オンラインで一緒に遊ぶ**（複数端末リアルタイム同期）→ GAS では厳しいので Firebase/Supabase へ
- 投稿の通報・モデレーション、NGワード
- お題の「殿堂入り」→ もしもカード本体のカードプールへ取り込み
- ログイン（今は端末＋ニックネームのみ）
