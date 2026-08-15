import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "使い方ガイド | EFK members",
  description: "EFK membersアプリの使い方をまとめたガイドです。",
};

// Static, hand-authored content (not user input) - dangerouslySetInnerHTML
// avoids a large, error-prone manual HTML-to-JSX conversion of this page.
const GUIDE_STYLE = `<style>
  /* ---------------------------------------------------------------
     Tokens
  --------------------------------------------------------------- */
  :root {
    --bg: #f5f8f6;
    --surface: #ffffff;
    --surface-2: #eef4f0;
    --border: #dde6e0;
    --ink: #16211b;
    --ink-soft: #52625a;
    --ink-faint: #8a978f;
    --accent: #059669;
    --accent-strong: #047857;
    --accent-soft: #e3f5ec;
    --top: #3b82f6;
    --top-soft: #eaf1fe;
    --satellite: #ef4444;
    --satellite-soft: #fdecec;
    --u18: #22c55e;
    --u18-soft: #eafbf0;
    --amber: #d97706;
    --amber-soft: #fdf2e0;
    --line-green: #06c755;
    --line-soft: #e5f9ee;
    --danger: #dc2626;
    --shadow: 0 1px 2px rgba(22, 33, 27, 0.04), 0 8px 24px -12px rgba(22, 33, 27, 0.12);
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #10160f;
      --surface: #182019;
      --surface-2: #1e2822;
      --border: #2c3830;
      --ink: #eaf3ee;
      --ink-soft: #a9bdb2;
      --ink-faint: #71847a;
      --accent: #34d399;
      --accent-strong: #6ee7b7;
      --accent-soft: #133226;
      --top: #7cabfb;
      --top-soft: #182236;
      --satellite: #f9a1a1;
      --satellite-soft: #2c1a1a;
      --u18: #6ee7a4;
      --u18-soft: #142a1e;
      --amber: #fbbf5c;
      --amber-soft: #2c2110;
      --line-green: #4fe39c;
      --line-soft: #12271c;
      --danger: #f3908c;
      --shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px -12px rgba(0, 0, 0, 0.5);
    }
  }

  :root[data-theme="dark"] {
    --bg: #10160f;
    --surface: #182019;
    --surface-2: #1e2822;
    --border: #2c3830;
    --ink: #eaf3ee;
    --ink-soft: #a9bdb2;
    --ink-faint: #71847a;
    --accent: #34d399;
    --accent-strong: #6ee7b7;
    --accent-soft: #133226;
    --top: #7cabfb;
    --top-soft: #182236;
    --satellite: #f9a1a1;
    --satellite-soft: #2c1a1a;
    --u18: #6ee7a4;
    --u18-soft: #142a1e;
    --amber: #fbbf5c;
    --amber-soft: #2c2110;
    --line-green: #4fe39c;
    --line-soft: #12271c;
    --danger: #f3908c;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px -12px rgba(0, 0, 0, 0.5);
  }

  /* ---------------------------------------------------------------
     Base
  --------------------------------------------------------------- */
  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic Medium",
      "Yu Gothic", "Noto Sans JP", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 15.5px;
    line-height: 1.8;
    -webkit-font-smoothing: antialiased;
  }

  a { color: var(--accent-strong); }
  a:focus-visible, button:focus-visible, summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 4px;
  }

  h1, h2, h3 { text-wrap: balance; margin: 0; }

  .wrap {
    max-width: 640px;
    margin: 0 auto;
    padding: 0 20px 64px;
  }

  /* ---------------------------------------------------------------
     Hero
  --------------------------------------------------------------- */
  .hero {
    background: linear-gradient(180deg, var(--accent-soft), var(--bg) 85%);
    border-bottom: 1px solid var(--border);
    padding: 36px 20px 28px;
  }

  .hero-inner {
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .crest {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .crest svg { width: 30px; height: 30px; }

  .eyebrow {
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--accent-strong);
  }

  .hero h1 {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .hero p {
    margin: 0;
    color: var(--ink-soft);
    font-size: 14.5px;
    max-width: 46ch;
  }

  /* ---------------------------------------------------------------
     Quick nav
  --------------------------------------------------------------- */
  .toc {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
  }

  .toc a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--ink);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    box-shadow: var(--shadow);
  }

  .toc a .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ---------------------------------------------------------------
     Sections
  --------------------------------------------------------------- */
  section.card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 22px 20px;
    margin-top: 18px;
    box-shadow: var(--shadow);
    scroll-margin-top: 16px;
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .icon-badge {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon-badge svg { width: 18px; height: 18px; }

  .card-head h2 {
    font-size: 18.5px;
    font-weight: 800;
  }

  .card p { margin: 10px 0; color: var(--ink); }
  .card p.lead { color: var(--ink-soft); font-size: 14px; margin-top: -6px; }

  .card h3 {
    font-size: 14.5px;
    font-weight: 700;
    margin: 20px 0 8px;
    color: var(--ink);
  }
  .card h3:first-of-type { margin-top: 4px; }

  ol.steps {
    margin: 8px 0;
    padding-left: 0;
    list-style: none;
    counter-reset: step;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  ol.steps li {
    counter-increment: step;
    display: flex;
    gap: 12px;
    align-items: baseline;
    font-size: 14.5px;
  }

  ol.steps li::before {
    content: counter(step);
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-size: 12px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    font-variant-numeric: tabular-nums;
  }

  ul.plain {
    margin: 8px 0;
    padding-left: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  ul.plain li {
    display: flex;
    gap: 10px;
    font-size: 14.5px;
    align-items: flex-start;
  }

  ul.plain li::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ink-faint);
    margin-top: 9px;
    flex-shrink: 0;
  }

  /* status pills matching the real app */
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12.5px;
    font-weight: 700;
  }
  .pill.top { background: var(--top-soft); color: var(--top); }
  .pill.satellite { background: var(--satellite-soft); color: var(--satellite); }
  .pill.u18 { background: var(--u18-soft); color: var(--u18); }
  .pill.amber { background: var(--amber-soft); color: var(--amber); }
  .pill.new { background: var(--satellite); color: #fff; }
  .pill.line { background: var(--line-soft); color: var(--line-green); }
  .pill.accent { background: var(--accent-soft); color: var(--accent-strong); }
  .pill.ghost { background: var(--surface-2); color: var(--ink-soft); }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin: 10px 0;
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--ink-soft);
  }
  .legend .swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  /* mock button used to illustrate real UI */
  .mock-btn {
    display: inline-block;
    padding: 6px 14px;
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    font-size: 13.5px;
    font-weight: 700;
  }
  .mock-btn.outline {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--ink);
  }
  .mock-btn.danger { background: var(--danger); }

  .callout {
    display: flex;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    margin: 14px 0;
    font-size: 13.8px;
    line-height: 1.7;
  }
  .callout.tip { background: var(--accent-soft); color: var(--ink); }
  .callout.warn { background: var(--amber-soft); color: var(--ink); }
  .callout strong { display: block; font-size: 12.5px; letter-spacing: 0.02em; margin-bottom: 2px; }
  .callout.tip strong { color: var(--accent-strong); }
  .callout.warn strong { color: var(--amber); }

  code {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 5px;
    font-size: 0.92em;
  }

  /* FAQ */
  details.faq {
    border-top: 1px solid var(--border);
    padding: 13px 0;
  }
  details.faq:first-of-type { border-top: none; padding-top: 4px; }
  details.faq summary {
    cursor: pointer;
    font-weight: 700;
    font-size: 14.5px;
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  details.faq summary::-webkit-details-marker { display: none; }
  details.faq summary .chevron {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    color: var(--ink-faint);
    transition: transform 0.15s ease;
  }
  details.faq[open] summary .chevron { transform: rotate(180deg); }
  details.faq .answer {
    margin-top: 10px;
    color: var(--ink-soft);
    font-size: 14px;
  }
  @media (prefers-reduced-motion: reduce) {
    details.faq summary .chevron { transition: none; }
  }

  footer {
    margin-top: 30px;
    padding-top: 18px;
    border-top: 1px solid var(--border);
    color: var(--ink-faint);
    font-size: 12.5px;
    text-align: center;
  }

  /* wide content safety */
  .card { overflow-x: hidden; }
</style>
`;

const GUIDE_BODY = `<div class="hero">
  <div class="hero-inner">
    <div style="display:flex; align-items:center; gap:14px;">
      <div class="crest" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9.5" stroke="var(--top)" stroke-width="1.6"/>
          <path d="M9 6.5 15 9 13.5 13.5 9.5 14 8 10Z" fill="var(--accent)" stroke="var(--accent-strong)" stroke-width="0.6"/>
        </svg>
      </div>
      <div>
        <div class="eyebrow">EFK MEMBERS</div>
        <h1>使い方ガイド</h1>
      </div>
    </div>
    <p>予定の確認・出欠回答・連絡のやり取りをこのアプリ1つでまとめています。ここでは基本的な使い方を、画面の流れに沿って説明します。</p>
    <nav class="toc" aria-label="目次">
      <a href="#start"><span class="dot" style="background:var(--accent)"></span>はじめに</a>
      <a href="#home"><span class="dot" style="background:var(--accent)"></span>ホーム画面</a>
      <a href="#schedule"><span class="dot" style="background:var(--top)"></span>スケジュール</a>
      <a href="#messages"><span class="dot" style="background:var(--satellite)"></span>メッセージ</a>
      <a href="#notify"><span class="dot" style="background:var(--amber)"></span>通知設定</a>
      <a href="#card"><span class="dot" style="background:var(--u18)"></span>選手証</a>
      <a href="#apps"><span class="dot" style="background:var(--ink-faint)"></span>関連アプリ</a>
      <a href="#faq"><span class="dot" style="background:var(--ink-faint)"></span>よくある質問</a>
    </nav>
  </div>
</div>

<div class="wrap">

  <section class="card" id="start">
    <div class="card-head">
      <div class="icon-badge" style="background:var(--accent-soft)">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-strong)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6a2 2 0 0 1 2-2h8l6 6v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/>
          <path d="M14 4v6h6"/>
        </svg>
      </div>
      <h2>はじめに</h2>
    </div>
    <p class="lead">EFK membersは、チームの予定・出欠・連絡をまとめて管理するアプリです。全員がスマホから同じ情報を見られるようにするためのものです。</p>

    <h3>ログイン</h3>
    <p>チームから伝えられたメールアドレスとパスワードでログインします。一度ログインすれば、そのあとは基本的に自動的にログインしたままになるので、毎回入力する必要はありません。</p>
    <div class="callout tip">
      <div>
        <strong>ホーム画面に追加すると便利</strong>
        ブラウザの共有メニューから「ホーム画面に追加」しておくと、アイコンをタップするだけでアプリのようにすぐ開けます。
      </div>
    </div>
  </section>

  <section class="card" id="home">
    <div class="card-head">
      <div class="icon-badge" style="background:var(--accent-soft)">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-strong)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 11 12 4l8 7"/>
          <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/>
        </svg>
      </div>
      <h2>ホーム画面</h2>
    </div>
    <p class="lead">ログイン後に最初に開く画面です。自分の情報と、直近の予定・メッセージがひと目で確認できます。</p>

    <h3>マイプロフィール</h3>
    <ul class="plain">
      <li>選手証の画像（管理者がアップロードすると自動で表示されます）</li>
      <li>名前・メールアドレス・背番号・カテゴリー・出席率</li>
      <li>名前・メールアドレス・背番号は「プロフィールを編集」からいつでも自分で変更できます</li>
      <li>ウェアサイズ（シャツ・パンツ・ジャージ）はここからいつでも変更できます</li>
    </ul>

    <h3>今後の予定・メッセージ</h3>
    <p>直近の予定と、チャンネルの一覧がカードで並びます。新着があるものには <span class="pill new">NEW</span> の印が付き、その一覧の画面を開くと消えます。</p>
  </section>

  <section class="card" id="schedule">
    <div class="card-head">
      <div class="icon-badge" style="background:var(--top-soft)">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--top)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="5.5" width="16" height="14.5" rx="2"/>
          <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5"/>
        </svg>
      </div>
      <h2>スケジュール</h2>
    </div>
    <p class="lead">練習・試合の予定をカレンダーで確認し、出欠を回答できます。</p>

    <h3>カレンダーの色分け</h3>
    <div class="legend">
      <span><span class="swatch" style="background:var(--top)"></span>トップ</span>
      <span><span class="swatch" style="background:var(--satellite)"></span>サテライト</span>
      <span><span class="swatch" style="background:var(--u18)"></span>U18</span>
      <span><span class="swatch" style="background:var(--amber)"></span>●未回答</span>
      <span><span class="swatch" style="background:var(--satellite)"></span>●新着</span>
    </div>
    <p>自分のカテゴリー以外の予定も見ることはできますが、回答できるのは対象カテゴリーの予定だけです。上部メニューの「スケジュール」に付く赤い丸は、対象カテゴリーの予定に未回答のものがある間だけ表示され、すべて回答すると消えます。</p>
    <p style="font-size:13.5px; color:var(--ink-soft)">保護者アカウントはログイン後、最初にこのスケジュール画面が開きます。お子さんの所属カテゴリーはマイページから登録・変更でき、カレンダーの色分け表示がお子さんのカテゴリー優先になります（出欠の回答はできません）。</p>

    <h3>出欠の回答</h3>
    <p>予定をタップすると詳細が開きます。4つのボタンから選んで回答してください。</p>
    <div class="legend">
      <span class="pill accent">出席</span>
      <span class="pill ghost">試合のみ</span>
      <span class="pill ghost">欠席</span>
      <span class="pill ghost">未定</span>
    </div>
    <p style="font-size:13.5px; color:var(--ink-soft)">「試合のみ」は、練習には来られないが試合の時間だけ参加する場合に選びます。回答はあとから何度でも変更できます。</p>

    <h3>持ち物・メモ</h3>
    <p>予定に備考（持ち物やメモ）が書かれていることがあります。予定を開いた画面の下の方に表示されます。</p>
  </section>

  <section class="card" id="messages">
    <div class="card-head">
      <div class="icon-badge" style="background:var(--satellite-soft)">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--satellite)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 5.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4H5.5A1.5 1.5 0 0 1 4 14.5Z"/>
        </svg>
      </div>
      <h2>メッセージ</h2>
    </div>
    <p class="lead">チャンネルごとにやり取りができます。トップ・サテライト・U18・全体はあらかじめ用意されていて、それぞれ対象のメンバーだけが見られます。（保護者アカウントにはメッセージ機能はありません）</p>

    <h3>@メンションで通知</h3>
    <p>誰かに直接伝えたい時は、本文に <code>@名前</code> を入れてメンションします。入力欄の左にある「@」ボタンをタップすると、名前を打たなくても一覧からワンタップで挿入できます。<code>@全員</code>と入力すると、チャンネル全員にメンションできます。</p>
    <div class="callout tip">
      <div>
        <strong>通知が届くのはメンションされた人だけ</strong>
        雑談などメンションのない普通のメッセージには通知が飛びません。誰かに読んでほしい時は、必ず@で名前を指定してください。
      </div>
    </div>

    <h3>投稿の取消</h3>
    <p>自分が投稿したメッセージには「取消」が表示され、いつでも削除できます。</p>
  </section>

  <section class="card" id="notify">
    <div class="card-head">
      <div class="icon-badge" style="background:var(--amber-soft)">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 10a6 6 0 1 1 12 0c0 3.5 1.2 5 1.8 5.5H4.2C4.8 15 6 13.5 6 10Z"/>
          <path d="M10 18.5a2 2 0 0 0 4 0"/>
        </svg>
      </div>
      <h2>通知設定</h2>
    </div>
    <p class="lead">新しい予定の作成や、自分へのメンションがあった時に知らせてもらう方法を、ホーム画面から3つの中から選べます。それぞれ別々にON/OFFできます。</p>

    <ul class="plain">
      <li><strong>メール</strong> — 「新しい予定・自分宛のメンションをメールで通知する」のチェックボックス。初期状態でONになっています。</li>
      <li><strong>プッシュ通知</strong> — 「この端末でプッシュ通知を受け取る」のチェックボックス。ブラウザの通知を許可するだけで、この端末（この画面を見ているスマホ）に通知が届きます。</li>
      <li><strong>LINE通知　<span class="pill line">LINE</span></strong> — EFKのLINE公式アカウントを友だち追加して、マイページに表示されるコードをトークで送るだけで連携できます。</li>
    </ul>

    <div class="callout warn">
      <div>
        <strong>iPhoneでプッシュ通知を使う場合</strong>
        iPhoneのSafariでこのアプリを開いただけでは、プッシュ通知は届きません。以下の手順が必要です。
      </div>
    </div>
    <ol class="steps">
      <li>iOSが16.4以降であることを確認する</li>
      <li>Safariで開いた状態で、共有ボタン →「ホーム画面に追加」</li>
      <li>ホーム画面に追加されたアイコンから開き直し、その状態でマイページの「この端末でプッシュ通知を受け取る」をON</li>
    </ol>
  </section>

  <section class="card" id="card">
    <div class="card-head">
      <div class="icon-badge" style="background:var(--u18-soft)">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--u18)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3.5" y="6" width="17" height="12" rx="2"/>
          <circle cx="8.5" cy="11.3" r="1.6"/>
          <path d="M6 15.5c.6-1.4 1.7-2.1 2.5-2.1s1.9.7 2.5 2.1M14 10h4M14 13h4"/>
        </svg>
      </div>
      <h2>選手証</h2>
    </div>
    <p class="lead">管理者がJFAの名簿をアップロードすると、名前で自動的に照合されて、ホーム画面に選手証の写真が表示されるようになります。自分で何か操作する必要はありません。まだ表示されていない場合は、管理者にご確認ください。</p>
  </section>

  <section class="card" id="apps">
    <div class="card-head">
      <div class="icon-badge" style="background:var(--surface-2)">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9.5 14.5 14.5 9.5"/>
          <path d="M11 7.5 12.3 6.2a3 3 0 0 1 4.2 4.2L15.2 11.7M13 16.5 11.7 17.8a3 3 0 0 1-4.2-4.2L8.8 12.3"/>
        </svg>
      </div>
      <h2>関連アプリ</h2>
    </div>
    <p class="lead">ホーム画面の一番下「EFKアプリ」から、チームで使っている他のツールにも移動できます。</p>
    <ul class="plain">
      <li><strong>EFKtac</strong> — 戦術ボード</li>
      <li><strong>EFKtime</strong> — タイマー&amp;スコア</li>
      <li><strong>TACview</strong> — 戦術動画。招待コードの入力を求められた場合は、管理者から共有されたコードを使ってください。</li>
    </ul>
    <p style="font-size:13.5px; color:var(--ink-soft)">いずれも別タブで開きます。</p>
  </section>

  <section class="card" id="faq">
    <div class="card-head">
      <div class="icon-badge" style="background:var(--surface-2)">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="8.5"/>
          <path d="M9.8 9.5a2.2 2.2 0 1 1 3.1 2c-.9.5-1.4 1-1.4 2"/>
          <circle cx="12" cy="16.3" r="0.15" fill="var(--ink-soft)" stroke-width="1.4"/>
        </svg>
      </div>
      <h2>よくある質問</h2>
    </div>

    <details class="faq">
      <summary>ログインできない<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></summary>
      <div class="answer">メールアドレスとパスワードを確認してください。パスワードを忘れてしまった場合は、ご自身では再発行できないため、管理者に伝えてアカウントを確認してもらってください。</div>
    </details>

    <details class="faq">
      <summary>通知が来ない<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></summary>
      <div class="answer">まずホーム画面で該当の通知（メール/プッシュ/LINE）がONになっているか確認してください。メッセージの通知は「@メンション」された時にしか届かない仕様なので、メンションなしの投稿では届きません。iPhoneでプッシュ通知が届かない場合は、上の「通知設定」にある手順（ホーム画面への追加が必須）を確認してください。</div>
    </details>

    <details class="faq">
      <summary>スケジュールがGoogleカレンダーのスマホアプリに出てこない<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></summary>
      <div class="answer">Google連携は管理者のみが発行できる機能です。ブラウザ側で登録できていても、スマホの純正カレンダーアプリへの反映には数時間かかることがあります。反映後も出てこない場合は、アプリの「設定」内のアカウント一覧に登録されているのに表示だけがOFFになっているケースが多いので、そこを確認してみてください。</div>
    </details>

    <details class="faq">
      <summary>予定に回答したのに未回答のマークが消えない<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></summary>
      <div class="answer">画面を開き直す（再読み込みする）と反映されることがあります。それでも直らない場合は管理者に連絡してください。</div>
    </details>
  </section>

  <footer>EFK members 使い方ガイド</footer>
</div>
`;

export default function GuidePage() {
  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: GUIDE_STYLE }} />
      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: GUIDE_BODY }} />
    </>
  );
}
