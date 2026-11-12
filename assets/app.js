/**
 * Duel Data Dashboard
 *
 * デュエルリンクスのランク戦の戦績を記録・可視化し、勝率を Deck / Tech / Luck に
 * 要因分解するシングルページアプリ。ビルド不要・依存ライブラリなし。
 *
 * データはブラウザの localStorage に保存する。Chrome / Edge（PC）では
 * File System Access API で任意の JSON ファイルへの自動保存にも対応する。
 *
 * 構成（上から順に）:
 *   定数・ユーティリティ / 初期データ / 状態 / 保存（localStorage・ファイル） /
 *   集計ヘルパー / ヘッダー / 入力フォーム / 戦績一覧 / 推移（DP・MACD・BB・連続プレイ） /
 *   環境 / DTL 要因分解 / 設定 / サンプルデータ / ルーティング
 */
(function () {
  "use strict";

  /* ---------- 読み込みの確認 ---------- */
  // index.html と app.js の版が食い違う（片方だけ古いキャッシュが残っている等）と動かないため、先に確認する
  const REQUIRED_IDS = [
    "benchAdd",
    "benchSave",
    "benchTable",
    "btnCancel",
    "btnDel",
    "btnSave",
    "charAdd",
    "charBulkAdd",
    "charListEd",
    "charReset",
    "deckAdd",
    "deckList",
    "demoBtn",
    "expCsv",
    "expJson",
    "filePick",
    "fileRestore",
    "fileResume",
    "histSub",
    "histTable",
    "impFile",
    "moreRecent",
    "myDeck",
    "myVer",
    "newMyAdd",
    "newMyCancel",
    "newVerAdd",
    "newVerCancel",
    "oddsAxis",
    "oddsOut",
    "oppAdd",
    "oppChips",
    "oppEdit",
    "playerTable",
    "rankBandIn",
    "rankPresets",
    "recent",
    "segFirst",
    "segWin",
    "targetIn",
    "tgBrick",
    "tgBuild",
    "tgMiss",
    "tgOppBrick",
    "tsNow",
    "verListEd",
    "wipeBtn",
  ];
  const missing = REQUIRED_IDS.filter((id) => !document.getElementById(id));
  if (missing.length) {
    const box = document.createElement("div");
    box.setAttribute("role", "alert");
    box.style.cssText =
      "margin:16px;padding:12px 14px;border:1px solid #c0392b;border-radius:10px;background:#fdecea;color:#5a1a14;font:14px/1.6 sans-serif";
    box.textContent =
      "ページのファイルの版が食い違っているため、正しく表示できません。数分待ってから、再読み込み（PCは Shift＋再読み込み）してください。直らない場合は、index.html と assets フォルダの両方を最新版に差し替えてください。（不足：" +
      missing.join(", ") +
      "）";
    document.body.prepend(box);
    return;
  }

  /* ---------- 定数・ユーティリティ ---------- */
  const HOUR = 3600e3;
  const STORAGE_KEY = "ddd-data-v1";
  const LEGACY_STORAGE_KEY = "dl-record-v1";
  const BACKUP_KEY = "ddd-last-backup";
  const DEFAULT_DP_CHANGE = 1000;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const pct = (x, d = 1) =>
    x == null || !isFinite(x) ? "–" : (x * 100).toFixed(d) + "%";
  const sgn = (x, d = 2) =>
    x == null || !isFinite(x)
      ? "–"
      : (+(x * 100).toFixed(d) >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(d);
  const fmtPt = (x) =>
    (x > 0 ? "+" : x < 0 ? "−" : "±") + Math.abs(x).toLocaleString("ja-JP");
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const toLocalInput = (ts) => {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const buildTag = (v) => {
    v = Number(v) || 0;
    return v > 0 ? "構築○" : v < 0 ? "構築×" : "";
  };
  const fmtT = (ts) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const onEnter = (el, fn) =>
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        fn();
      }
    });
  /* ---------- 初期データ ---------- */
  const DEFAULT_CHARS = [
    "闇遊戯",
    "武藤遊戯",
    "海馬瀬人",
    "城之内克也",
    "真崎杏子",
    "本田ヒロト",
    "孔雀舞",
    "ペガサス",
    "インセクター羽蛾",
    "ダイナソー竜崎",
    "獏良了",
    "闇バクラ",
    "マリク",
    "闇マリク",
    "イシズ",
    "リシド",
    "海馬モクバ",
    "梶木漁太",
    "ゴースト骨塚",
    "パンドラ",
    "レアハンター",
    "遊城十代",
    "万丈目準",
    "天上院明日香",
    "丸藤翔",
    "丸藤亮",
    "三沢大地",
    "ティラノ剣山",
    "エド・フェニックス",
    "ヨハン",
    "ユベル",
    "クロノス",
    "天上院吹雪",
    "不動遊星",
    "ジャック・アトラス",
    "クロウ",
    "十六夜アキ",
    "龍亞",
    "龍可",
    "鬼柳京介",
    "九十九遊馬",
    "神代凌牙",
    "天城カイト",
    "榊遊矢",
    "赤馬零児",
    "柊柚子",
    "藤木遊作",
    "リボルバー",
  ];
  const BAKED = {
    decks: [
      "メメント",
      "氷水",
      "黒魔導",
      "ホルス",
      "スターダスト",
      "センチュリオン",
      "E・HERO",
      "烙印",
      "サイバー",
    ],
    chars: [
      "ヘルカイザー亮",
      "カイザー亮 as",
      "武藤遊戯 as",
      "武藤遊戯",
      "闇バクラ as",
      "闇遊戯 as",
      "闇遊戯",
      "不動遊星",
      "不動遊星 as",
      "闇バクラ",
      "遊城十代/ユベル",
      "遊城十代/ユベル as",
      "十六夜アキ as",
      "ブルーメイデン & アクア",
      "鬼柳京介",
      "DS鬼柳京介",
      "鬼柳京介 as",
      "クロウ・ホーガン as",
      "クロウ・ホーガン",
      "海馬モクバ",
      "エド・フェニックス",
      "十六夜アキ",
      "ジャック・アトラス",
      "城之内克也 as",
      "海馬瀬人 as",
      "リボルバー",
      "海馬瀬人",
      "城之内克也",
      "真崎杏子",
      "本田ヒロト",
      "孔雀舞",
      "ペガサス",
      "インセクター羽蛾",
      "ダイナソー竜崎",
      "マリク",
      "闇マリク",
      "イシズ",
      "リシド",
      "梶木漁太",
      "ゴースト骨塚",
      "パンドラ",
      "遊城十代",
      "万丈目準",
      "天上院明日香",
      "丸藤翔",
      "三沢大地",
      "ティラノ剣山",
      "ヨハン",
      "ユベル",
      "クロノス",
      "龍亞",
      "龍可",
      "九十九遊馬 & アストラル",
      "神代凌牙",
      "天城カイト",
      "榊遊矢",
      "赤馬零児",
      "柊柚子",
      "沢渡シンゴ",
      "獏良了DSOD",
      "Play maker & Ai",
      "財前晃",
    ],
    env: {
      rows: {
        ホルス: { b: 11.3, omega: 44.2 },
        メメント: { b: 40.1, omega: 53.6 },
        氷水: { b: 16.4, omega: 50 },
        烙印: { b: 6.4, omega: 35.9 },
        黒魔導: { b: 5.3, omega: 56.3 },
      },
    },
    bench: {
      ホルス: {
        rows: {
          ホルス: { q: 50 },
          メメント: { q: 40.5 },
          氷水: { q: 55.6 },
          烙印: { q: 30 },
          黒魔導: { q: 60 },
        },
      },
      メメント: {
        rows: {
          メメント: { q: 50 },
          氷水: { q: 51.9 },
          ホルス: { q: 59.5 },
          黒魔導: { q: 45.5 },
          烙印: { q: 73.7 },
        },
      },
      氷水: {
        rows: {
          メメント: { q: 48.1 },
          氷水: { q: 50 },
          ホルス: { q: 44.4 },
          黒魔導: { q: 33.3 },
          烙印: { q: 85.7 },
        },
      },
      黒魔導: {
        rows: {
          メメント: { q: 54.5 },
          氷水: { q: 66.7 },
          ホルス: { q: 40 },
          黒魔導: { q: 50 },
          烙印: { q: 100 },
        },
      },
      烙印: {
        rows: {
          メメント: { q: 26.3 },
          氷水: { q: 14.3 },
          ホルス: { q: 70 },
          黒魔導: { q: 0 },
          烙印: { q: 50 },
        },
      },
    },
  };
  const defCfg = () =>
    Object.assign(
      {
        decks: [],
        myDeck: "",
        bench: {},
        env: null,
        chars: DEFAULT_CHARS.slice(),
      },
      JSON.parse(JSON.stringify(BAKED)),
    );

  /* ---------- 状態 ---------- */
  // REAL: 保存される本来のデータ / DEMO: 「サンプルデータで試す」用の一時データ（保存しない）
  let REAL = { matches: [], cfg: defCfg() },
    DEMO = null;
  const D = () => DEMO || REAL;
  const UI = { view: "input", scope: "deck", range: "all", recentN: 8 };
  const F = {
    id: null,
    opp: "",
    first: null,
    win: null,
    brick: false,
    oppBrick: false,
    miss: false,
    build: 0,
    note: "",
  };

  /* ---------- 保存（localStorage） ---------- */
  function lsLoad() {
    try {
      // 旧版（保存キー "dl-record-v1"）の記録があれば引き継ぐ
      const raw =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem(LEGACY_STORAGE_KEY);
      const r = JSON.parse(raw || "null");
      if (r) {
        REAL.matches = r.matches || [];
        REAL.cfg = Object.assign(defCfg(), r.cfg || {});
        // 初期データにあって、まだ持っていないデッキのベンチマークだけを補う（自分の入力は上書きしない）
        REAL.cfg.bench = Object.assign(
          {},
          JSON.parse(JSON.stringify(BAKED.bench)),
          REAL.cfg.bench,
        );
      }
    } catch (e) {}
  }
  function lsSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(REAL));
    } catch (e) {
      toast("この端末に保存できませんでした");
    }
    fileQueue();
  }
  /* ---------- 保存（端末のファイルへの自動保存：Chrome / Edge）・永続化 ---------- */
  const IDB = {
    open() {
      return new Promise((res, rej) => {
        try {
          const r = indexedDB.open("ddd-store", 1);
          r.onupgradeneeded = () => r.result.createObjectStore("kv");
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        } catch (e) {
          rej(e);
        }
      });
    },
    async get(k) {
      const d = await this.open();
      return new Promise((res, rej) => {
        const q = d.transaction("kv").objectStore("kv").get(k);
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      });
    },
    async set(k, v) {
      const d = await this.open();
      return new Promise((res, rej) => {
        const q = d.transaction("kv", "readwrite").objectStore("kv").put(v, k);
        q.onsuccess = () => res();
        q.onerror = () => rej(q.error);
      });
    },
  };
  const FS = {
    supported: typeof window.showSaveFilePicker === "function",
    handle: null,
    perm: null,
    last: null,
    err: "",
    persisted: null,
    timer: null,
  };
  function fileQueue() {
    if (!FS.handle || FS.perm !== "granted") return;
    clearTimeout(FS.timer);
    FS.timer = setTimeout(fileWrite, 600);
  }
  async function fileWrite() {
    try {
      const w = await FS.handle.createWritable();
      await w.write(
        JSON.stringify(
          {
            version: 1,
            savedAt: Date.now(),
            matches: REAL.matches,
            cfg: REAL.cfg,
          },
          null,
          1,
        ),
      );
      await w.close();
      FS.last = Date.now();
      FS.err = "";
      markBackup();
    } catch (e) {
      FS.err = "書き込めませんでした（" + ((e && e.name) || "error") + "）";
    }
    renderFileInfo();
  }
  async function fileInit() {
    try {
      if (!localStorage.getItem(BACKUP_KEY))
        localStorage.setItem(
          BACKUP_KEY,
          JSON.stringify({ n: REAL.matches.length, ts: Date.now() }),
        );
    } catch (e) {}
    try {
      if (navigator.storage && navigator.storage.persist) {
        FS.persisted = await navigator.storage.persisted();
        if (!FS.persisted) FS.persisted = await navigator.storage.persist();
      }
    } catch (e) {}
    if (FS.supported) {
      try {
        FS.handle = (await IDB.get("saveHandle")) || null;
        if (FS.handle)
          FS.perm = await FS.handle.queryPermission({ mode: "readwrite" });
      } catch (e) {
        FS.handle = null;
      }
    }
    if (FS.handle && FS.perm === "granted" && !REAL.matches.length)
      await fileRestore(true);
    renderFileInfo();
    render();
  }
  async function fileRestore(silent) {
    try {
      if (FS.perm !== "granted") {
        FS.perm = await FS.handle.requestPermission({ mode: "readwrite" });
        if (FS.perm !== "granted") return;
      }
      const d = JSON.parse(await (await FS.handle.getFile()).text());
      if (!Array.isArray(d.matches)) throw 0;
      if (
        REAL.matches.length &&
        !silent &&
        $("#fileRestore").dataset.armed !== "1"
      ) {
        $("#fileRestore").dataset.armed = "1";
        $("#fileRestore").textContent = "もう一度押すとファイルの内容で上書き";
        return;
      }
      REAL.matches = d.matches;
      REAL.cfg = Object.assign(defCfg(), d.cfg || {});
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(REAL));
      } catch (e) {}
      $("#fileRestore").dataset.armed = "";
      toast(`ファイルから${d.matches.length}件を復元しました`);
      render();
    } catch (e) {
      if (!silent) toast("ファイルを読み込めませんでした");
    }
  }
  function renderFileInfo() {
    const box = $("#fileBox");
    if (!box) return;
    const t = (ts) => (ts ? fmtT(ts) : "");
    if (!FS.supported) {
      $("#fileInfo").textContent =
        "このブラウザはファイルへの自動保存に対応していません（MacやWindowsのChrome・Edgeで使えます）。";
      $("#filePick").hidden = true;
      $("#fileResume").hidden = true;
      $("#fileRestore").hidden = true;
    } else if (!FS.handle) {
      $("#fileInfo").textContent =
        "未設定です。保存先のファイルを選ぶと、記録するたびに自動で上書き保存します。";
      $("#filePick").hidden = false;
      $("#fileResume").hidden = true;
      $("#fileRestore").hidden = true;
    } else {
      $("#fileInfo").innerHTML =
        `<span class="dot ${FS.perm === "granted" && !FS.err ? "ok" : "warn"}"></span><b>${esc(FS.handle.name)}</b> ${FS.perm === "granted" ? (FS.err ? esc(FS.err) : FS.last ? "・ 最終保存 " + t(FS.last) : "・ 自動保存中") : "・ 再開には許可が必要です"}`;
      $("#filePick").hidden = false;
      $("#filePick").textContent = "保存先を変える";
      $("#fileResume").hidden = FS.perm === "granted";
      $("#fileRestore").hidden = false;
    }
    $("#fileHint").textContent =
      `ブラウザのデータ保護：${FS.persisted ? "有効（自動では消されません）" : "未許可（ブラウザが容量不足の時に消す可能性があります）"}。iPhoneでは、ホーム画面に追加して使うと記録が消えにくくなります。`;
  }
  $("#filePick").onclick = async () => {
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: "duel-data.json",
        types: [
          { description: "JSON", accept: { "application/json": [".json"] } },
        ],
      });
      FS.handle = h;
      FS.perm = "granted";
      try {
        await IDB.set("saveHandle", h);
      } catch (e) {}
      await fileWrite();
      toast("この後の記録は自動でファイルに保存されます");
    } catch (e) {
      if (e && e.name !== "AbortError") toast("保存先を設定できませんでした");
    }
  };
  $("#fileResume").onclick = async () => {
    try {
      FS.perm = await FS.handle.requestPermission({ mode: "readwrite" });
      if (FS.perm === "granted") await fileWrite();
    } catch (e) {}
    renderFileInfo();
  };
  $("#fileRestore").onclick = () => fileRestore(false);
  /* ---------- バックアップの催促 ---------- */
  function markBackup() {
    try {
      localStorage.setItem(
        BACKUP_KEY,
        JSON.stringify({ n: REAL.matches.length, ts: Date.now() }),
      );
    } catch (e) {}
  }
  function backupDue() {
    if (DEMO || !REAL.matches.length) return null;
    if (FS.handle && FS.perm === "granted" && !FS.err) return null;
    let b = null;
    try {
      b = JSON.parse(localStorage.getItem(BACKUP_KEY) || "null");
    } catch (e) {}
    const since = REAL.matches.length - (b ? b.n : 0),
      days = b ? (Date.now() - b.ts) / 86400e3 : Infinity;
    const step = FS.supported ? 50 : 10;
    let sn = 0;
    try {
      sn = Number(localStorage.getItem(BACKUP_KEY + "-snooze") || 0);
    } catch (e) {}
    return REAL.matches.length >= sn &&
      (since >= step || (since > 0 && days >= (FS.supported ? 7 : 1)))
      ? { since, days, step }
      : null;
  }
  async function saveMatch(m) {
    if (DEMO) {
      const i = DEMO.matches.findIndex((x) => x.id === m.id);
      if (i >= 0) DEMO.matches[i] = m;
      else DEMO.matches.push(m);
      DEMO.matches.sort((a, b) => a.ts - b.ts);
      render();
      return;
    }
    const i = REAL.matches.findIndex((x) => x.id === m.id);
    if (i >= 0) REAL.matches[i] = m;
    else REAL.matches.push(m);
    REAL.matches.sort((a, b) => a.ts - b.ts);
    lsSave();
    render();
  }
  async function delMatch(id) {
    if (DEMO) {
      DEMO.matches = DEMO.matches.filter((x) => x.id !== id);
      render();
      return;
    }
    REAL.matches = REAL.matches.filter((x) => x.id !== id);
    lsSave();
    render();
  }
  function saveCfg() {
    if (DEMO) {
      render();
      return Promise.resolve();
    }
    lsSave();
    render();
    return Promise.resolve();
  }
  function initStore() {
    lsLoad();
    render();
    fileInit();
  }

  /* ---------- 集計ヘルパー ---------- */
  const cfg = () => D().cfg;
  function addDeck(name) {
    name = (name || "").trim();
    if (!name) return "";
    const c = cfg();
    if (!c.decks.includes(name)) {
      c.decks = c.decks.concat([name]);
    }
    return name;
  }
  function curVer() {
    const c = cfg();
    return (c.verBy && c.myDeck && c.verBy[c.myDeck]) || c.ver || "v1";
  }
  function verList(deck) {
    const c = cfg(),
      first = {};
    D().matches.forEach((m) => {
      if (m.my === deck && m.ver && first[m.ver] == null) first[m.ver] = m.ts;
    });
    const extra = (c.verList || {})[deck] || [];
    const out = Object.keys(first).sort((a, b) => first[a] - first[b]);
    extra.forEach((v) => {
      if (!out.includes(v)) out.push(v);
    });
    if (deck === c.myDeck && !out.includes(curVer())) out.push(curVer());
    return out;
  }
  function windowMatches() {
    let ms = D().matches;
    if (UI.scope === "deck" && cfg().myDeck) {
      ms = ms.filter((m) => m.my === cfg().myDeck);
      if (UI.ver && UI.ver !== "all")
        ms = ms.filter((m) => (m.ver || "") === UI.ver);
    }
    if (UI.range === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      ms = ms.filter((m) => m.ts >= d.getTime());
    } else if (UI.range !== "all") {
      ms = ms.slice(-Number(UI.range));
    }
    return ms;
  }
  function rates(ms) {
    const n = ms.length,
      w = ms.filter((m) => m.win).length,
      fm = ms.filter((m) => m.first),
      sm = ms.filter((m) => !m.first);
    return {
      n,
      w,
      p: n ? w / n : null,
      f: n ? fm.length / n : null,
      pf: fm.length ? fm.filter((m) => m.win).length / fm.length : null,
      ps: sm.length ? sm.filter((m) => m.win).length / sm.length : null,
      nf: fm.length,
      ns: sm.length,
      brick: n ? ms.filter((m) => m.brick).length / n : null,
      miss: (() => {
        const a = ms.filter((m) => m.miss != null);
        return a.length ? a.filter((m) => m.miss).length / a.length : null;
      })(),
      ob: n ? ms.filter((m) => m.oppBrick).length / n : null,
    };
  }
  /** 勝率の95%信頼区間（Wilson スコア区間）。戻り値は [下限, 上限]。 */
  function wilson(w, n, z = 1.96) {
    if (!n) return [0, 1];
    const p = w / n,
      d = 1 + (z * z) / n,
      c = p + (z * z) / (2 * n),
      r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return [clamp((c - r) / d, 0, 1), clamp((c + r) / d, 0, 1)];
  }
  /**
   * 各試合後の DP を計算する。実際の DP（m.dp）が入力された試合ではその値に置き換え、
   * それ以外は直前の値に増減（m.pt）を足していく。
   */
  function dpCum() {
    const a = D().matches,
      arr = [],
      map = {};
    let run = 0;
    a.forEach((m) => {
      if (m.dp != null && m.dp !== "") run = Number(m.dp);
      else run += Number(m.pt) || 0;
      arr.push(run);
      map[m.id] = run;
    });
    return { arr, map };
  }
  function curPt() {
    const c = dpCum().arr;
    return c.length ? c[c.length - 1] : 0;
  }
  let toastT;
  function toast(t) {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => (el.hidden = true), 2600);
  }

  /** 目標順位（○位ライン）。既定は100位（銀ライン）。 */
  const targetRank = () =>
    Math.max(1, Math.round(Number(cfg().targetRank) || 100));
  function renderTargetLabels() {
    $$(".tgtLbl").forEach((el) => (el.textContent = `${targetRank()}位ライン`));
    const el = $("#targetIn");
    if (el && document.activeElement !== el) el.value = targetRank();
  }
  $("#targetIn").addEventListener("change", (e) => {
    const v = Math.round(Number(e.target.value));
    cfg().targetRank = v > 0 ? v : null;
    saveCfg();
  });
  /* ---------- ヘッダー（常時表示） ---------- */
  function renderHeader() {
    const c = cfg(),
      sel = $("#myDeck");
    const opts = ['<option value="">（未設定）</option>'].concat(
      c.decks.map(
        (d) =>
          `<option value="${esc(d)}"${d === c.myDeck ? " selected" : ""}>${esc(d)}</option>`,
      ),
    );
    opts.push('<option value="__new">＋ 新しいデッキ…</option>');
    if (c.myDeck && !c.decks.includes(c.myDeck))
      opts.splice(
        1,
        0,
        `<option value="${esc(c.myDeck)}" selected>${esc(c.myDeck)}</option>`,
      );
    sel.innerHTML = opts.join("");
    sel.value = c.myDeck || "";
    const vs = $("#myVer"),
      vl = c.myDeck ? verList(c.myDeck) : [];
    vs.disabled = !c.myDeck;
    vs.innerHTML =
      vl.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("") +
      '<option value="__new">＋ 新しいver.…</option>';
    vs.value = curVer();
    const wm = windowMatches(),
      r = rates(wm),
      r10 = rates(wm.slice(-10));
    const items = [
      ["試合", r.n || 0],
      ["勝率", pct(r.p)],
      [
        "直近10戦",
        r10.n
          ? `${pct(r10.p, 0)}<small style="font-size:11px;color:var(--muted);margin-left:3px">${r10.w}-${r10.n - r10.w}</small>`
          : "–",
      ],
      ["先攻率", pct(r.f)],
      ["先攻勝率", pct(r.pf)],
      ["後攻勝率", pct(r.ps)],
      ["DP", curPt().toLocaleString("ja-JP")],
    ];
    $("#stats").innerHTML = items
      .map(
        ([k, v]) =>
          `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`,
      )
      .join("");
    const b = $("#banner");
    if (DEMO)
      b.innerHTML =
        '<div class="banner"><div class="wrap">サンプルデータを表示しています。ここでの入力は保存されません。<button class="btn small" id="demoOff">サンプルを閉じる</button></div></div>';
    else if (backupDue()) {
      const d = backupDue();
      b.innerHTML = `<div class="banner"><div class="wrap">前回のバックアップから${d.since}戦記録しています。JSONで書き出しておくと安心です。<button class="btn small" id="bkNow">今すぐ書き出す</button><button class="btn small" id="bkLater">あとで</button></div></div>`;
    } else b.innerHTML = "";
    renderSpark();
    renderDtlMini();
    const bk = $("#bkNow");
    if (bk) bk.onclick = () => $("#expJson").click();
    const bl = $("#bkLater");
    if (bl)
      bl.onclick = () => {
        try {
          localStorage.setItem(
            BACKUP_KEY + "-snooze",
            String(REAL.matches.length + (FS.supported ? 50 : 10)),
          );
        } catch (e) {}
        render();
      };
    const off = $("#demoOff");
    if (off)
      off.onclick = () => {
        DEMO = null;
        resetForm();
        render();
      };
  }
  $("#myDeck").addEventListener("change", (e) => {
    const v = e.target.value;
    if (v === "__new") {
      $("#newMyRow").hidden = false;
      $("#newMyIn").focus();
      e.target.value = cfg().myDeck || "";
      return;
    }
    cfg().myDeck = v;
    UI.ver = "all";
    saveCfg();
  });
  $("#newMyAdd").onclick = () => {
    const n = addDeck($("#newMyIn").value);
    if (!n) return;
    cfg().myDeck = n;
    UI.ver = "all";
    $("#newMyIn").value = "";
    $("#newMyRow").hidden = true;
    saveCfg();
  };
  $("#newMyCancel").onclick = () => {
    $("#newMyRow").hidden = true;
  };
  function setVer(v) {
    const c = cfg();
    if (!c.myDeck) return;
    c.verBy = Object.assign({}, c.verBy || {});
    c.verBy[c.myDeck] = v;
    const vl = Object.assign({}, c.verList || {});
    const a = (vl[c.myDeck] || []).slice();
    if (!a.includes(v)) a.push(v);
    vl[c.myDeck] = a;
    c.verList = vl;
    saveCfg();
    toast(`以降の記録は ${c.myDeck}（${v}）になります`);
  }
  $("#myVer").addEventListener("change", (e) => {
    const v = e.target.value;
    if (v === "__new") {
      $("#newVerRow").hidden = false;
      $("#newVerIn").focus();
      e.target.value = curVer();
      return;
    }
    setVer(v);
  });
  $("#newVerAdd").onclick = () => {
    const v = $("#newVerIn").value.trim();
    if (!v) return;
    $("#newVerIn").value = "";
    $("#newVerRow").hidden = true;
    setVer(v);
  };
  $("#newVerCancel").onclick = () => {
    $("#newVerRow").hidden = true;
  };
  onEnter($("#newVerIn"), () => $("#newVerAdd").click());
  onEnter($("#newMyIn"), () => $("#newMyAdd").click());

  /* ---------- 入力フォーム ---------- */
  function oppOrder() {
    const last = {},
      cnt = {};
    D().matches.forEach((m) => {
      last[m.opp] = m.ts;
      cnt[m.opp] = (cnt[m.opp] || 0) + 1;
    });
    const names = cfg().decks.slice();
    if (F.opp && !names.includes(F.opp)) names.push(F.opp);
    return names
      .sort(
        (a, b) => (last[b] || 0) - (last[a] || 0) || a.localeCompare(b, "ja"),
      )
      .map((n) => ({ n, c: cnt[n] || 0 }));
  }
  function renderForm() {
    const list = oppOrder();
    $("#oppChips").classList.toggle("editing", !!UI.oppEdit);
    $("#oppEdit").textContent = UI.oppEdit ? "完了" : "候補を編集";
    $("#oppChips").innerHTML = list.length
      ? list
          .map((o) =>
            UI.oppEdit
              ? `<button class="chip" data-rm="${esc(o.n)}" aria-label="${esc(o.n)}を候補から外す">${esc(o.n)}<span class="x">×</span></button>`
              : `<button class="chip" data-opp="${esc(o.n)}" aria-pressed="${o.n === F.opp}">${esc(o.n)}${o.c ? `<span class="c">${o.c}</span>` : ""}</button>`,
          )
          .join("")
      : '<span class="hint" style="margin:0">下の欄から相手デッキを追加してください</span>';
    setSeg("#segFirst", F.first === null ? null : F.first ? "1" : "0");
    setSeg("#segWin", F.win === null ? null : F.win ? "1" : "0");
    $("#ptSign").textContent = F.win === null ? "±" : F.win ? "+" : "−";
    $("#tgBrick").setAttribute("aria-pressed", F.brick);
    $("#tgMiss").setAttribute("aria-pressed", F.miss);
    $("#tgOppBrick").setAttribute("aria-pressed", F.oppBrick);
    const tb = $("#tgBuild");
    tb.setAttribute("aria-pressed", F.build !== 0);
    tb.disabled = F.win === null || F.brick;
    tb.textContent =
      F.win === true ? "構築で勝ち" : F.win === false ? "構築で負け" : "構築";
    tb.title = "自分の構築（採用カードや型）が勝敗に効いた試合で押します";
    $("#buildHint").hidden = !F.brick;
    $("#buildHint").textContent = "事故した試合は構築フラグを付けません";
    const used = {},
      pl = {};
    D().matches.forEach((m) => {
      if (m.char) used[m.char] = m.ts;
      if (m.player) pl[m.player] = m.ts;
    });
    const chars = Array.from(
      new Set((cfg().chars || []).concat(Object.keys(used))),
    );
    $("#charList").innerHTML = chars
      .map((c) => `<option value="${esc(c)}"></option>`)
      .join("");
    $("#playerList").innerHTML = Object.keys(pl)
      .sort((a, b) => pl[b] - pl[a])
      .map((c) => `<option value="${esc(c)}"></option>`)
      .join("");
    const lastOf = (k) => {
      const a = D().matches;
      for (let i = a.length - 1; i >= 0; i--)
        if (a[i][k] != null && a[i][k] !== "") return a[i];
      return null;
    };
    const lr = lastOf("rank"),
      ls = lastOf("silver");
    $("#dpIn").placeholder = F.id
      ? "自動（前の試合から計算）"
      : `自動（この試合後 ${(curPt() + (F.win === null ? 0 : (F.win ? 1 : -1) * (Number(($("#ptIn").value || "").replace(/[^\d.]/g, "")) || DEFAULT_DP_CHANGE))).toLocaleString("ja-JP")}）`;
    $("#rankIn").placeholder = lr
      ? `前回 ${lr.rank}（${fmtT(lr.ts)}）`
      : "任意";
    $("#silverIn").placeholder = ls
      ? `前回 ${ls.silver}（${fmtT(ls.ts)}）`
      : "任意";
    const editing = !!F.id;
    $("#formTitle").textContent = editing ? "記録を編集" : "対戦を記録";
    const cur = renderFatigueWarn();
    $("#formSub").textContent = editing
      ? ""
      : cfg().myDeck
        ? `${cfg().myDeck}（${curVer()}）${cur ? ` ・ 連続${cur.next}戦目` : ""}`
        : "先に上部で使用デッキを選んでください";
    $("#btnSave").textContent = editing ? "更新する" : "記録する";
    $("#btnCancel").hidden = !editing;
    $("#btnDel").hidden = !editing;
    if (!editing) {
      $("#btnDel").dataset.armed = "";
      $("#btnDel").textContent = "削除";
    }
  }
  function setSeg(sel, val) {
    $$(sel + " button").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.v === val),
    );
  }
  $("#oppChips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    if (b.dataset.rm != null) {
      const n = b.dataset.rm;
      const c = cfg();
      c.decks = c.decks.filter((d) => d !== n);
      if (F.opp === n) F.opp = "";
      saveCfg();
      toast(n + " を候補から外しました（過去の記録は残ります）");
      return;
    }
    F.opp = b.dataset.opp;
    clearErr();
    renderForm();
  });
  $("#oppEdit").onclick = () => {
    UI.oppEdit = !UI.oppEdit;
    renderForm();
  };
  $("#oppAdd").onclick = () => {
    const n = addDeck($("#oppNew").value);
    if (!n) return;
    F.opp = n;
    $("#oppNew").value = "";
    saveCfg();
    renderForm();
  };
  onEnter($("#oppNew"), () => $("#oppAdd").click());
  $("#segFirst").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    F.first = b.dataset.v === "1";
    clearErr();
    renderForm();
  });
  $("#segWin").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const nw = b.dataset.v === "1";
    if (F.win !== nw) {
      F.win = nw;
      if (F.build !== 0) F.build = nw ? 1 : -1;
    }
    clearErr();
    renderForm();
  });
  $("#tgBrick").onclick = () => {
    F.brick = !F.brick;
    if (F.brick) F.build = 0;
    renderForm();
  };
  $("#tgMiss").onclick = () => {
    F.miss = !F.miss;
    renderForm();
  };
  $("#tgOppBrick").onclick = () => {
    F.oppBrick = !F.oppBrick;
    renderForm();
  };
  $("#tgBuild").onclick = () => {
    if (F.win === null || F.brick) return;
    F.build = F.build ? 0 : F.win ? 1 : -1;
    renderForm();
  };
  function clearErr() {
    $("#formErr").textContent = "";
  }
  function resetForm() {
    Object.assign(F, {
      id: null,
      opp: "",
      first: null,
      win: null,
      brick: false,
      oppBrick: false,
      miss: false,
      build: 0,
      note: "",
    });
    $("#ptIn").value = "";
    $("#noteIn").value = "";
    $("#charIn").value = "";
    $("#playerIn").value = "";
    $("#tsIn").value = "";
    $("#rankIn").value = "";
    $("#silverIn").value = "";
    $("#dpIn").value = "";
  }
  $("#btnSave").onclick = async () => {
    const miss = [];
    if (!F.opp) miss.push("相手デッキ");
    if (F.first === null) miss.push("先後");
    if (F.win === null) miss.push("勝敗");
    if (!cfg().myDeck && !F.id) miss.unshift("使用デッキ（上部）");
    if (miss.length) {
      $("#formErr").textContent = miss.join("・") + "を選んでください";
      return;
    }
    const raw = $("#ptIn")
      .value.trim()
      .replace(/[^\d.]/g, "");
    const abs = raw ? Math.abs(Number(raw)) : DEFAULT_DP_CHANGE;
    if (raw && !isFinite(abs)) {
      $("#formErr").textContent = "DPは数字で入力してください";
      return;
    }
    const prev = F.id ? D().matches.find((m) => m.id === F.id) : null;
    const tsv = $("#tsIn").value;
    const tsIn = tsv ? new Date(tsv).getTime() : null;
    if (tsv && !isFinite(tsIn)) {
      $("#formErr").textContent = "日時の形式が正しくありません";
      return;
    }
    const m = {
      id:
        F.id ||
        "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: tsIn != null ? tsIn : prev ? prev.ts : Date.now(),
      my: prev ? prev.my : cfg().myDeck,
      ver: prev ? prev.ver : curVer(),
      opp: F.opp,
      first: F.first,
      win: F.win,
      pt: F.win ? abs : -abs,
      brick: F.brick,
      oppBrick: F.oppBrick,
      miss: F.miss,
      build: F.brick ? 0 : F.build,
      note: $("#noteIn").value.trim(),
      char: $("#charIn").value.trim(),
      player: $("#playerIn").value.trim(),
      rank: num($("#rankIn").value),
      silver: num($("#silverIn").value),
      dp: num($("#dpIn").value),
    };
    if (!raw && m.dp != null) {
      const others = D()
        .matches.filter((x) => x.id !== m.id && x.ts <= m.ts)
        .sort((a, b) => a.ts - b.ts);
      if (others.some((x) => x.dp != null && x.dp !== "")) {
        let run = 0;
        others.forEach((x) => {
          if (x.dp != null && x.dp !== "") run = Number(x.dp);
          else run += Number(x.pt) || 0;
        });
        m.pt = m.dp - run;
      }
    }
    const wasEdit = !!F.id;
    try {
      await saveMatch(m);
    } catch (e) {
      $("#formErr").textContent =
        "保存できませんでした（" +
        ((e && e.code) || "error") +
        "）。通信を確認してもう一度押してください。";
      return;
    }
    resetForm();
    toast(wasEdit ? "更新しました" : "記録しました");
    render();
  };
  $("#tsNow").onclick = () => {
    $("#tsIn").value = toLocalInput(Date.now());
  };
  $("#btnCancel").onclick = () => {
    resetForm();
    render();
  };
  $("#btnDel").onclick = async () => {
    const b = $("#btnDel");
    if (b.dataset.armed !== "1") {
      b.dataset.armed = "1";
      b.textContent = "もう一度押すと削除";
      return;
    }
    const id = F.id;
    resetForm();
    try {
      await delMatch(id);
      toast("削除しました");
    } catch (e) {
      toast("削除できませんでした");
    }
    render();
  };
  function matchRow(m, i) {
    const t = fmtT(m.ts);
    const tags =
      (m.brick ? '<span class="tag b">事故</span>' : "") +
      (m.oppBrick ? '<span class="tag ob">相手事故</span>' : "") +
      (m.miss ? '<span class="tag b">プレミ</span>' : "") +
      (buildTag(m.build)
        ? `<span class="tag k">${buildTag(m.build)}</span>`
        : "");
    return `<button class="mrow${m.id === F.id ? " editing" : ""}" data-id="${esc(m.id)}"><span class="res ${m.win ? "w" : "l"}">${m.win ? "WIN" : "LOSE"}</span><span class="fs${m.first ? " f" : ""}">${m.first ? "先" : "後"}</span><span class="opp">${esc(m.opp)}${tags}${m.char || m.player ? `<small>${esc([m.char, m.player].filter(Boolean).join(" / "))}</small>` : ""}${m.note ? `<small>${esc(m.note)}</small>` : ""}</span><span class="r"><b>${fmtPt(Number(m.pt) || 0)}</b>${t}</span></button>`;
  }
  function renderRecent() {
    const all = D().matches.slice().reverse();
    const el = $("#recent");
    if (!all.length) {
      el.innerHTML =
        '<div class="empty"><span>まだ記録がありません。上のフォームで1戦目を記録すると、ここに並びます。</span><button class="btn small" id="demoInline">サンプルデータで試す</button></div>';
      const di = $("#demoInline");
      if (di) di.onclick = startDemo;
      $("#moreRecent").hidden = true;
      return;
    }
    el.innerHTML = all.slice(0, UI.recentN).map(matchRow).join("");
    $("#moreRecent").hidden = all.length <= UI.recentN;
  }
  $("#moreRecent").onclick = () => {
    UI.recentN += 30;
    renderRecent();
  };
  function editMatch(id) {
    const m = D().matches.find((x) => x.id === id);
    if (!m) return;
    Object.assign(F, {
      id: m.id,
      opp: m.opp,
      first: !!m.first,
      win: !!m.win,
      brick: !!m.brick,
      oppBrick: !!m.oppBrick,
      miss: !!m.miss,
      build: m.build || 0,
    });
    $("#ptIn").value = m.pt ? String(Math.abs(m.pt)) : "";
    $("#noteIn").value = m.note || "";
    $("#charIn").value = m.char || "";
    $("#playerIn").value = m.player || "";
    $("#tsIn").value = toLocalInput(m.ts);
    $("#rankIn").value = m.rank == null ? "" : m.rank;
    $("#silverIn").value = m.silver == null ? "" : m.silver;
    $("#dpIn").value = m.dp == null ? "" : m.dp;
    if (m.dp != null) $("#moreBox").open = true;
    clearErr();
    if (m.rank != null || m.silver != null || m.dp != null)
      $("#moreBox").open = true;
    if (!isWide() && UI.view !== "input") {
      location.hash = "input";
    } else render();
    setTimeout(
      () =>
        $("#formCard").scrollIntoView({ behavior: "smooth", block: "start" }),
      30,
    );
  }
  $("#recent").addEventListener("click", (e) => {
    const b = e.target.closest(".mrow");
    if (b) editMatch(b.dataset.id);
  });

  function renderPlayers() {
    const by = {};
    D().matches.forEach((m) => {
      if (!m.player) return;
      (by[m.player] = by[m.player] || []).push(m);
    });
    const el = $("#playerTable"),
      rows = Object.entries(by).sort(
        (a, b) => b[1][b[1].length - 1].ts - a[1][a[1].length - 1].ts,
      );
    if (!rows.length) {
      el.innerHTML =
        '<div class="empty">入力パネルで相手プレイヤーを入れると、ここに一覧が出ます。</div>';
      return;
    }
    el.innerHTML = `<table class="t"><thead><tr><th>プレイヤー</th><th>対戦</th><th>勝敗</th><th>使用デッキ（キャラ）</th><th>最終対戦</th></tr></thead><tbody>${rows
      .map(([n, a]) => {
        const w = a.filter((m) => m.win).length;
        const dk = {};
        a.forEach((m) => {
          const k = m.opp + (m.char ? `（${m.char}）` : "");
          dk[k] = (dk[k] || 0) + 1;
        });
        return `<tr><td><button class="linkbtn" data-player="${esc(n)}">${esc(n)}</button>${UI.player === n ? " ✓" : ""}</td><td>${a.length}</td><td>${w}-${a.length - w}</td><td class="tx" style="text-align:left">${Object.entries(
          dk,
        )
          .map(([k, c]) => esc(k) + (c > 1 ? `×${c}` : ""))
          .join("、")}</td><td>${fmtT(a[a.length - 1].ts)}</td></tr>`;
      })
      .join("")}</tbody></table>`;
  }
  $("#playerTable").addEventListener("click", (e) => {
    const b = e.target.closest("[data-player]");
    if (!b) return;
    UI.player = UI.player === b.dataset.player ? null : b.dataset.player;
    render();
  });
  function renderHistory() {
    renderSelf();
    renderPlayers();
    let ms = windowMatches();
    if (UI.player) ms = ms.filter((m) => m.player === UI.player);
    const el = $("#histTable");
    if (!ms.length) {
      el.innerHTML = '<div class="empty">この条件の記録はありません。</div>';
      $("#histSub").textContent = "";
      return;
    }
    const cum = dpCum().map;
    const r = rates(ms);
    $("#histSub").innerHTML =
      `${UI.player ? `${esc(UI.player)} との対戦 ・ <button class="linkbtn" data-player="${esc(UI.player)}">絞り込みを解除</button> ・ ` : ""}${r.n}戦 ${r.w}勝${r.n - r.w}敗 ・ 行を押すと編集`;
    const dayKey = (ts) => {
      const d = new Date(ts);
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    };
    const days = {};
    ms.forEach((m) => {
      const k = dayKey(m.ts);
      (days[k] = days[k] || []).push(m);
    });
    const rev = ms.slice().reverse();
    let html = "",
      cur = "";
    const idx = {};
    ms.forEach((m, i) => (idx[m.id] = i + 1));
    rev.forEach((m) => {
      const k = dayKey(m.ts);
      if (k !== cur) {
        cur = k;
        const a = days[k],
          w = a.filter((x) => x.win).length,
          dp = a.reduce((x, y) => x + (Number(y.pt) || 0), 0);
        html += `<tr><td class="day" colspan="14">${k}<span>${a.length}戦 ${w}勝${a.length - w}敗 ・ 勝率${pct(w / a.length, 0)} ・ DP ${fmtPt(dp)}</span></td></tr>`;
      }
      const fl = [
        m.brick ? "事故" : "",
        m.oppBrick ? "相手事故" : "",
        m.miss ? "プレミ" : "",
        buildTag(m.build),
      ]
        .filter(Boolean)
        .join(" ");
      const d = new Date(m.ts);
      html += `<tr class="m" data-id="${esc(m.id)}"><td>${idx[m.id]}</td><td>${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}</td><td class="tx">${esc(m.my)}${m.ver ? `<small style="color:var(--muted)"> ${esc(m.ver)}</small>` : ""}</td><td class="tx">${esc(m.opp)}</td><td class="tx">${esc(m.char || "")}</td><td class="tx">${esc(m.player || "")}</td><td>${m.first ? "先" : "後"}</td><td class="${m.win ? "w" : "l"}">${m.win ? "○" : "×"}</td><td>${fmtPt(Number(m.pt) || 0)}</td><td>${(cum[m.id] || 0).toLocaleString("ja-JP")}${m.dp != null && m.dp !== "" ? '<span class="sub-mark" title="実際のDPで補正">実</span>' : ""}</td><td>${m.rank != null ? m.rank : ""}</td><td>${m.silver != null ? Number(m.silver).toLocaleString("ja-JP") : ""}</td><td class="tx">${fl}</td><td class="tx">${esc(m.note || "")}</td></tr>`;
    });
    el.innerHTML = `<table class="t hist"><thead><tr><th>#</th><th>時刻</th><th>使用</th><th>相手</th><th>キャラ</th><th>プレイヤー</th><th>先後</th><th>勝敗</th><th>DP増減</th><th>DP</th><th>順位</th><th>${targetRank()}位ライン</th><th>フラグ</th><th>メモ</th></tr></thead><tbody>${html}</tbody></table>`;
  }
  $("#histSub").addEventListener("click", (e) => {
    if (e.target.closest("[data-player]")) {
      UI.player = null;
      render();
    }
  });
  $("#histTable").addEventListener("click", (e) => {
    const tr = e.target.closest("tr.m");
    if (tr) editMatch(tr.dataset.id);
  });

  /* ---------- フィルター ---------- */
  function renderFilters() {
    const sc = [
        ["deck", "使用デッキ"],
        ["all", "全デッキ"],
      ],
      rg = [
        ["all", "全期間"],
        ["today", "今日"],
        ["50", "直近50"],
        ["100", "直近100"],
      ];
    const h = `<div class="seg" data-f="scope">${sc.map(([v, l]) => `<button data-v="${v}" aria-pressed="${UI.scope === v}">${l}</button>`).join("")}</div><div class="seg" data-f="range">${rg.map(([v, l]) => `<button data-v="${v}" aria-pressed="${UI.range === v}">${l}</button>`).join("")}</div>`;
    const vl = cfg().myDeck ? verList(cfg().myDeck) : [];
    if (UI.ver && UI.ver !== "all" && !vl.includes(UI.ver)) UI.ver = "all";
    const vh =
      UI.scope === "deck" && vl.length > 1
        ? `<div class="seg" data-f="ver"><button data-v="all" aria-pressed="${!UI.ver || UI.ver === "all"}">総合</button>${vl.map((v) => `<button data-v="${esc(v)}" aria-pressed="${UI.ver === v}">${esc(v)}</button>`).join("")}</div>`
        : "";
    $$("[data-filters]").forEach((el) => (el.innerHTML = h + vh));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-f] button");
    if (!b) return;
    UI[b.parentElement.dataset.f] = b.dataset.v;
    render();
  });

  /* ---------- 推移（DP・MACD・BB・連続プレイ）／環境 ---------- */
  /** 目盛り用の「キリの良い」刻み幅（1・2・5 × 10^n）を返す。 */
  function niceStep(range, minStep, maxTicks) {
    if (!(range > 0)) return minStep;
    let mag = Math.pow(
      10,
      Math.floor(Math.log10(Math.max(minStep, range / maxTicks))),
    );
    for (;;) {
      for (const m of [1, 2, 5]) {
        const st = m * mag;
        if (st >= minStep && range / st <= maxTicks) return st;
      }
      mag *= 10;
    }
  }
  function lineChart(el, vals, opt) {
    const w = Math.max(260, el.clientWidth || 600),
      h = opt.h || 180,
      pl = 46,
      pr = 10,
      pt = 10,
      pb = opt.noX ? 4 : 22;
    if (vals.length < 2) {
      el.innerHTML = '<div class="empty">2戦以上で表示されます</div>';
      return;
    }
    const v2 = opt.v2 || [],
      v3 = (opt.v3 || []).filter((v) => v != null),
      bd = (opt.bands || [])
        .reduce((a, b) => a.concat(b.hi, b.lo), [])
        .filter((v) => v != null);
    let lo = Math.min(...vals, ...v2, ...v3, ...bd),
      hi = Math.max(...vals, ...v2, ...v3, ...bd);
    if (opt.min != null) lo = Math.min(lo, opt.min);
    if (opt.max != null) hi = Math.max(hi, opt.max);
    let ticks;
    if (opt.fixed) {
      lo = opt.fixed[0];
      hi = opt.fixed[1];
      ticks = opt.ticks;
    } else {
      const st = niceStep(hi - lo, opt.minStep || 1, 5);
      // 軸の範囲はデータに合わせ（上下に少し余白）、目盛りだけキリの良い値に置く
      const pad = (hi - lo) * 0.06 || st / 2;
      lo -= pad;
      hi += pad;
      ticks = [];
      for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) ticks.push(v);
    }
    const X = (i) => pl + ((w - pl - pr) * i) / (vals.length - 1),
      Y = (v) => pt + (h - pt - pb) * (1 - (v - lo) / (hi - lo));
    let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(opt.label || "")}">`;
    ticks.forEach((t) => {
      s += `<line x1="${pl}" x2="${w - pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)" stroke-width="1"${opt.ref === t ? "" : ' stroke-dasharray="2 3"'}/><text x="${pl - 6}" y="${Y(t) + 4}" text-anchor="end">${opt.fmt(t)}</text>`;
    });
    const d = vals
      .map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1))
      .join(" ");
    if (opt.bands) {
      opt.bands.forEach((bd) => {
        const H = bd.hi,
          L = bd.lo,
          idx = H.map((v, i) => i).filter((i) => H[i] != null);
        if (idx.length > 1) {
          const up = idx
              .map(
                (i, k) =>
                  (k ? "L" : "M") + X(i).toFixed(1) + " " + Y(H[i]).toFixed(1),
              )
              .join(" "),
            dn = idx
              .slice()
              .reverse()
              .map((i) => "L" + X(i).toFixed(1) + " " + Y(L[i]).toFixed(1))
              .join(" ");
          s += `<path d="${up} ${dn} Z" fill="var(--c2)" fill-opacity="${bd.op}" stroke="none"/>`;
        }
      });
    } else
      s += `<path d="${d} L${X(vals.length - 1)} ${h - pb} L${pl} ${h - pb} Z" fill="var(--accent-soft)" opacity=".55"/>`;
    s += `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
    if (v2.length > 1) {
      const d2 = v2
        .map(
          (v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1),
        )
        .join(" ");
      s += `<path class="dash" d="${d2}" fill="none" stroke="var(--c2)" stroke-width="2"/>`;
    }
    if (opt.v3) {
      let d3 = "",
        prev = null;
      opt.v3.forEach((v, i) => {
        if (v == null) {
          prev = null;
          return;
        }
        const x = X(i).toFixed(1),
          y = Y(v).toFixed(1);
        if (prev == null) d3 += `M${x} ${y} `;
        else d3 += `L${x} ${Y(prev).toFixed(1)} L${x} ${y} `;
        prev = v;
      });
      if (d3)
        s += `<path d="${d3}" fill="none" stroke="var(--silver)" stroke-width="2"/>`;
    }
    const li = vals.length - 1;
    s += `<circle cx="${X(li)}" cy="${Y(vals[li])}" r="4" fill="var(--accent)"/>`;
    const x0 = opt.x0 || 0,
      n = vals.length,
      xs = niceStep(n - 1, 1, 6);
    for (
      let v = Math.ceil(x0 / xs) * xs;
      !opt.noX && v <= x0 + n - 1;
      v += xs
    ) {
      const x = X(v - x0);
      const anc = x < pl + 12 ? "start" : x > w - pr - 12 ? "end" : "middle";
      s += `<line x1="${x}" x2="${x}" y1="${h - pb}" y2="${h - pb + 4}" stroke="var(--line)"/><text x="${x}" y="${h - 6}" text-anchor="${anc}">${v}</text>`;
    }
    (opt.marks || []).forEach((mk) => {
      const x = X(mk.i - x0);
      if (x < pl || x > w - pr) return;
      s += `<line x1="${x}" x2="${x}" y1="${pt}" y2="${h - pb}" stroke="var(--first)" stroke-width="1" stroke-dasharray="3 3"/><text x="${x + 3}" y="${pt + 10}" style="fill:var(--first)">${esc(mk.label)}</text>`;
    });
    s += "</svg>";
    el.innerHTML = s;
  }
  function switchMarks(ms, offset) {
    const out = [];
    for (let i = 1; i < ms.length; i++) {
      const a = ms[i - 1],
        b = ms[i];
      if (a.my !== b.my)
        out.push({ i: i + offset, label: b.my + (b.ver ? " " + b.ver : "") });
      else if ((a.ver || "") !== (b.ver || ""))
        out.push({ i: i + offset, label: b.ver || "-" });
    }
    return out;
  }
  /** ボリンジャーバンド。直近 n 戦の平均 ± k × 標準偏差。n 戦未満の位置は null。 */
  function boll(v, n, k) {
    const hi = [],
      lo = [];
    v.forEach((x, i) => {
      if (i < n - 1) {
        hi.push(null);
        lo.push(null);
        return;
      }
      const a = v.slice(i - n + 1, i + 1),
        m = a.reduce((p, q) => p + q, 0) / n,
        sd = Math.sqrt(a.reduce((p, q) => p + (q - m) * (q - m), 0) / n);
      hi.push(m + k * sd);
      lo.push(m - k * sd);
    });
    return { hi, lo };
  }
  /** 指数移動平均（期間 n）。 */
  function ema(v, n) {
    const a = 2 / (n + 1),
      o = [];
    v.forEach((x, i) => o.push(i ? a * x + (1 - a) * o[i - 1] : x));
    return o;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("#macdSeg button");
    if (!b) return;
    UI.macd = b.dataset.mp;
    renderCharts();
  });
  function macdChart(el, vals, marks, mp) {
    const [ns, nl, nsg] = mp;
    if (vals.length < nl + 1) {
      el.innerHTML = `<div class="empty">${nl + 1}戦以上で表示されます（長期${nl}戦の平均が必要なため）</div>`;
      return null;
    }
    const eL = ema(vals, nl),
      m = ema(vals, ns).map((x, i) => x - eL[i]),
      sg = ema(m, nsg),
      hs = m.map((x, i) => x - sg[i]);
    const st = nl,
      mv = m.slice(st),
      sv = sg.slice(st),
      hv = hs.slice(st),
      n = mv.length,
      N = vals.length;
    const w = Math.max(260, el.clientWidth || 600),
      h = 90,
      pl = 46,
      pr = 10,
      pt = 6,
      pb = 20;
    let lo = Math.min(0, ...mv, ...sv, ...hv),
      hi = Math.max(0, ...mv, ...sv, ...hv);
    const sp = niceStep(hi - lo, 1, 4);
    lo = Math.floor(lo / sp) * sp;
    hi = Math.ceil(hi / sp) * sp;
    if (hi === lo) hi += sp;
    const X = (i) => pl + ((w - pl - pr) * (i + st)) / (N - 1),
      Y = (v) => pt + (h - pt - pb) * (1 - (v - lo) / (hi - lo)),
      bw = Math.max(1, ((w - pl - pr) / N) * 0.7);
    let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="MACD">`;
    for (let v = lo; v <= hi + sp / 2; v += sp)
      s += `<line x1="${pl}" x2="${w - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"${v === 0 ? "" : ' stroke-dasharray="2 3"'}/><text x="${pl - 6}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v).toLocaleString("ja-JP")}</text>`;
    hv.forEach((v, i) => {
      const y0 = Y(0),
        y1 = Y(v);
      s += `<rect x="${X(i) - bw / 2}" y="${Math.min(y0, y1)}" width="${bw}" height="${Math.max(0.5, Math.abs(y1 - y0))}" fill="${v >= 0 ? "var(--win)" : "var(--loss)"}" fill-opacity=".3"/>`;
    });
    const path = (a) =>
      a
        .map(
          (v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1),
        )
        .join(" ");
    s += `<path d="${path(sv)}" fill="none" stroke="var(--c2)" stroke-width="1.2" stroke-opacity=".7"/><path d="${path(mv)}" fill="none" stroke="var(--accent)" stroke-width="1.4" stroke-opacity=".75"/>`;
    (marks || []).forEach((mk) => {
      const i = mk.i - st;
      if (i < 0 || i >= n) return;
      const x = X(i);
      s += `<line x1="${x}" x2="${x}" y1="${pt}" y2="${h - pb}" stroke="var(--first)" stroke-width="1" stroke-dasharray="3 3"/>`;
    });
    const xs = niceStep(N - 1, 1, 6);
    for (let v = 0; v <= N - 1; v += xs) {
      const x = X(v - st);
      s += `<text x="${x}" y="${h - 6}" text-anchor="${x < pl + 12 ? "start" : x > w - pr - 12 ? "end" : "middle"}">${v}</text>`;
    }
    el.innerHTML = s + "</svg>";
    let last = null;
    for (let i = n - 1; i > 0; i--) {
      if (Math.sign(hv[i]) !== Math.sign(hv[i - 1]) && hv[i] !== 0) {
        last = { ago: n - 1 - i, up: hv[i] > 0 };
        break;
      }
    }
    const now = hv[n - 1],
      grow = n > 1 && Math.abs(hv[n - 1]) > Math.abs(hv[n - 2]);
    return { now, grow, last };
  }
  /** 移動平均・ボリンジャーバンドの計算期間（戦）。設定で変えられる。 */
  const maN = () => clamp(Math.round(Number(cfg().maN) || 5), 2, 50);
  const bbN = () => clamp(Math.round(Number(cfg().bbN) || 10), 3, 50);
  function bindPeriodInputs() {
    [
      ["#maNIn", "maN"],
      ["#bbNIn", "bbN"],
    ].forEach(([id, key]) => {
      const el = $(id);
      if (document.activeElement !== el)
        el.value = key === "maN" ? maN() : bbN();
    });
  }
  [
    ["#maNIn", "maN"],
    ["#bbNIn", "bbN"],
  ].forEach(([id, key]) =>
    $(id).addEventListener("change", (e) => {
      const v = Math.round(Number(e.target.value));
      cfg()[key] = v > 0 ? v : null;
      saveCfg();
    }),
  );
  function dpSeries(ms) {
    const all = D().matches,
      cum = dpCum().arr;
    const ids = new Set(ms.map((m) => m.id));
    let ptv = [];
    all.forEach((m, i) => {
      if (ids.has(m.id)) ptv.push(cum[i]);
    });
    const fi = all.findIndex((m) => ids.has(m.id));
    const first =
      fi < 0
        ? 0
        : fi > 0
          ? cum[fi - 1]
          : all[0].dp != null && all[0].dp !== ""
            ? Number(all[0].dp) - (Number(all[0].pt) || 0)
            : 0;
    if (ptv.length) ptv = [first].concat(ptv);
    let sv = [],
      last = null,
      firstSv = null,
      seen = false,
      lastRank = null;
    all.forEach((m) => {
      if (ids.has(m.id)) {
        if (!seen) {
          firstSv = last;
          seen = true;
        }
        if (m.silver != null) last = Number(m.silver);
        sv.push(last);
      } else if (m.silver != null) last = Number(m.silver);
      if (m.rank != null) lastRank = m.rank;
    });
    if (ptv.length) sv = [firstSv].concat(sv);
    const ma = ptv.map((v, i) => {
      const a = ptv.slice(Math.max(0, i - (maN() - 1)), i + 1);
      return a.reduce((x, y) => x + y, 0) / a.length;
    });
    return { ptv, sv, ma, last, lastRank };
  }
  /** 上部の小さな DTL 表示（Deck / Tech / Luck の3本の横棒）。 */
  function renderDtlMini() {
    const el = $("#dtlMini"),
      deck = cfg().myDeck;
    let ms = windowMatches();
    if (UI.scope === "all" && deck) ms = ms.filter((m) => m.my === deck);
    const r = deck && ms.length ? computeDTL(ms, deck) : null;
    if (!r) {
      el.innerHTML = "";
      return;
    }
    const rows = [
      ["D", r.deck],
      ["T", r.tech],
      ["L", r.luck],
    ];
    const max = Math.max(0.05, ...rows.map((x) => Math.abs(x[1])));
    el.innerHTML = rows
      .map(([k, v]) => {
        const w = (Math.abs(v) / max) * 50;
        return `<span class="dm-k">${k}</span><span class="dm-t"><i class="${v >= 0 ? "p" : "n"}" style="left:${v >= 0 ? 50 : 50 - w}%;width:${w}%"></i></span><span class="dm-v ${v >= 0 ? "p" : "n"}">${sgn(v, 1)}</span>`;
      })
      .join("");
    el.title = `DTL要因分解（${r.N}戦）：Deck ${sgn(r.deck)} / Tech ${sgn(r.tech)} / Luck ${sgn(r.luck)} pt`;
  }
  function renderSpark() {
    const el = $("#spark");
    if (!el) return;
    const { ptv, sv, ma } = dpSeries(windowMatches());
    const w = Math.max(120, el.clientWidth || 200),
      h = el.clientHeight || 40;
    if (ptv.length < 2) {
      el.innerHTML = "";
      return;
    }
    const svv = [];
    let lo = Math.min(...ptv, ...ma, ...svv),
      hi = Math.max(...ptv, ...ma, ...svv);
    const st = niceStep(hi - lo, 1000, 4);
    lo = Math.floor(lo / st) * st;
    hi = Math.ceil(hi / st) * st;
    if (hi === lo) hi += st;
    const pl = 2,
      pr = 40,
      pt = 3,
      pb = 3;
    const X = (i) => pl + ((w - pl - pr) * i) / (ptv.length - 1),
      Y = (v) => pt + (h - pt - pb) * (1 - (v - lo) / (hi - lo));
    let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="DP推移の縮小グラフ">`;
    for (let v = lo; v <= hi + st / 2; v += st) {
      s += `<line x1="${pl}" x2="${w - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/>`;
    }
    s += `<text x="${w - pr + 4}" y="${pt + 8}">${hi.toLocaleString("ja-JP")}</text><text x="${w - pr + 4}" y="${h - pb}">${lo.toLocaleString("ja-JP")}</text>`;
    let d3 = "",
      prev = null;
    sv.forEach((v, i) => {
      if (v == null) {
        prev = null;
        return;
      }
      const x = X(i).toFixed(1),
        y = Y(v).toFixed(1);
      d3 +=
        prev == null
          ? `M${x} ${y} `
          : `L${x} ${Y(prev).toFixed(1)} L${x} ${y} `;
      prev = v;
    });

    const path = (a) =>
      a
        .map(
          (v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1),
        )
        .join(" ");
    s += `<path class="dash" d="${path(ma)}" fill="none" stroke="var(--c2)" stroke-width="1.2"/>`;
    s += `<path d="${path(ptv)}" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linejoin="round"/>`;
    s += `<circle cx="${X(ptv.length - 1)}" cy="${Y(ptv[ptv.length - 1])}" r="2.5" fill="var(--accent)"/></svg>`;
    el.innerHTML = s;
  }
  /**
   * 連続プレイの判定。1時間以内に3戦以上している対戦のつながりを1回の連続プレイとし、
   * 各試合に { n: 連続何戦目か, start: 連続プレイの開始時刻 } を付ける。
   */
  function sessionInfo() {
    const a = D().matches,
      n = a.length,
      link = new Array(n).fill(false),
      info = {};
    for (let j = 0; j + 2 < n; j++) {
      if (a[j + 2].ts - a[j].ts <= HOUR) {
        link[j + 1] = true;
        link[j + 2] = true;
      }
    }
    let k = 0,
      start = 0;
    a.forEach((m, i) => {
      if (i > 0 && link[i]) k++;
      else {
        k = 1;
        start = m.ts;
      }
      info[m.id] = { n: k, start };
    });
    return info;
  }
  function scopeMatches() {
    let ms = D().matches;
    if (UI.scope === "deck" && cfg().myDeck)
      ms = ms.filter((m) => m.my === cfg().myDeck);
    return ms;
  }
  function fatigue(ms, info) {
    const B = [
      [1, 5],
      [6, 10],
      [11, 15],
      [16, 20],
      [21, 25],
      [26, Infinity],
    ];
    const bk = B.map(([a, b]) => ({ a, b, w: 0, n: 0, mn: 0, mm: 0 }));
    ms.forEach((m) => {
      const k = (info[m.id] || { n: 1 }).n;
      const x = bk.find((o) => k >= o.a && k <= o.b);
      x.n++;
      if (m.win) x.w++;
      if (m.miss != null) {
        x.mn++;
        if (m.miss) x.mm++;
      }
    });
    let best = null,
      mbest = null;
    [6, 11, 16, 21, 26].forEach((k) => {
      const rec = ms.filter((m) => m.miss != null),
        A = rec.filter((m) => (info[m.id] || { n: 1 }).n < k),
        Bm = rec.filter((m) => (info[m.id] || { n: 1 }).n >= k);
      if (A.length < 10 || Bm.length < 5) return;
      const a = A.filter((m) => m.miss).length,
        b = Bm.filter((m) => m.miss).length,
        pA = a / A.length,
        pB = b / Bm.length,
        p = (a + b) / (A.length + Bm.length);
      const se = Math.sqrt(p * (1 - p) * (1 / A.length + 1 / Bm.length)) || 1,
        z = (pB - pA) / se;
      if (
        pB - pA >= 0.05 &&
        pB >= 1.5 * pA &&
        z >= 1.0 &&
        (!mbest || z > mbest.z)
      )
        mbest = { k, pA, pB, nA: A.length, nB: Bm.length, z };
    });
    [6, 11, 16, 21, 26].forEach((k) => {
      const A = ms.filter((m) => (info[m.id] || { n: 1 }).n < k),
        Bm = ms.filter((m) => (info[m.id] || { n: 1 }).n >= k);
      if (A.length < 10 || Bm.length < 5) return;
      const pA = A.filter((m) => m.win).length / A.length,
        pB = Bm.filter((m) => m.win).length / Bm.length,
        p =
          (A.filter((m) => m.win).length + Bm.filter((m) => m.win).length) /
          (A.length + Bm.length);
      const se = Math.sqrt(p * (1 - p) * (1 / A.length + 1 / Bm.length)) || 1,
        z = (pB - pA) / se;
      if (pB - pA <= -0.1 && z <= -1.0 && (!best || z < best.z))
        best = { k, pA, pB, nA: A.length, nB: Bm.length, z };
    });
    return { bk: bk.filter((o) => o.n > 0), warn: best, mwarn: mbest };
  }
  function currentSession(info) {
    const a = D().matches;
    if (!a.length) return null;
    const last = a[a.length - 1];
    if (Date.now() - last.ts > HOUR) return null;
    const s = info[last.id];
    return {
      n: s.n,
      next: s.n + 1,
      start: s.start,
      mins: Math.round((Date.now() - s.start) / 60000),
    };
  }
  /**
   * 今の連続プレイの状態と警告判定。
   * - プレミ: 直近5戦でプレミ2回以上、かつ普段のプレミ率の2倍以上
   * - 勝率:   直近10戦の勝率が普段より20pt以上低い
   * - 長時間: 連続20戦以上または4時間以上（注意のみ）
   * 「普段」は直近10戦を除いた記録から計算し、少ないうちは事前値（勝率50%・プレミ10%）に寄せる。
   */
  function sessionNow(info) {
    const all = D().matches,
      cur = currentSession(info);
    if (!cur) return null;
    const sess = all.slice(-cur.n);
    const rec10 = sess.slice(-10),
      base = scopeMatches().filter((m) => !rec10.includes(m));
    const bw = base.length
      ? (base.filter((m) => m.win).length + 5) / (base.length + 10)
      : 0.5;
    const bm0 = base.filter((m) => m.miss != null),
      bm = bm0.length
        ? (bm0.filter((m) => m.miss).length + 1) / (bm0.length + 10)
        : 0.1;
    const out = { cur, sess, bw, bm, miss: null, win: null, long: null };
    const r5 = sess.slice(-5).filter((m) => m.miss != null),
      mc = r5.filter((m) => m.miss).length;
    if (r5.length >= 3 && mc >= 2 && mc / r5.length >= 2 * bm)
      out.miss = { c: mc, n: r5.length, ratio: mc / r5.length / bm };
    if (sess.length >= 10) {
      const r10 = sess.slice(-10),
        w = r10.filter((m) => m.win).length;
      if (w / 10 <= bw - 0.2) out.win = { w, n: 10, diff: w / 10 - bw };
    }
    const hrs = (Date.now() - cur.start) / HOUR;
    if (cur.n >= 20 || hrs >= 4) out.long = { n: cur.n, h: hrs };
    return out;
  }
  function renderFatigueWarn() {
    const info = sessionInfo(),
      cur = currentSession(info),
      el = $("#fatigueWarn"),
      s = sessionNow(info);
    if (!s) {
      el.hidden = true;
      return cur;
    }
    const parts = [];
    if (s.miss)
      parts.push(
        `直近${s.miss.n}戦でプレミ${s.miss.c}回（普段の約${s.miss.ratio.toFixed(1)}倍）`,
      );
    if (s.win)
      parts.push(
        `直近10戦 ${s.win.w}勝${10 - s.win.w}敗（普段より${Math.round(-s.win.diff * 100)}pt低い）`,
      );
    if (parts.length || s.long) {
      el.hidden = false;
      el.innerHTML = `<b>連続${cur.n}戦・${Math.floor(cur.mins / 60)}時間${cur.mins % 60}分経過。</b>${parts.length ? parts.join("、") + "。休憩を検討してください。" : "長時間続けています。調子の変化に注意してください。"}`;
    } else el.hidden = true;
    return cur;
  }

  function renderFatigue() {
    const info = sessionInfo(),
      f = fatigue(windowMatches(), info);
    const el = $("#chFat"),
      v = $("#fatVerdict");
    if (!f.bk.length) {
      el.innerHTML = "";
      v.textContent = "対戦を記録すると表示されます";
      v.className = "verdict";
      return;
    }
    el.innerHTML = f.bk
      .map((o) => {
        const p = o.w / o.n,
          ci = wilson(o.w, o.n);
        const lab = o.b === Infinity ? `${o.a}戦目〜` : `${o.a}〜${o.b}戦目`;
        return `<div class="wrr"><span class="n">${lab}<small>${o.w}勝${o.n - o.w}敗${o.mn ? ` ・ プレミ${pct(o.mm / o.mn, 0)}` : ""}</small></span><span class="wtrack"><span class="mid"></span><span class="ci" style="left:${ci[0] * 100}%;width:${(ci[1] - ci[0]) * 100}%"></span><span class="pt" style="left:${p * 100}%"></span></span><span class="v">${pct(p, 0)}<small>${o.n}戦</small></span></div>`;
      })
      .join("");
    const ps = [];
    if (f.warn)
      ps.push(
        `連続${f.warn.k}戦目以降は勝率が${pct(f.warn.pA, 0)}→${pct(f.warn.pB, 0)}に下がっています（${f.warn.nB}戦）。`,
      );
    if (f.mwarn)
      ps.push(
        `連続${f.mwarn.k}戦目以降はプレミ率が${pct(f.mwarn.pA, 0)}→${pct(f.mwarn.pB, 0)}に増えています（${f.mwarn.nB}戦）。`,
      );
    const sn = sessionNow(info),
      now = sn
        ? `今の連続プレイ：${sn.cur.n}戦・${Math.floor(sn.cur.mins / 60)}時間${sn.cur.mins % 60}分。${[sn.miss ? `直近${sn.miss.n}戦でプレミ${sn.miss.c}回` : "", sn.win ? `直近10戦 ${sn.win.w}勝${10 - sn.win.w}敗` : ""].filter(Boolean).join("、") || "目立った崩れはなし"}。`
        : "今は連続プレイ中ではありません。";
    v.className = "verdict" + (sn && (sn.miss || sn.win) ? " warn" : "");
    v.innerHTML =
      esc(now) +
      "<br>" +
      (ps.length
        ? "これまでの傾向（参考）：" + ps.join("")
        : "これまでの傾向（参考）：続けて対戦したことによる、はっきりした勝率の低下やプレミの増加はまだ見られません。");
  }
  function renderCharts() {
    bindPeriodInputs();
    const ms = windowMatches();
    const { ptv, sv, ma, last, lastRank } = dpSeries(ms);
    $("#ptSub").textContent = ptv.length
      ? `期間内 ${fmtPt(ptv[ptv.length - 1] - ptv[0])}${lastRank != null ? ` ・ 最新順位 ${lastRank}位` : ""}${last != null && ptv.length ? ` ・ ${targetRank()}位ラインまで ${fmtPt(last - ptv[ptv.length - 1])}` : ""}`
      : "";
    const bands = [
      [2, 0.12],
      [1, 0.18],
    ].map(([k, op]) => Object.assign(boll(ptv, bbN(), k), { op }));
    lineChart($("#chPt"), ptv, {
      h: 300,
      noX: ptv.length >= ({ std: 21, slow: 31 }[UI.macd] || 11),
      bands,
      marks: switchMarks(ms, 0),
      minStep: 1000,
      x0: 0,
      v2: ma,
      v3: sv.some((v) => v != null) ? sv : null,
      fmt: (v) => Math.round(v).toLocaleString("ja-JP"),
      label: "DP推移",
      xmax: ptv.length - 1,
    });
    const MP = {
        fast: [5, 10, 4, "短め"],
        std: [10, 20, 7, "標準"],
        slow: [15, 30, 10, "長め"],
      },
      mp = MP[UI.macd || "fast"];
    $("#macdSeg").innerHTML = Object.entries(MP)
      .map(
        ([k, v]) =>
          `<button data-mp="${k}" aria-pressed="${(UI.macd || "fast") === k}">${v[3]}</button>`,
      )
      .join("");
    $("#macdSub").textContent = `${mp[0]}・${mp[1]}・${mp[2]}戦`;
    const mc = macdChart($("#chMacd"), ptv, switchMarks(ms, 0), mp),
      ve = $("#macdVerdict"),
      parts = [];
    let warn = false;
    {
      const n = ptv.length - 1,
        b1 = boll(ptv, bbN(), 1);
      if (n >= bbN() - 1 && b1.hi[n] != null) {
        const mid = (b1.hi[n] + b1.lo[n]) / 2,
          sd = b1.hi[n] - mid || 1,
          z = (ptv[n] - mid) / sd;
        parts.push(
          "BB：" +
            (z > 2
              ? "+2σ超え（過熱）"
              : z > 1
                ? "+1〜2σ（好調）"
                : z >= -1
                  ? "±1σ内（平常）"
                  : z >= -2
                    ? "−1〜−2σ（不調）"
                    : "−2σ割れ（崩れ）"),
        );
        if (z < -1) warn = true;
      }
    }
    if (mc) {
      parts.push(
        "MACD：" +
          (mc.now >= 0 ? "上向き" : "下向き") +
          (mc.grow ? "・加速" : "・減速") +
          (mc.last
            ? `（${mc.last.ago === 0 ? "直前" : mc.last.ago + "戦前"}に${mc.last.up ? "GC" : "DC"}）`
            : ""),
      );
      if (mc.now < 0) warn = warn || false;
    }
    ve.hidden = !parts.length;
    ve.className = "verdict" + (warn ? " warn" : "");
    ve.textContent = parts.join("　／　");
    renderFatigue();
  }
  function renderEnv() {
    const ms = windowMatches();
    stackChart($("#chStack"), ms);
    rankShare(ms);
    const by = {};
    ms.forEach((m) => {
      (by[m.opp] = by[m.opp] || []).push(m);
    });
    const rows = Object.entries(by).sort((a, b) => b[1].length - a[1].length);
    $("#chWr").innerHTML = rows.length
      ? rows
          .map(([n, a]) => {
            const r = rates(a);
            const ci = wilson(r.w, r.n);
            return `<div class="wrr"><span class="n">${esc(n)}<small>${r.w}勝${r.n - r.w}敗 ・ 先${pct(r.pf, 0)} 後${pct(r.ps, 0)}</small></span><span class="wtrack"><span class="mid"></span><span class="ci" style="left:${ci[0] * 100}%;width:${(ci[1] - ci[0]) * 100}%"></span><span class="pt" style="left:${r.p * 100}%"></span></span><span class="v">${pct(r.p, 0)}<small>${r.n}戦</small></span></div>`;
          })
          .join("")
      : '<div class="empty">対戦を記録すると表示されます</div>';
  }
  function renderSelf() {
    renderVersions();
    const ms = windowMatches(),
      r = rates(ms);
    const tl = [
      ["先攻率", pct(r.f), `${r.nf}／${r.n}戦`],
      ["先攻勝率", pct(r.pf), `${r.nf}戦`],
      ["後攻勝率", pct(r.ps), `${r.ns}戦`],
      [
        "先後の勝率差",
        r.pf != null && r.ps != null ? sgn(r.pf - r.ps, 1) + "pt" : "–",
        "",
      ],
      ["自分の事故率", pct(r.brick), ""],
      ["相手の事故率", pct(r.ob), ""],
      ["プレミ率", pct(r.miss), "プレミ記録のある試合"],
    ];
    $("#chTiles").innerHTML = tl
      .map(
        ([k, v, s]) =>
          `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s || "&nbsp;"}</div></div>`,
      )
      .join("");
  }

  const DEFAULT_RANK_BANDS = [100, 300, 1000, 3000];
  const RANK_PRESETS = {
    上位: [20, 40, 60, 80, 100, 200],
    標準: DEFAULT_RANK_BANDS,
    中位: [500, 750, 1000, 2000, 5000],
  };
  /** 区切りの順位（例：[100, 300]）から、[下限, 上限, 表示名] の順位帯を作る。 */
  function rankBands() {
    const cut = (cfg().rankBands || DEFAULT_RANK_BANDS)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    const out = [];
    let lo = 1;
    cut.forEach((v) => {
      if (v < lo) return;
      out.push([lo, v, lo === 1 ? `〜${v}位` : `${lo}〜${v}位`]);
      lo = v + 1;
    });
    out.push([lo, Infinity, `${lo}位〜`]);
    return out;
  }
  function renderRankBandInput() {
    const el = $("#rankBandIn");
    if (document.activeElement !== el)
      el.value = (cfg().rankBands || DEFAULT_RANK_BANDS).join(", ");
  }
  $("#rankBandIn").addEventListener("change", (e) => {
    const v = e.target.value
      .split(/[,、\s]+/)
      .map((x) => Math.round(Number(x)))
      .filter((x) => x > 0);
    cfg().rankBands = v.length
      ? Array.from(new Set(v)).sort((a, b) => a - b)
      : null;
    saveCfg();
  });
  $("#rankPresets").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-p]");
    if (!b) return;
    cfg().rankBands = RANK_PRESETS[b.dataset.p].slice();
    saveCfg();
  });
  function rankShare(ms) {
    renderRankBandInput();
    const el = $("#chRank"),
      lg = $("#rankLegend");
    const rk = {};
    let lr = null,
      lt = 0;
    D().matches.forEach((m) => {
      if (m.rank != null && m.rank !== "") {
        lr = Number(m.rank);
        lt = m.ts;
      }
      rk[m.id] = lr != null && m.ts - lt <= 3 * HOUR ? lr : null;
    });
    const B = rankBands();
    const withR = ms.filter((m) => rk[m.id] != null);
    if (!withR.length) {
      el.innerHTML =
        '<div class="empty">入力パネルの「順位」を記録すると、順位帯ごとの相手デッキの割合が表示されます。</div>';
      lg.innerHTML = "";
      return;
    }
    const tot = {};
    withR.forEach((m) => (tot[m.opp] = (tot[m.opp] || 0) + 1));
    const top = Object.entries(tot)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map((x) => x[0]);
    const keys = top.concat(
      Object.keys(tot).length > top.length ? ["その他"] : [],
    );
    const col = (k) =>
      k === "その他" ? "var(--c0)" : `var(--c${top.indexOf(k) + 1})`;
    el.innerHTML = B.map(([a, b, lab]) => {
      const g = withR.filter((m) => rk[m.id] >= a && rk[m.id] <= b);
      if (!g.length) return "";
      const c = {};
      g.forEach((m) => {
        const k = top.includes(m.opp) ? m.opp : "その他";
        c[k] = (c[k] || 0) + 1;
      });
      return `<div class="rsr"><span class="n">${lab}</span><span class="rsbar">${keys
        .filter((k) => c[k])
        .map((k) => {
          const p = c[k] / g.length;
          return `<i style="width:${p * 100}%;background:${col(k)}" title="${esc(k)} ${c[k]}戦（${pct(p, 0)}）">${p >= 0.14 ? pct(p, 0) : ""}</i>`;
        })
        .join("")}</span><span class="v">${g.length}戦</span></div>`;
    }).join("");
    lg.innerHTML = keys
      .map((k) => `<span><i style="background:${col(k)}"></i>${esc(k)}</span>`)
      .join("");
  }
  function renderVersions() {
    const deck = cfg().myDeck,
      card = $("#verCard");
    if (!deck) {
      card.hidden = true;
      return;
    }
    let ms = D().matches.filter((m) => m.my === deck);
    if (UI.range === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      ms = ms.filter((m) => m.ts >= d.getTime());
    } else if (UI.range !== "all") ms = ms.slice(-Number(UI.range));
    const vl = verList(deck).filter((v) => ms.some((m) => (m.ver || "") === v));
    card.hidden = !ms.length;
    if (!ms.length) return;
    $("#verSub").textContent = `${deck} ・ 期間フィルターのみ反映`;
    const tot = rates(ms),
      row = (lab, a) => {
        const r = rates(a),
          dp = a.reduce((x, m) => x + (Number(m.pt) || 0), 0);
        return `<td>${a.length}</td><td>${r.w}-${r.n - r.w}</td><td>${pct(r.p)}</td><td>${pct(r.pf, 0)}</td><td>${pct(r.ps, 0)}</td><td>${fmtPt(dp)}</td>`;
      };
    $("#verTable").innerHTML =
      `<table class="t"><thead><tr><th>バージョン</th><th>期間</th><th>試合</th><th>勝敗</th><th>勝率</th><th>先攻勝率</th><th>後攻勝率</th><th>DP</th></tr></thead><tbody>${vl
        .map((v) => {
          const a = ms.filter((m) => (m.ver || "") === v);
          return `<tr><td>${esc(v)}</td><td>${fmtT(a[0].ts)}〜${fmtT(a[a.length - 1].ts)}</td>${row(v, a)}</tr>`;
        })
        .join(
          "",
        )}<tr class="sum"><td>総合</td><td></td>${row("all", ms)}</tr></tbody></table>`;
    if (vl.length < 2) {
      $("#verMatrix").innerHTML = "";
      return;
    }
    const opps = Object.entries(
      ms.reduce((o, m) => ((o[m.opp] = (o[m.opp] || 0) + 1), o), {}),
    )
      .sort((a, b) => b[1] - a[1])
      .map((x) => x[0]);
    $("#verMatrix").innerHTML =
      `<table class="t"><thead><tr><th>相手別の勝率</th>${vl.map((v) => `<th>${esc(v)}</th>`).join("")}<th>総合</th></tr></thead><tbody>${opps
        .map((o) => {
          const cell = (a) => {
            const r = rates(a);
            return r.n
              ? `${pct(r.p, 0)}<small style="color:var(--muted)"> (${r.n})</small>`
              : "–";
          };
          return `<tr><td>${esc(o)}</td>${vl.map((v) => `<td>${cell(ms.filter((m) => m.opp === o && (m.ver || "") === v))}</td>`).join("")}<td>${cell(ms.filter((m) => m.opp === o))}</td></tr>`;
        })
        .join("")}</tbody></table>`;
  }
  function stackChart(el, ms) {
    const lg = $("#stackLegend");
    if (!ms.length) {
      el.innerHTML = '<div class="empty">対戦を記録すると表示されます</div>';
      lg.innerHTML = "";
      return;
    }
    const tot = {};
    ms.forEach((m) => (tot[m.opp] = (tot[m.opp] || 0) + 1));
    // 下から順に：ベンチマークの参照シェアが大きいデッキ → それ以外は実戦で初めて当たった順
    const E = envRows(),
      share = (n) => (E[n] && num(E[n].b) != null ? num(E[n].b) : -1);
    const benchDecks = Object.keys(tot)
      .filter((n) => share(n) >= 0)
      .sort((a, b) => share(b) - share(a));
    const restDecks = [];
    ms.forEach((m) => {
      if (share(m.opp) < 0 && !restDecks.includes(m.opp)) restDecks.push(m.opp);
    });
    const keys = benchDecks.concat(restDecks);
    const palette = [
      "var(--c1)",
      "var(--c2)",
      "var(--c3)",
      "var(--c4)",
      "var(--c5)",
      "var(--c6)",
    ];
    const col = (k) => {
      const i = keys.indexOf(k);
      return i < palette.length ? palette[i] : `hsl(${(i * 47) % 360} 45% 55%)`;
    };
    const key = (m) => m.opp;
    const pts = ms.map((m, i) => {
      const c = {};
      keys.forEach((k) => (c[k] = 0));
      ms.slice(Math.max(0, i - 9), i + 1).forEach((x) => c[key(x)]++);
      return c;
    });
    const w = Math.max(260, el.clientWidth || 600),
      h = 200,
      pl = 34,
      pr = 10,
      pt = 10,
      pb = 24,
      n = pts.length;
    const X = (i) =>
        n < 2 ? (pl + w - pr) / 2 : pl + ((w - pl - pr) * i) / (n - 1),
      Y = (v) => pt + (h - pt - pb) * (1 - v / 10);
    let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="直近10戦の相手デッキ内訳の推移">`;
    [0, 5, 10].forEach((t) => {
      s += `<line x1="${pl}" x2="${w - pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 6}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`;
    });
    const base = pts.map(() => 0);
    keys.forEach((k) => {
      const lo = base.slice(),
        hi = base.map((b, i) => b + pts[i][k]);
      if (hi.every((v, i) => v === lo[i])) return;
      let d;
      if (n < 2) {
        const x0 = X(0) - 12,
          x1 = X(0) + 12;
        d = `M${x0} ${Y(hi[0])} L${x1} ${Y(hi[0])} L${x1} ${Y(lo[0])} L${x0} ${Y(lo[0])} Z`;
      } else
        d =
          hi
            .map(
              (v, i) =>
                (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1),
            )
            .join(" ") +
          " " +
          lo
            .map((v, i) => i)
            .reverse()
            .map((i) => "L" + X(i).toFixed(1) + " " + Y(lo[i]).toFixed(1))
            .join(" ") +
          " Z";
      s += `<path d="${d}" fill="${col(k)}" fill-opacity=".85" stroke="var(--panel)" stroke-width=".6"><title>${esc(k)}</title></path>`;
      hi.forEach((v, i) => (base[i] = v));
    });
    switchMarks(ms, 0).forEach((mk) => {
      const x = (X(mk.i - 1) + X(mk.i)) / 2;
      s += `<line x1="${x}" x2="${x}" y1="${pt}" y2="${h - pb}" stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 3"/><text x="${x + 3}" y="${pt + 10}" style="fill:var(--ink)">${esc(mk.label)}</text>`;
    });
    const lab = [0, Math.floor((n - 1) / 2), n - 1].filter(
      (v, i, a) => a.indexOf(v) === i,
    );
    lab.forEach((i, j) => {
      s += `<text x="${X(i)}" y="${h - 6}" text-anchor="${n < 2 ? "middle" : j === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${fmtT(ms[i].ts)}</text>`;
    });

    // 直近10戦の「構築で勝ち／構築で負け」の数（構築が合っているかの目安）
    const bW = ms.map(
        (m, i) =>
          ms
            .slice(Math.max(0, i - 9), i + 1)
            .filter((x) => !x.brick && Number(x.build) > 0).length,
      ),
      bL = ms.map(
        (m, i) =>
          ms
            .slice(Math.max(0, i - 9), i + 1)
            .filter((x) => !x.brick && Number(x.build) < 0).length,
      );
    const h2 = 64,
      top2 = 6,
      bot2 = 14,
      bmax = Math.max(3, ...bW, ...bL);
    const Y2 = (v) => top2 + (h2 - top2 - bot2) * (1 - v / bmax);
    let s2 = `<svg width="${w}" height="${h2}" viewBox="0 0 ${w} ${h2}" role="img" aria-label="直近10戦の構築勝ち・構築負けの数">`;
    [0, bmax].forEach(
      (t) =>
        (s2 += `<line x1="${pl}" x2="${w - pr}" y1="${Y2(t)}" y2="${Y2(t)}" stroke="var(--line)" stroke-width="1"${t ? ' stroke-dasharray="2 3"' : ""}/><text x="${pl - 6}" y="${Y2(t) + 4}" text-anchor="end">${t}</text>`),
    );
    const line2 = (a) =>
      a
        .map(
          (v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y2(v).toFixed(1),
        )
        .join(" ");
    s2 += `<path d="${line2(bW)}" fill="none" stroke="var(--win)" stroke-width="1.8"/><path d="${line2(bL)}" fill="none" stroke="var(--loss)" stroke-width="1.8"/>`;
    s2 += `<text x="${pl}" y="${h2 - 2}">構築で勝ち／構築で負け（直近10戦）</text></svg>`;
    el.innerHTML = s + "</svg>" + s2;
    const now = pts[n - 1];
    lg.innerHTML =
      keys
        .filter((k) => now[k] > 0 || tot[k])
        .map(
          (k) =>
            `<span><i style="background:${col(k)}"></i>${esc(k)} <b class="num">${now[k]}</b></span>`,
        )
        .join("") + "<span>（数字は最新の10戦）</span>";
  }

  /* ---------- DTL 要因分解 ---------- */
  const sig = (x) => 1 / (1 + Math.exp(-x)),
    logit = (p) => {
      p = clamp(p, 0.01, 0.99);
      return Math.log(p / (1 - p));
    };
  const num = (v) =>
    v === "" || v == null || !isFinite(Number(v)) ? null : Number(v);
  function envRows() {
    const c = cfg();
    if (c.env && c.env.rows) return c.env.rows;
    const out = {},
      bn = c.bench || {};
    [c.myDeck].concat(Object.keys(bn)).forEach((k) => {
      const bb = bn[k];
      if (!bb) return;
      Object.entries(bb.rows || {}).forEach(([n, r]) => {
        if (!out[n]) out[n] = { b: num(r.b), omega: num(r.omega) };
      });
      if (k === c.myDeck && num(bb.omega) != null) {
        out[k] = out[k] || { b: null, omega: null };
        if (out[k].omega == null) out[k].omega = num(bb.omega);
      }
    });
    return out;
  }
  function qRows(deck) {
    const bb = (cfg().bench || {})[deck];
    const o = {};
    Object.entries((bb && bb.rows) || {}).forEach(([n, r]) => {
      if (r && num(r.q) != null) o[n] = num(r.q);
    });
    return o;
  }
  /**
   * 使用デッキがベンチマーク外のとき、そのデッキを「その他」とみなした値を逆算する。
   *   同デッキ勝率 q(その他→X) = 100 − q(X→その他)（X のベンチマークから deriveOther で求めた値）
   *   環境勝率 ω(その他)       = (50 − Σ b·ω) ÷ b(その他)
   */
  function otherProfile() {
    const E = envRows(),
      q = {};
    let omega = null;
    Object.keys(E).forEach((x) => {
      const ox = deriveOther(E, qRows(x), num(E[x].omega), x);
      if (ox && ox.q != null) q[x] = Math.round((100 - ox.q) * 10) / 10;
      if (ox && ox.omega != null) omega = Math.round(ox.omega * 10) / 10;
    });
    return { q, omega };
  }
  const isOffBench = (deck) => !!deck && !envRows()[deck];

  const OTHER = "その他";
  /**
   * ベンチマークに登録されていないデッキをまとめた「その他」の値を逆算する。
   *   シェア      : 100% − 登録シェア合計
   *   環境勝率 ω  : Σ b·ω = 50% から
   *   同デッキ勝率: ω自分 = Σ b·q から
   */
  function deriveOther(E, Q, wMe, deck) {
    const L = Object.keys(E).filter((n) => n !== OTHER);
    if (!L.length) return null;
    const bs = L.map((n) => num(E[n].b)),
      res = { b: null, q: null, omega: null, bWhy: "", qWhy: "", oWhy: "" };
    if (bs.some((v) => v == null))
      res.bWhy = "参照シェアが空欄の行があるため、その他のシェアを出せません";
    else {
      const sb = bs.reduce((a, b) => a + b, 0);
      res.b = Math.max(0, 100 - sb);
      if (sb >= 100)
        res.bWhy = "登録デッキの参照シェア合計が100%以上のため、その他は0%です";
    }
    if (res.b > 0) {
      const qs = L.map((n) => (Q[n] != null ? Q[n] : n === deck ? 50 : null));
      if (wMe != null && qs.every((v) => v != null)) {
        const v =
          (wMe - L.reduce((x, n, i) => x + bs[i] * qs[i], 0) / 100) /
          (res.b / 100);
        res.q = clamp(v, 5, 95);
        if (Math.abs(v - res.q) > 1e-9)
          res.qWhy = `逆算値${v.toFixed(1)}%が範囲外のため${res.q}%に丸めました`;
      } else
        res.qWhy =
          wMe == null
            ? "環境データに自デッキの環境勝率ωが必要です"
            : "全行の同デッキ勝率が必要です";
      const os = L.map((n) => num(E[n].omega));
      if (os.every((v) => v != null)) {
        const v =
          (50 - L.reduce((x, n, i) => x + bs[i] * os[i], 0) / 100) /
          (res.b / 100);
        res.omega = clamp(v, 5, 95);
        if (Math.abs(v - res.omega) > 1e-9)
          res.oWhy = `逆算値${v.toFixed(1)}%が範囲外のため${res.omega}%に丸めました`;
      } else res.oWhy = "全行の環境勝率ωが必要です";
    }
    return res;
  }

  /**
   * DTL 要因分解。勝率 − 50% を Deck / Tech / Luck に残差なく分解する。
   *   Deck = 基礎力 (ω自分 − ½) + 環境強度 Σ s(q̂ − ω自分) + メタ相性 Σ s·γ
   *          q̂ = σ(logit ω自分 − logit ω相手), γ = q − q̂
   *   Luck = 先後 Σ s(f − ½)(pᶠ − pˢ) + 事故 Σ s(a − ā)(x事故 − x通常)
   *   Tech = (勝率 − ½) − Deck − Luck   （うち構築力 = Σ s(p − p通常)、残りがプレイ力）
   * 試合数の少ない対面の勝率は、全体の値に2試合分寄せて使う（ベイズ縮小）。
   */
  function computeDTL(ms, deck) {
    const N = ms.length;
    if (!N) return null;
    const W = ms.filter((m) => m.win).length,
      pbar = W / N;
    const K = 2;
    const shr = (w, n, prior) => (w + K * prior) / (n + K);
    const fm = ms.filter((m) => m.first),
      sm = ms.filter((m) => !m.first);
    const pF0 = shr(fm.filter((m) => m.win).length, fm.length, pbar),
      pS0 = shr(sm.filter((m) => m.win).length, sm.length, pbar);
    const B = ms.filter((m) => m.brick),
      NB = ms.filter((m) => !m.brick);
    const xB = shr(B.filter((m) => m.win).length, B.length, 0.2),
      xN = shr(NB.filter((m) => m.win).length, NB.length, pbar);
    const ref = D().matches.filter(
      (m) => m.my === deck && (m.ver || "") === (ms[ms.length - 1].ver || ""),
    );
    const isFlag = (m) => !m.brick && (Number(m.build) || 0) !== 0;
    const NF = ms.filter((m) => !isFlag(m)),
      pNF0 = NF.length ? NF.filter((m) => m.win).length / NF.length : pbar;
    const abar0 = ref.length
      ? ref.filter((m) => m.brick).length / ref.length
      : B.length / N;
    // 事故率の基準：先攻・後攻それぞれの理論値。未設定の側は実績（先後共通）で代用する
    const verNow = ms[ms.length - 1].ver || "",
      thF = brickTheory(deck, verNow, "first"),
      thS = brickTheory(deck, verNow, "second");
    const aF = thF != null ? thF / 100 : abar0,
      aS = thS != null ? thS / 100 : abar0,
      theory = thF ?? thS;
    let abar = 0;
    const E = envRows(),
      off = isOffBench(deck),
      op = off ? otherProfile() : null,
      Q = off ? Object.assign({}, op.q, qRows(deck)) : qRows(deck),
      wMe = E[deck] ? num(E[deck].omega) : off ? op.omega : null;
    const omMe = wMe == null ? 0.5 : wMe / 100;
    const od = deriveOther(E, Q, wMe, deck),
      listed = new Set(Object.keys(E).concat(Object.keys(Q)));
    const keyOf = (m) => (od ? (listed.has(m.opp) ? m.opp : OTHER) : m.opp);
    const pooled = new Set();
    const by = {};
    ms.forEach((m) => {
      const k = keyOf(m);
      if (k === OTHER && m.opp !== OTHER) pooled.add(m.opp);
      (by[k] = by[k] || []).push(m);
    });
    const names = Object.keys(by).sort(
      (a, b) => (a === OTHER) - (b === OTHER) || by[b].length - by[a].length,
    );
    const Kn = names.length;
    let rawB = names.map((n) => {
      if (od && n === OTHER && od.b != null) return od.b;
      const v = E[n] ? num(E[n].b) : null;
      return v == null ? 100 / Kn : Math.max(0, v);
    });
    const sb = rawB.reduce((a, b) => a + b, 0) || 1;
    const subs = [];
    const R = names.map((n, i) => {
      const a = by[n],
        n_ = a.length,
        s = n_ / N,
        w = a.filter((m) => m.win).length,
        p = n_ ? w / n_ : null;
      const f_ = a.filter((m) => m.first),
        s_ = a.filter((m) => !m.first);
      const f = n_ ? f_.length / n_ : 0.5,
        pF = shr(f_.filter((m) => m.win).length, f_.length, pF0),
        pS = shr(s_.filter((m) => m.win).length, s_.length, pS0);
      const abarI = f * aF + (1 - f) * aS;
      abar += s * abarI;
      const ai = n_ ? a.filter((m) => m.brick).length / n_ : abarI;
      const isO = od && n === OTHER;
      const row = isO
        ? { q: od.q, omega: od.omega }
        : {
            q: Q[n] != null ? Q[n] : n === deck ? 50 : null,
            omega: E[n] ? E[n].omega : null,
          };
      let q = num(row.q);
      let qsub = false;
      if (q == null) {
        q = shr(w, n_, pbar);
        qsub = true;
        subs.push(n);
      } else q = q / 100;
      const om = num(row.omega);
      const est =
        (isO && od.q != null) ||
        (off && qRows(deck)[n] == null && op.q[n] != null);
      const qhat = sig(logit(omMe) - logit(om == null ? 0.5 : om / 100));
      return {
        n,
        cnt: n_,
        s,
        b: rawB[i] / sb,
        p,
        q,
        qsub,
        est,
        qhat,
        rF: f_.length ? f_.filter((m) => m.win).length / f_.length : null,
        rS: s_.length ? s_.filter((m) => m.win).length / s_.length : null,
        nF: f_.length,
        nS: s_.length,
        gamma: q - qhat,
        f,
        pF,
        pS,
        a: ai,
        coin: s * (f - 0.5) * (pF - pS),
        brick: s * (ai - abarI) * (xB - xN),
        build: (() => {
          const nf = a.filter((m) => !isFlag(m)),
            pnf = shr(nf.filter((m) => m.win).length, nf.length, pNF0);
          return (
            a.filter(isFlag).reduce((x, m) => x + ((m.win ? 1 : 0) - pnf), 0) /
            N
          );
        })(),
      };
    });
    R.forEach((r) => {
      r.base = r.s * (omMe - 0.5);
      r.field = r.s * (r.qhat - omMe);
      r.meta = r.s * r.gamma;
      r.deck = r.base + r.field + r.meta;
      r.luck = r.coin + r.brick;
      r.tech = r.cnt ? r.s * (r.p - r.q) - r.luck : 0;
      r.play = r.tech - r.build;
      r.tot = r.deck + r.tech + r.luck;
    });
    const S = (k) => R.reduce((x, r) => x + r[k], 0);
    return {
      N,
      pbar,
      abar,
      abarTheory: theory != null,
      aF,
      aS,
      offBench: off,
      xB,
      xN,
      R,
      subs,
      od,
      pooled: Array.from(pooled),
      omSet: wMe != null,
      tot: pbar - 0.5,
      base: S("base"),
      field: S("field"),
      meta: S("meta"),
      deck: S("deck"),
      build: S("build"),
      play: S("play"),
      tech: S("tech"),
      coin: S("coin"),
      brick: S("brick"),
      luck: S("luck"),
    };
  }
  function drow(name, v, max, cls) {
    const w = max ? (Math.abs(v) / max) * 50 : 0;
    const left = v >= 0 ? 50 : 50 - w;
    return `<div class="drow ${cls}"><span class="nm">${name}</span><span class="dtrack"><span class="z"></span><i class="${v >= 0 ? "p" : "n"}" style="left:${left}%;width:${w}%"></i></span><span class="v ${v >= 0 ? "p" : "n"}">${sgn(v)}</span></div>`;
  }
  function renderDTL() {
    const deck = cfg().myDeck;
    let ms = windowMatches();
    if (UI.scope === "all" && deck) ms = ms.filter((m) => m.my === deck);
    const main = $("#dtlMain");
    if (!deck) {
      main.innerHTML =
        '<div class="empty">上部で使用デッキを選ぶと、そのデッキの要因分解を表示します。</div>';
      $("#dtlTable").innerHTML = "";
      renderBench([]);
      return;
    }
    const r = computeDTL(ms, deck);
    if (!r) {
      main.innerHTML = `<div class="empty">${esc(deck)} の対戦がまだありません。記録すると勝率を Deck・Tech・Luck に分解します。</div>`;
      $("#dtlTable").innerHTML = "";
      renderBench([]);
      return;
    }
    const max = Math.max(
      ...[
        "deck",
        "tech",
        "luck",
        "base",
        "field",
        "meta",
        "build",
        "play",
        "coin",
        "brick",
      ].map((k) => Math.abs(r[k])),
      0.001,
    );
    main.innerHTML = `<div class="card-h"><h2>DTL要因分解</h2><span class="sub">${esc(deck)} ・ ${r.N}戦</span></div>
  <div class="total"><span class="big">${sgn(r.tot)}<span style="font-size:16px">pt</span></span><span class="sub">勝率 ${pct(r.pbar)} − 50%</span></div>
  <div class="dtl">
   <div class="grp">${drow("Deck<small>デッキの強さ</small>", r.deck, max, "head")}${drow("基礎力", r.base, max, "sub")}${drow("環境強度", r.field, max, "sub")}${drow("メタ相性", r.meta, max, "sub")}</div>
   <div class="grp">${drow("Tech<small>プレイヤーの強さ</small>", r.tech, max, "head")}${drow("構築力", r.build, max, "sub")}${drow("プレイ力", r.play, max, "sub")}</div>
   <div class="grp">${drow("Luck<small>運の強さ</small>", r.luck, max, "head")}${drow("先後", r.coin, max, "sub")}${drow("事故", r.brick, max, "sub")}</div>
  </div>
  <div class="notes">
   ${r.N < 30 ? `<p>試合数が${r.N}戦と少ないため、値は大きくぶれます。30戦以上を目安にしてください。</p>` : ""}
   ${r.subs.length ? `<p>同デッキ勝率が未入力の相手（${r.subs.map(esc).join("、")}）は自分の勝率で代用しています。その分 Tech が0に近づきます。</p>` : ""}
   ${r.od ? `<p>ベンチマークにないデッキ${r.pooled.length ? `（${r.pooled.map(esc).join("、")}）` : ""}は「その他」にまとめ、その他の値は登録デッキから逆算しています。${[r.od.bWhy, r.od.qWhy, r.od.oWhy].filter(Boolean).map(esc).join("。")}</p>` : ""}
   ${(() => {
     const bw = ms.filter((m) => !m.brick && Number(m.build) > 0).length,
       bl = ms.filter((m) => !m.brick && Number(m.build) < 0).length;
     return bw + bl
       ? `<p>構築力は自己申告のフラグに基づくため、勝った試合ほど「構築のおかげ」と付けやすく、高めに出やすい傾向があります（構築で勝ち ${bw}件・構築で負け ${bl}件）。負けた試合にも同じ基準で付けると精度が上がります。</p>`
       : "";
   })()}
   ${r.offBench ? `<p>使用デッキ（${esc(deck)}）はベンチマークにないため「その他」とみなし、同デッキ勝率と環境勝率を、ほかのデッキのベンチマークから逆算しています（「推」の印）。</p>` : ""}
   ${!r.omSet ? `<p>ベンチマークの環境データに自デッキ（${esc(deck)}）の環境勝率ωがないため50%として扱い、基礎力は0になります。</p>` : ""}
   <p>事故の基準率 先攻 ${pct(r.aF)}・後攻 ${pct(r.aS)}${r.abarTheory ? "（理論値。未設定の側は実績）" : "（同デッキ・同バージョン全期間の実績）"}、事故時勝率 ${pct(r.xB)}、通常時勝率 ${pct(r.xN)}。プレイ力は Tech から構築力を引いた残りです。</p>
  </div>`;
    // 色の工夫：実シェア＝棒の長さ、勝率＝50%を境に緑／赤の濃淡、Deck・Tech・Luck＝中央から左右に伸びる棒
    const maxS = Math.max(0.01, ...r.R.map((x) => x.s)),
      detail = !!UI.dtlDetail,
      keys = detail
        ? ["base", "field", "meta", "build", "play", "coin", "brick", "tot"]
        : ["deck", "tech", "luck", "tot"],
      maxV = Math.max(
        0.005,
        ...keys.map((k) => Math.abs(r[k])),
        ...r.R.flatMap((x) => keys.map((k) => Math.abs(x[k]))),
      );
    const soft = (col, pc) => `color-mix(in srgb, ${col} ${pc}%, transparent)`;
    const sb = (s) => {
      const w = (s / maxS) * 100;
      return `<td class="sbar" style="background:linear-gradient(90deg, ${soft("var(--accent)", 22)} ${w}%, transparent ${w}%)">${pct(s, 0)}</td>`;
    };
    const ht = (p, text) =>
      p == null
        ? `<td>${text}</td>`
        : `<td style="background:${soft(p >= 0.5 ? "var(--win)" : "var(--loss)", Math.round(Math.min(1, Math.abs(p - 0.5) / 0.3) * 38))}">${text}</td>`;
    const db = (v, g1) => {
      const w = (Math.abs(v) / maxV) * 50,
        col = soft(v >= 0 ? "var(--win)" : "var(--loss)", 32),
        a = v >= 0 ? 50 : 50 - w,
        b = v >= 0 ? 50 + w : 50;
      return `<td class="${v >= 0 ? "pos" : "neg"}${g1 ? " g1" : ""}" style="background:linear-gradient(90deg, transparent calc(50% - 0.5px), var(--line) calc(50% - 0.5px), var(--line) calc(50% + 0.5px), transparent calc(50% + 0.5px)), linear-gradient(90deg, transparent ${a}%, ${col} ${a}%, ${col} ${b}%, transparent ${b}%)">${sgn(v)}</td>`;
    };
    const nn = (n) => `<small style="color:var(--muted)"> (${n})</small>`;
    const fA = ms.filter((m) => m.first),
      sA = ms.filter((m) => !m.first),
      rt = (a) => (a.length ? a.filter((m) => m.win).length / a.length : null);
    const base7 = [
      "相手",
      "試合",
      "実シェア",
      "自勝率",
      "先攻勝率",
      "後攻勝率",
      "同デッキ",
    ];
    const thead = detail
      ? `<tr>${base7.map((h) => `<th rowspan="2">${h}</th>`).join("")}<th colspan="3" class="gh g1">Deck</th><th colspan="2" class="gh g1">Tech</th><th colspan="2" class="gh g1">Luck</th><th rowspan="2" class="g1">計</th></tr><tr><th class="sub g1">基礎力</th><th class="sub">環境強度</th><th class="sub">メタ相性</th><th class="sub g1">構築力</th><th class="sub">プレイ力</th><th class="sub g1">先後</th><th class="sub">事故</th></tr>`
      : `<tr>${base7.map((h) => `<th>${h}</th>`).join("")}<th>Deck</th><th>Tech</th><th>Luck</th><th>計</th></tr>`;
    const gstart = detail
      ? new Set(["base", "build", "coin", "tot"])
      : new Set();
    $("#dtlTable").innerHTML =
      `<table class="t dtlt${detail ? " detail" : ""}"><thead>${thead}</thead><tbody>
  ${r.R.map((x) => `<tr><td>${esc(x.n)}</td><td>${x.cnt}</td>${sb(x.s)}${ht(x.cnt ? x.p : null, x.cnt ? pct(x.p, 0) : "–")}${ht(x.nF ? x.rF : null, x.nF ? pct(x.rF, 0) + nn(x.nF) : "–")}${ht(x.nS ? x.rS : null, x.nS ? pct(x.rS, 0) + nn(x.nS) : "–")}${ht(x.q, pct(x.q, 0) + (x.qsub ? '<span class="sub-mark">代</span>' : x.est ? '<span class="sub-mark">推</span>' : ""))}${keys.map((k) => db(x[k], gstart.has(k))).join("")}</tr>`).join("")}
  <tr class="sum"><td>合計</td><td>${r.N}</td><td>100%</td>${ht(r.pbar, pct(r.pbar, 0))}${ht(rt(fA), fA.length ? pct(rt(fA), 0) : "–")}${ht(rt(sA), sA.length ? pct(rt(sA), 0) : "–")}<td></td>${keys.map((k) => db(r[k], gstart.has(k))).join("")}</tr></tbody></table>
  <div class="legend dtlleg"><span><i style="background:${soft("var(--accent)", 30)}"></i>実シェア＝棒の長さ</span><span><i style="background:${soft("var(--win)", 40)}"></i><i style="background:${soft("var(--loss)", 40)}"></i>勝率＝50%より上は緑・下は赤（濃いほど差が大きい）</span><span>Deck・Tech・Luck＝中央の線から右がプラス、左がマイナス</span></div>`;
    $$("#dtlMode button").forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.m === (detail ? "1" : "0")),
      ),
    );
    renderBench(r.R.map((x) => x.n));
  }
  let benchDirty = false,
    benchExtra = [],
    benchRemoved = [];
  function benchSnapshot() {
    const rows = {};
    $$("#benchTable tr[data-n]").forEach((tr) => {
      const o = {};
      tr.querySelectorAll("input").forEach((i) => {
        o[i.dataset.k] = num(i.value);
      });
      rows[tr.dataset.n] = o;
    });
    return rows;
  }
  function renderBench(names) {
    const deck = cfg().myDeck;
    $("#benchSub").textContent = deck
      ? `環境データ（共通） ＋ ${deck} の同デッキ勝率`
      : "";
    if (benchDirty) return;
    const E = envRows(),
      Q = qRows(deck),
      op = isOffBench(deck) ? otherProfile() : null;
    const rb = (n) => {
      const v = E[n] ? num(E[n].b) : null;
      return v == null ? -1 : v;
    };
    const all = Array.from(
      new Set(
        Object.keys(E)
          .concat(Object.keys(Q))
          .sort((x, y) => rb(y) - rb(x))
          .concat(benchExtra),
      ),
    ).filter((n) => n && n !== OTHER && !benchRemoved.includes(n));
    $("#benchList").innerHTML = cfg()
      .decks.map((n) => `<option value="${esc(n)}"></option>`)
      .join("");
    if (!all.length) {
      $("#benchTable").innerHTML =
        '<div class="empty">ベンチマークのあるデッキを、下の欄から追加してください。自デッキの行も入れると、自デッキの環境勝率として使います。</div>';
      return;
    }
    const v = (x) => (x == null ? "" : esc(x));
    const od = deriveOther(
        E,
        op ? Object.assign({}, op.q, Q) : Q,
        E[deck] ? num(E[deck].omega) : op ? op.omega : null,
        deck,
      ),
      f = (x) => (x == null ? "–" : Math.round(x * 10) / 10 + "");
    $("#benchTable").innerHTML =
      `<table class="t bt"><thead><tr><th></th><th class="gc" colspan="2">環境データ（共通）</th><th class="gm">${deck ? esc(deck) + (op ? " 用（その他として推計）" : " 用") : "デッキ別"}</th><th></th></tr>
  <tr><th>デッキ</th><th>参照シェア%</th><th>環境勝率ω%</th><th>同デッキ勝率%</th><th></th></tr></thead><tbody>${all
    .map((n, i) => {
      const e = E[n] || {},
        self = n === deck;
      return `<tr data-n="${esc(n)}"${self ? ' class="self"' : ""}><td>${esc(n)}${self ? "<small>自デッキ</small>" : ""}</td><td><input type="number" inputmode="decimal" step="0.1" id="bb${i}" data-k="b" value="${v(e.b)}" placeholder="任意"></td><td><input type="number" inputmode="decimal" step="0.1" id="bo${i}" data-k="omega" value="${v(e.omega)}" placeholder="50"></td><td class="mine"><input type="number" inputmode="decimal" step="0.1" id="bq${i}" data-k="q" value="${v(Q[n])}" placeholder="${self ? "50（ミラー）" : op && op.q[n] != null ? "推計 " + op.q[n] : "代用"}"${deck ? "" : " disabled"}></td><td><button class="btn small" data-brm="${esc(n)}" aria-label="${esc(n)}の行を削除">×</button></td></tr>`;
    })
    .join("")}
  ${od ? `<tr><td>その他<span class="sub-mark">推計</span></td><td>${f(od.b)}</td><td>${f(od.omega)}</td><td class="mine">${f(od.q)}</td><td></td></tr><tr><td colspan="5" style="text-align:left;white-space:normal;font-family:var(--f-body);color:var(--muted);font-size:12px">登録していないデッキはまとめて「その他」として扱い、上の行から逆算します（保存後に再計算）。${[od.bWhy, od.oWhy, od.qWhy].filter(Boolean).map(esc).join("。")}</td></tr>` : ""}</tbody></table>`;
  }

  document.addEventListener("input", (e) => {
    if (e.target.closest("#benchTable")) {
      benchDirty = true;
      $("#benchMsg").textContent = "未保存の変更があります";
    }
  });
  $("#benchSave").onclick = async () => {
    const deck = cfg().myDeck;
    if (!deck) {
      $("#benchMsg").textContent = "先に上部で使用デッキを選んでください";
      return;
    }
    const snap = benchSnapshot(),
      env = {},
      qs = {};
    Object.entries(snap).forEach(([n, o]) => {
      env[n] = { b: o.b, omega: o.omega };
      if (o.q != null) qs[n] = { q: o.q };
    });
    const c = cfg();
    c.env = { rows: env };
    c.bench = Object.assign({}, c.bench || {});
    c.bench[deck] = { rows: qs };
    benchDirty = false;
    benchExtra = [];
    benchRemoved = [];
    $("#benchMsg").textContent = "保存しました";
    await saveCfg();
  };
  $("#benchAdd").onclick = () => {
    const n = ($("#benchNew").value || "").trim();
    if (!n) return;
    const keep = benchDirty ? benchSnapshot() : null;
    if (!benchExtra.includes(n)) benchExtra.push(n);
    benchRemoved = benchRemoved.filter((x) => x !== n);
    $("#benchNew").value = "";
    benchDirty = false;
    renderDTL();
    if (keep) {
      Object.entries(keep).forEach(([nm, o]) => {
        const tr = $$("#benchTable tr[data-n]").find((t) => t.dataset.n === nm);
        if (tr)
          tr.querySelectorAll("input").forEach((i) => {
            if (o[i.dataset.k] != null) i.value = o[i.dataset.k];
          });
      });
      benchDirty = true;
    }
    $("#benchMsg").textContent = "未保存の変更があります";
    benchDirty = true;
  };
  onEnter($("#benchNew"), () => $("#benchAdd").click());
  $("#benchTable").addEventListener("click", (e) => {
    const b = e.target.closest("[data-brm]");
    if (!b) return;
    const n = b.dataset.brm;
    b.closest("tr").remove();
    benchExtra = benchExtra.filter((x) => x !== n);
    if (!benchRemoved.includes(n)) benchRemoved.push(n);
    benchDirty = true;
    $("#benchMsg").textContent = "未保存の変更があります（保存で確定）";
  });

  /* ---------- 設定 ---------- */
  function renderData() {
    const c = cfg();
    if (
      UI.renIdx != null &&
      document.activeElement &&
      document.activeElement.id === "renIn"
    )
      UI.renVal = document.activeElement.value;
    $("#deckList").innerHTML = c.decks.length
      ? c.decks
          .map((d, i) =>
            UI.renIdx === i
              ? `<span class="ren"><input id="renIn" type="text" value="${esc(UI.renVal != null ? UI.renVal : d)}" aria-label="新しいデッキ名"><button data-ren-ok="${i}" aria-label="名前を変更">✓</button><button data-ren-x="1" aria-label="やめる">×</button></span>`
              : `<span>${esc(d)}<button data-ren="${i}" aria-label="${esc(d)}の名前を変更">✎</button><button data-i="${i}" aria-label="${esc(d)}を候補から外す">×</button></span>`,
          )
          .join("")
      : '<span class="hint" style="margin:0;background:none;padding:0">まだありません</span>';
    if (
      UI.vrIdx != null &&
      document.activeElement &&
      document.activeElement.id === "vrIn"
    )
      UI.vrVal = document.activeElement.value;
    const vl = c.myDeck ? verList(c.myDeck) : [],
      vc = {};
    D().matches.forEach((m) => {
      if (m.my === c.myDeck) vc[m.ver || ""] = (vc[m.ver || ""] || 0) + 1;
    });
    $("#verListEd").innerHTML = !c.myDeck
      ? '<span class="hint" style="margin:0;background:none;padding:0">上部で使用デッキを選ぶと表示されます</span>'
      : vl
          .map((v, i) =>
            UI.vrIdx === i
              ? `<span class="ren"><input id="vrIn" type="text" value="${esc(UI.vrVal != null ? UI.vrVal : v)}" aria-label="新しいバージョン名"><button data-vr-ok="${i}" aria-label="名前を変更">✓</button><button data-vr-x="1" aria-label="やめる">×</button></span>`
              : `<span>${esc(v)}<small style="color:var(--muted);margin-left:4px">${vc[v] || 0}戦${v === curVer() ? " ・ 使用中" : ""}</small><button data-vr="${i}" aria-label="${esc(v)}の名前を変更">✎</button>${(vc[v] || 0) === 0 && v !== curVer() ? `<button data-vrdel="${i}" aria-label="${esc(v)}を一覧から外す">×</button>` : ""}</span>`,
          )
          .join("");
    const ch = c.chars || [];
    $("#charCount").textContent = `${ch.length}件`;
    $("#charListEd").innerHTML = ch
      .map(
        (d, i) =>
          `<div class="ci" draggable="true" data-i="${i}"><span class="hd" aria-hidden="true">⠿</span><span>${esc(d)}</span><span class="bt"><button data-mv="top" data-i="${i}" aria-label="${esc(d)}を先頭へ">⤒</button><button data-mv="up" data-i="${i}" aria-label="${esc(d)}を上へ">↑</button><button data-mv="down" data-i="${i}" aria-label="${esc(d)}を下へ">↓</button><button data-ci="${i}" aria-label="${esc(d)}を候補から外す">×</button></span></div>`,
      )
      .join("");
    renderFileInfo();
    $("#connInfo").innerHTML =
      `<span class="dot warn"></span><b>この端末のブラウザに保存</b> ・ 記録 ${REAL.matches.length}件`;
    $("#demoBtn").textContent = DEMO
      ? "サンプルを閉じる"
      : "サンプルデータで試す";
  }
  $("#deckAdd").onclick = () => {
    if (addDeck($("#deckNew").value)) {
      $("#deckNew").value = "";
      saveCfg();
    }
  };
  onEnter($("#deckNew"), () => $("#deckAdd").click());
  $("#deckList").addEventListener("keydown", (e) => {
    if (e.target.id !== "renIn") return;
    if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      renameDeck(cfg().decks[UI.renIdx], e.target.value);
    } else if (e.key === "Escape") {
      UI.renIdx = null;
      UI.renVal = null;
      renderData();
    }
  });
  $("#deckList").addEventListener("input", (e) => {
    if (e.target.id === "renIn") UI.renVal = e.target.value;
  });
  async function renameVer(oldV, newV) {
    newV = (newV || "").trim();
    const c = cfg(),
      deck = c.myDeck;
    if (!deck || !newV || newV === oldV) {
      UI.vrIdx = null;
      UI.vrVal = null;
      render();
      return;
    }
    if (verList(deck).includes(newV)) {
      toast("「" + newV + "」は既にあります。別の名前にしてください");
      return;
    }
    UI.vrIdx = null;
    UI.vrVal = null;
    if (c.verBy && c.verBy[deck] === oldV) {
      c.verBy = Object.assign({}, c.verBy);
      c.verBy[deck] = newV;
    } else if (!(c.verBy && c.verBy[deck]) && (c.ver || "v1") === oldV) {
      c.verBy = Object.assign({}, c.verBy || {});
      c.verBy[deck] = newV;
    }
    const vl = Object.assign({}, c.verList || {});
    vl[deck] = (vl[deck] || []).map((v) => (v === oldV ? newV : v));
    if (!vl[deck].includes(newV)) vl[deck].push(newV);
    c.verList = vl;
    if (UI.ver === oldV) UI.ver = newV;
    await saveCfg();
    const hit = D().matches.filter(
      (m) => m.my === deck && (m.ver || "") === oldV,
    );
    let k = 0;
    try {
      for (const m of hit) {
        await saveMatch(Object.assign({}, m, { ver: newV }));
        k++;
        if (k % 20 === 0) toast(`記録を更新中… ${k}／${hit.length}`);
      }
      toast(`「${oldV}」を「${newV}」に変更しました（記録${k}件）`);
    } catch (e) {
      toast(
        `記録の更新が${k}件目で止まりました。もう一度同じ名前変更をすると残りを直せます`,
      );
    }
  }
  $("#verListEd").addEventListener("click", (e) => {
    const vl = verList(cfg().myDeck);
    const rn = e.target.closest("button[data-vr]");
    if (rn) {
      UI.vrIdx = Number(rn.dataset.vr);
      UI.vrVal = null;
      renderData();
      const i = $("#vrIn");
      if (i) {
        i.focus();
        i.select();
      }
      return;
    }
    const ok = e.target.closest("button[data-vr-ok]");
    if (ok) {
      renameVer(vl[Number(ok.dataset.vrOk)], $("#vrIn").value);
      return;
    }
    if (e.target.closest("button[data-vr-x]")) {
      UI.vrIdx = null;
      UI.vrVal = null;
      renderData();
      return;
    }
    const d = e.target.closest("button[data-vrdel]");
    if (d) {
      const v = vl[Number(d.dataset.vrdel)],
        c = cfg(),
        o = Object.assign({}, c.verList || {});
      o[c.myDeck] = (o[c.myDeck] || []).filter((x) => x !== v);
      c.verList = o;
      saveCfg();
    }
  });
  $("#verListEd").addEventListener("keydown", (e) => {
    if (e.target.id !== "vrIn") return;
    if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      renameVer(verList(cfg().myDeck)[UI.vrIdx], e.target.value);
    } else if (e.key === "Escape") {
      UI.vrIdx = null;
      UI.vrVal = null;
      renderData();
    }
  });
  $("#verListEd").addEventListener("input", (e) => {
    if (e.target.id === "vrIn") UI.vrVal = e.target.value;
  });
  $("#charAdd").onclick = () => {
    const n = $("#charNew").value.trim();
    if (!n) return;
    const c = cfg();
    if (!(c.chars || []).includes(n)) c.chars = (c.chars || []).concat([n]);
    $("#charNew").value = "";
    saveCfg();
  };
  onEnter($("#charNew"), () => $("#charAdd").click());
  function moveChar(from, to) {
    const c = cfg(),
      a = (c.chars || []).slice();
    if (from < 0 || from >= a.length) return;
    to = clamp(to, 0, a.length - 1);
    if (from === to) return;
    const [x] = a.splice(from, 1);
    a.splice(to, 0, x);
    c.chars = a;
    saveCfg();
  }
  $("#charListEd").addEventListener("click", (e) => {
    const mv = e.target.closest("button[data-mv]");
    if (mv) {
      const i = Number(mv.dataset.i);
      moveChar(
        i,
        mv.dataset.mv === "top" ? 0 : mv.dataset.mv === "up" ? i - 1 : i + 1,
      );
      return;
    }
    const b = e.target.closest("button[data-ci]");
    if (!b) return;
    const c = cfg();
    c.chars = (c.chars || []).filter((_, i) => i !== Number(b.dataset.ci));
    saveCfg();
  });
  let dragI = null;
  $("#charListEd").addEventListener("dragstart", (e) => {
    const r = e.target.closest(".ci");
    if (!r) return;
    dragI = Number(r.dataset.i);
    r.classList.add("drag");
    try {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(dragI));
    } catch (_) {}
  });
  $("#charListEd").addEventListener("dragover", (e) => {
    const r = e.target.closest(".ci");
    if (dragI == null || !r) return;
    e.preventDefault();
    $$("#charListEd .over").forEach((x) => x.classList.remove("over"));
    r.classList.add("over");
  });
  $("#charListEd").addEventListener("drop", (e) => {
    const r = e.target.closest(".ci");
    if (dragI == null || !r) return;
    e.preventDefault();
    const to = Number(r.dataset.i);
    const f = dragI;
    dragI = null;
    moveChar(f, f < to ? to - 1 : to);
  });
  $("#charListEd").addEventListener("dragend", () => {
    dragI = null;
    $$("#charListEd .drag,#charListEd .over").forEach((x) =>
      x.classList.remove("drag", "over"),
    );
  });
  $("#charBulkAdd").onclick = () => {
    const add = $("#charBulk")
      .value.split(/[\n,、]/)
      .map((x) => x.trim())
      .filter(Boolean);
    const c = cfg();
    c.chars = Array.from(new Set((c.chars || []).concat(add)));
    $("#charBulk").value = "";
    saveCfg();
    toast(add.length + "件を追加しました");
  };
  $("#charReset").onclick = () => {
    cfg().chars = (BAKED.chars || DEFAULT_CHARS).slice();
    saveCfg();
    toast("初期リストに戻しました");
  };
  async function renameDeck(oldN, newN) {
    newN = (newN || "").trim();
    const c = cfg();
    if (!newN || newN === oldN) {
      UI.renIdx = null;
      UI.renVal = null;
      render();
      return;
    }
    if (c.decks.includes(newN)) {
      toast("「" + newN + "」は既にあります。別の名前にしてください");
      return;
    }
    UI.renIdx = null;
    UI.renVal = null;
    c.decks = c.decks.map((d) => (d === oldN ? newN : d));
    if (c.myDeck === oldN) c.myDeck = newN;
    ["verBy", "verList"].forEach((k) => {
      if (c[k] && c[k][oldN] != null) {
        const o = Object.assign({}, c[k]);
        o[newN] = o[oldN];
        delete o[oldN];
        c[k] = o;
      }
    });
    if (c.env && c.env.rows) {
      const er = {};
      Object.entries(c.env.rows).forEach(
        ([k, v]) => (er[k === oldN ? newN : k] = v),
      );
      c.env = { rows: er };
    }
    const nb = {};
    Object.entries(c.bench || {}).forEach(([k, v]) => {
      const rows = {};
      Object.entries((v && v.rows) || {}).forEach(
        ([rk, rv]) => (rows[rk === oldN ? newN : rk] = rv),
      );
      nb[k === oldN ? newN : k] = Object.assign({}, v, { rows });
    });
    c.bench = nb;
    benchExtra = benchExtra.map((x) => (x === oldN ? newN : x));
    benchRemoved = benchRemoved.map((x) => (x === oldN ? newN : x));
    if (F.opp === oldN) F.opp = newN;
    await saveCfg();
    const hit = D().matches.filter((m) => m.my === oldN || m.opp === oldN);
    let k = 0;
    try {
      for (const m of hit) {
        await saveMatch(
          Object.assign({}, m, {
            my: m.my === oldN ? newN : m.my,
            opp: m.opp === oldN ? newN : m.opp,
          }),
        );
        k++;
        if (k % 20 === 0) toast(`記録を更新中… ${k}／${hit.length}`);
      }
      toast(
        `「${oldN}」を「${newN}」に変更しました（記録${k}件・ベンチマークも更新）`,
      );
    } catch (e) {
      toast(
        `記録の更新が${k}件目で止まりました。もう一度同じ名前変更をすると残りを直せます`,
      );
    }
  }
  $("#deckList").addEventListener("click", (e) => {
    const rn = e.target.closest("button[data-ren]");
    if (rn) {
      UI.renIdx = Number(rn.dataset.ren);
      UI.renVal = null;
      renderData();
      const i = $("#renIn");
      if (i) {
        i.focus();
        i.select();
      }
      return;
    }
    const ok = e.target.closest("button[data-ren-ok]");
    if (ok) {
      renameDeck(cfg().decks[Number(ok.dataset.renOk)], $("#renIn").value);
      return;
    }
    if (e.target.closest("button[data-ren-x]")) {
      UI.renIdx = null;
      UI.renVal = null;
      renderData();
      return;
    }
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    const c = cfg();
    c.decks = c.decks.filter((_, i) => i !== Number(b.dataset.i));
    saveCfg();
  });
  $("#demoBtn").onclick = () => {
    if (DEMO) {
      DEMO = null;
      resetForm();
      render();
    } else startDemo();
  };
  /** ファイルをダウンロードさせる。ダウンロードできない環境ではコピー用に表示する。 */
  function offerFile(name, text, type) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    } catch (e) {
      // 下のコピー用表示にフォールバック
    }
    $("#expOut").innerHTML =
      `<p class="hint">下の内容をコピーして保存してください。</p><textarea id="expTa" readonly></textarea><div class="actions"><button class="btn small" id=>コピー</button></div>`;
    $("#expTa").value = text;
    $("#expCopy").onclick = () => {
      const ta = $("#expTa");
      (navigator.clipboard
        ? navigator.clipboard.writeText(text)
        : Promise.reject()
      )
        .then(() => toast("コピーしました"))
        .catch(() => {
          ta.select();
          toast("選択しました。コピーしてください");
        });
    };
  }

  const stamp = () => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  };
  $("#expJson").onclick = () => {
    markBackup();
    render();
    return offerFile(
      `duel-data-${stamp()}.json`,
      JSON.stringify(
        { version: 1, matches: D().matches, cfg: D().cfg },
        null,
        1,
      ),
      "application/json",
    );
  };
  $("#expCsv").onclick = () => {
    const q = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    const lines = [
      [
        "日時",
        "使用デッキ",
        "バージョン",
        "相手デッキ",
        "先後",
        "勝敗",
        "DP",
        "自分事故",
        "相手事故",
        "構築",
        "メモ",
        "順位",
        `${targetRank()}位ライン`,
        "プレミ",
        "相手キャラ",
        "相手プレイヤー",
        "DP（実数補正）",
      ].join(","),
    ].concat(
      D().matches.map((m) =>
        [
          new Date(m.ts).toLocaleString("ja-JP"),
          m.my,
          m.ver,
          m.opp,
          m.first ? "先攻" : "後攻",
          m.win ? "勝ち" : "負け",
          m.pt,
          m.brick ? 1 : 0,
          m.oppBrick ? 1 : 0,
          m.build || 0,
          m.note,
          m.rank,
          m.silver,
          m.miss ? 1 : 0,
          m.char,
          m.player,
          m.dp,
        ]
          .map(q)
          .join(","),
      ),
    );
    offerFile(`duel-data-${stamp()}.csv`, "﻿" + lines.join("\n"), "text/csv");
  };
  $("#impFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const msg = $("#impMsg");
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.matches)) throw 0;
      if (DEMO) {
        DEMO = null;
      }
      REAL.cfg = Object.assign(defCfg(), REAL.cfg, d.cfg || {});
      REAL.cfg.decks = Array.from(
        new Set((REAL.cfg.decks || []).concat((d.cfg && d.cfg.decks) || [])),
      );
      await saveCfg();
      let k = 0;
      for (const m of d.matches) {
        if (!m || !m.id || !m.opp) continue;
        await saveMatch(Object.assign({}, m));
        k++;
        if (k % 20 === 0) msg.textContent = `${k}件 読み込み中…`;
      }
      msg.textContent = `${k}件を読み込みました`;
    } catch (err) {
      msg.textContent =
        "読み込めませんでした。このページで書き出したJSONを選んでください。";
    }
    e.target.value = "";
  });
  $("#wipeBtn").onclick = async () => {
    const b = $("#wipeBtn"),
      msg = $("#wipeMsg");
    if (DEMO) {
      msg.textContent = "サンプル表示中は削除できません";
      return;
    }
    if (b.dataset.armed !== "1") {
      b.dataset.armed = "1";
      b.textContent = "もう一度押すと全記録を削除";
      msg.textContent = "元に戻せません。先にJSONで書き出しておくと安全です。";
      return;
    }
    b.dataset.armed = "";
    b.textContent = "全記録を削除";
    const ids = REAL.matches.map((m) => m.id);
    let k = 0;
    try {
      for (const id of ids) {
        await delMatch(id);
        k++;
      }
      msg.textContent = `${k}件を削除しました`;
    } catch (e) {
      msg.textContent = `${k}件削除した時点で止まりました。もう一度お試しください。`;
    }
  };

  /* ---------- 確率（初手確率・事故率の理論値） ---------- */
  /** 組み合わせの数 C(n, k)。 */
  function comb(n, k) {
    if (k < 0 || n < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  }
  /**
   * デッキ D 枚から H 枚引いたときの確率（超幾何分布）。A・B は別々のカード。
   *   P(A≥1)        = 1 − C(D−A, H) / C(D, H)
   *   P(A or B ≥1)  = 1 − C(D−A−B, H) / C(D, H)
   *   P(A and B ≥1) = 1 − [C(D−A, H) + C(D−B, H) − C(D−A−B, H)] / C(D, H)
   */
  function drawOdds(D, H, A, B) {
    const all = comb(D, H);
    if (!all || A + B > D) return null;
    const noA = comb(D - A, H) / all,
      noB = comb(D - B, H) / all,
      noAB = comb(D - A - B, H) / all;
    return { a: 1 - noA, or: 1 - noAB, and: 1 - noA - noB + noAB };
  }
  const ODDS_KEY = "ddd-odds-input";
  const ODDS = { D: 20, H: 4, A: 3, B: 3, x: "A" };
  try {
    Object.assign(ODDS, JSON.parse(localStorage.getItem(ODDS_KEY) || "{}"));
  } catch (e) {
    // 前回の入力がなくても既定値で動く
  }
  const brickKey = (side) => `${cfg().myDeck}|${curVer()}|${side}`;
  /** 事故率の理論値（%）。side は "first"（先攻）／"second"（後攻）。未設定なら旧形式（先後共通）の値。 */
  function brickTheory(deck, ver, side) {
    const t = cfg().brickTheory || {};
    const v = t[`${deck}|${ver}|${side}`] ?? t[`${deck}|${ver}`];
    return v == null || v === "" ? null : Number(v);
  }
  function setBrickTheory(side, pctValue) {
    const c = cfg();
    if (!c.myDeck) {
      toast("先に上部で使用デッキを選んでください");
      return;
    }
    c.brickTheory = Object.assign({}, c.brickTheory || {});
    const legacy = `${c.myDeck}|${curVer()}`;
    if (c.brickTheory[legacy] != null) {
      // 旧形式（先後共通）の値を、先攻・後攻それぞれに引き継いでから個別に上書きする
      ["first", "second"].forEach((s) => {
        if (c.brickTheory[brickKey(s)] == null)
          c.brickTheory[brickKey(s)] = c.brickTheory[legacy];
      });
      delete c.brickTheory[legacy];
    }
    if (pctValue == null) delete c.brickTheory[brickKey(side)];
    else c.brickTheory[brickKey(side)] = Math.round(pctValue * 10) / 10;
    saveCfg();
  }
  function readOddsInputs() {
    const n = (id, lo, hi) =>
      clamp(Math.round(Number($(id).value) || 0), lo, hi);
    ODDS.D = n("#oddD", 1, 60);
    ODDS.H = n("#oddH", 0, ODDS.D);
    ODDS.A = n("#oddA", 0, ODDS.D);
    ODDS.B = n("#oddB", 0, ODDS.D - ODDS.A);
    try {
      localStorage.setItem(ODDS_KEY, JSON.stringify(ODDS));
    } catch (e) {
      // 保存できなくても計算は続ける
    }
  }
  function renderOdds() {
    ["D", "H", "A", "B"].forEach((k) => {
      const el = $("#odd" + k);
      if (document.activeElement !== el) el.value = ODDS[k];
    });
    const r = drawOdds(ODDS.D, ODDS.H, ODDS.A, ODDS.B);
    const deck = cfg().myDeck,
      curF = deck ? brickTheory(deck, curVer(), "first") : null,
      curS = deck ? brickTheory(deck, curVer(), "second") : null;
    const rows = [
      ["a", "Aを1枚以上", "A"],
      ["or", "AかBを1枚以上", "A or B"],
      ["and", "AとBを1枚ずつ以上", "A and B"],
    ];
    $("#oddsOut").innerHTML = r
      ? rows
          .map(
            ([k, label, short]) =>
              `<div class="tile odds"><div class="k">${label}</div><div class="v">${pct(r[k])}</div><div class="s">引けない確率 ${pct(1 - r[k])}</div><div class="bk2"><button class="btn small" data-brick="${k}" data-side="first"${deck ? "" : " disabled"} title="「${short}」を引けない確率を、先攻の事故率の理論値にします">先攻事故率に反映</button><button class="btn small" data-brick="${k}" data-side="second"${deck ? "" : " disabled"} title="「${short}」を引けない確率を、後攻の事故率の理論値にします">後攻事故率に反映</button></div></div>`,
          )
          .join("")
      : '<div class="err">AとBの合計がデッキ枚数を超えています。</div>';
    $("#oddsTarget").textContent = deck
      ? `反映先：${deck}（${curVer()}）・現在の理論値 先攻 ${curF == null ? "未設定" : curF + "%"}／後攻 ${curS == null ? "未設定" : curS + "%"}（未設定は実績から計算）。先攻・後攻で引く枚数が違う場合は、H を変えてから押してください。`
      : "反映先：上部で使用デッキを選ぶと反映できます";
    $$("#oddsAxis button").forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.x === ODDS.x),
    );
    oddsChart();
  }
  function oddsChart() {
    const el = $("#oddsChart"),
      x = ODDS.x;
    const range = {
      D: [Math.max(ODDS.H, ODDS.A + ODDS.B, 1), 40],
      H: [0, Math.min(ODDS.D, 10)],
      A: [0, ODDS.D - ODDS.B],
      B: [0, ODDS.D - ODDS.A],
    }[x];
    const xs = [];
    for (let v = range[0]; v <= range[1]; v++) xs.push(v);
    const pts = xs.map((v) => {
      const p = Object.assign({}, ODDS, { [x]: v });
      return drawOdds(p.D, p.H, p.A, p.B);
    });
    const w = Math.max(260, el.clientWidth || 600),
      h = 280,
      pl = 40,
      pr = 12,
      pt = 10,
      pb = 24;
    if (xs.length < 2) {
      el.innerHTML = '<div class="empty">この条件では推移を描けません</div>';
      return;
    }
    const X = (i) => pl + ((w - pl - pr) * i) / (xs.length - 1),
      Y = (v) => pt + (h - pt - pb) * (1 - v);
    let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${x}を変えたときの確率の推移">`;
    [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].forEach((t) => {
      s += `<line x1="${pl}" x2="${w - pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--line)" stroke-width="1"${t === 0.5 ? "" : ' stroke-dasharray="2 3"'}/><text x="${pl - 6}" y="${Y(t) + 4}" text-anchor="end">${Math.round(t * 100)}%</text>`;
    });
    const step = niceStep(xs.length - 1, 1, 8);
    xs.forEach((v, i) => {
      if ((v - xs[0]) % step) return;
      s += `<text x="${X(i)}" y="${h - 6}" text-anchor="middle">${v}</text>`;
    });
    const ci = xs.indexOf(ODDS[x]);
    if (ci >= 0)
      s += `<line x1="${X(ci)}" x2="${X(ci)}" y1="${pt}" y2="${h - pb}" stroke="var(--first)" stroke-dasharray="3 3"/>`;
    [
      ["and", "var(--c3)"],
      ["or", "var(--c2)"],
      ["a", "var(--accent)"],
    ].forEach(([k, col]) => {
      const d = pts
        .map((p, i) =>
          p
            ? (i && pts[i - 1] ? "L" : "M") +
              X(i).toFixed(1) +
              " " +
              Y(p[k]).toFixed(1)
            : "",
        )
        .join(" ");
      s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2"/>`;
      if (ci >= 0 && pts[ci])
        s += `<circle cx="${X(ci)}" cy="${Y(pts[ci][k])}" r="3.5" fill="${col}"/>`;
    });
    el.innerHTML = s + "</svg>";
  }
  ["#oddD", "#oddH", "#oddA", "#oddB"].forEach((id) =>
    $(id).addEventListener("input", () => {
      readOddsInputs();
      renderOdds();
    }),
  );
  $("#oddsAxis").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-x]");
    if (!b) return;
    ODDS.x = b.dataset.x;
    readOddsInputs();
    renderOdds();
  });
  $("#oddsOut").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-brick]");
    if (!b) return;
    const r = drawOdds(ODDS.D, ODDS.H, ODDS.A, ODDS.B);
    if (!r) return;
    const v = (1 - r[b.dataset.brick]) * 100,
      side = b.dataset.side;
    setBrickTheory(side, v);
    toast(
      `${side === "first" ? "先攻" : "後攻"}の事故率の理論値を ${Math.round(v * 10) / 10}% にしました（${cfg().myDeck}・${curVer()}）`,
    );
  });
  /* DTL タブの理論値入力欄（先攻・後攻） */
  function renderBrickInput() {
    const deck = cfg().myDeck;
    $("#brickLabel").textContent = deck
      ? `${deck}（${curVer()}）`
      : "使用デッキ未設定";
    [
      ["#brickInF", "first"],
      ["#brickInS", "second"],
    ].forEach(([id, side]) => {
      const el = $(id);
      el.disabled = !deck;
      if (document.activeElement !== el) {
        const v = deck ? brickTheory(deck, curVer(), side) : null;
        el.value = v == null ? "" : v;
      }
    });
  }
  [
    ["#brickInF", "first"],
    ["#brickInS", "second"],
  ].forEach(([id, side]) =>
    $(id).addEventListener("change", (e) => {
      const v = e.target.value.trim();
      setBrickTheory(side, v === "" ? null : clamp(Number(v) || 0, 0, 100));
    }),
  );

  $("#dtlMode").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-m]");
    if (!b) return;
    UI.dtlDetail = b.dataset.m === "1";
    renderDTL();
  });
  /* ---------- サンプルデータ ---------- */
  function startDemo() {
    let s = 11;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const opps = [
      ["相手A", 0.3, 0.58],
      ["相手B", 0.22, 0.47],
      ["相手C", 0.18, 0.56],
      ["相手D", 0.16, 0.5],
      ["相手E", 0.14, 0.62],
    ];
    const ms = [];
    let tt = Date.now() - 6 * 86400e3,
      sn = 0;
    const sl = [12, 22, 9, 26, 15, 18];
    let si = 0;
    for (let i = 0; i < 102; i++) {
      if (sn >= sl[si % sl.length]) {
        sn = 0;
        si++;
        tt += 5 * HOUR;
      }
      sn++;
      tt += (9 + Math.round(r() * 8)) * 60000;
      let x = r(),
        acc = 0,
        o = opps[0];
      for (const op of opps) {
        acc += op[1];
        if (x <= acc) {
          o = op;
          break;
        }
      }
      const first = r() < 0.53,
        brick = r() < 0.1,
        oppBrick = r() < 0.08;
      let p = o[2] + (first ? 0.09 : -0.09) - (sn > 15 ? 0.15 : 0);
      if (brick) p = 0.15;
      if (oppBrick) p = Math.min(0.95, p + 0.3);
      const win = r() < p;
      let build = 0;
      const rr = r();
      if (!brick) {
        if (win && rr < 0.08) build = 1;
        if (!win && rr < 0.05) build = -1;
      }
      ms.push({
        dp: i === 0 ? (win ? 3050 : 2960) : null,
        id: "d" + i,
        ts: Math.min(tt, Date.now() - 60000),
        my: "サンプル自デッキ",
        ver: i < 55 ? "ver.1" : "ver.2",
        opp: o[0],
        first,
        win,
        pt: win ? 50 : -40,
        brick,
        oppBrick,
        miss: r() < (sn > 15 ? 0.3 : 0.1),
        build,
        note: "",
        rank:
          i % 3 === 0
            ? Math.max(
                5,
                Math.round(2500 * Math.pow(0.965, i)) + Math.round(r() * 20),
              )
            : null,
        player: i % 17 === 0 ? "サンプル選手" : "",
        silver: i % 3 === 0 ? 3500 + i * 6 : null,
      });
    }
    DEMO = {
      matches: ms,
      cfg: {
        decks: [
          "サンプル自デッキ",
          "相手A",
          "相手B",
          "相手C",
          "相手D",
          "相手E",
        ],
        myDeck: "サンプル自デッキ",
        verBy: { サンプル自デッキ: "ver.2" },
        env: {
          rows: {
            相手A: { b: 25, omega: 55 },
            相手B: { b: 20, omega: 50 },
            相手C: { b: 20, omega: 45 },
            サンプル自デッキ: { b: 10, omega: 48 },
            相手D: { b: 10, omega: 50 },
          },
        },
        bench: {
          サンプル自デッキ: {
            rows: {
              相手A: { q: 55 },
              相手B: { q: 45 },
              相手C: { q: 55 },
              相手D: { q: 50 },
            },
          },
        },
      },
    };
    resetForm();
    benchDirty = false;
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- ルーティング・描画のエントリポイント ---------- */
  const VIEWS = ["input", "history", "charts", "env", "dtl", "odds", "data"];
  function route() {
    const h = (location.hash || "").slice(1);
    UI.view = VIEWS.includes(h) ? h : "input";
    render();
  }
  window.addEventListener("hashchange", route);
  let rT;
  window.addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      if (!$("#v-charts").hidden) renderCharts();
      if (!$("#v-env").hidden) renderEnv();
      if (!$("#v-odds").hidden) oddsChart();
    }, 150);
  });
  const wideMQ = matchMedia("(min-width:900px)");
  function isWide() {
    return wideMQ.matches;
  }
  try {
    wideMQ.addEventListener("change", () => render());
  } catch (e) {}
  function render() {
    renderHeader();
    renderTargetLabels();
    const wide = isWide(),
      showSide = wide || UI.view === "input";
    const mv = UI.view === "input" ? (wide ? "history" : null) : UI.view;
    $("#v-input").hidden = !showSide;
    VIEWS.slice(1).forEach((v) => {
      $("#v-" + v).hidden = v !== mv;
    });
    const cur = wide ? mv : UI.view;
    $$(".tabs a").forEach((a) => {
      if (a.dataset.tab === cur) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    renderFilters();
    if (showSide) {
      renderForm();
      renderRecent();
    }
    if (mv === "history") renderHistory();
    if (mv === "charts") renderCharts();
    if (mv === "env") renderEnv();
    if (mv === "dtl") renderDTL();
    if (mv === "odds") renderOdds();
    if (mv === "dtl") renderBrickInput();
    if (mv === "data") renderData();
  }
  function setHH() {
    const h = $(".top").offsetHeight;
    document.documentElement.style.setProperty("--hh", h + "px");
  }
  try {
    new ResizeObserver(setHH).observe($(".top"));
  } catch (e) {}
  setHH();
  try {
    let sT;
    new ResizeObserver(() => {
      clearTimeout(sT);
      sT = setTimeout(renderSpark, 80);
    }).observe($("#spark"));
  } catch (e) {}
  let lastSessKey = "";
  setInterval(() => {
    try {
      const c = currentSession(sessionInfo()),
        k = c ? String(c.next) : "";
      if (k !== lastSessKey) {
        lastSessKey = k;
        if (!F.id) render();
      }
    } catch (e) {}
  }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !F.id) render();
  });
  route();
  initStore();
})();
