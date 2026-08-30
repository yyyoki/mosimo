/**
 * もしもコミュニティ — バックエンド（Google Apps Script）
 *
 * 使い方は README.md を参照。要点だけ:
 *  1. Googleスプレッドシートを新規作成し、[拡張機能] → [Apps Script] を開く
 *  2. このファイルの中身を全部貼り付けて保存
 *  3. [デプロイ] → [新しいデプロイ] → 種類「ウェブアプリ」
 *       - 次のユーザーとして実行: 自分
 *       - アクセスできるユーザー: 全員
 *  4. 発行された URL を index.html の CONFIG.GAS_URL に貼る
 *  5. 管理者モードを使う場合:
 *       [プロジェクトの設定] → [スクリプト プロパティ] で
 *       プロパティ名 ADMIN_KEY / 値 に好きな合言葉を設定し、
 *       同じ値を index.html の CONFIG.ADMIN_KEY にも入れる
 *
 * シートは初回アクセス時に自動で作られます（見出し行つき）。
 */

var SHEET_NAME = 'posts';
var HEADERS = ['id', 'createdAt', 'type', 'question', 'conditions', 'modelAnswer', 'title', 'body', 'nickname', 'likes'];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowsToPosts_(sh) {
  var values = sh.getDataRange().getValues();
  var posts = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    var conds = [];
    try { conds = r[4] ? JSON.parse(r[4]) : []; } catch (e) { conds = String(r[4] || '').split('\n').filter(String); }
    posts.push({
      id: String(r[0]),
      createdAt: Number(r[1]) || 0,
      type: r[2] || 'topic',
      question: r[3] || '',
      conditions: conds,
      modelAnswer: r[5] || '',
      title: r[6] || '',
      body: r[7] || '',
      nickname: r[8] || '名無し',
      likes: Number(r[9]) || 0
    });
  }
  return posts;
}

/** 管理者キーの照合。スクリプトプロパティ ADMIN_KEY に値を設定してください。 */
function isAdmin_(key) {
  var stored = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return !!stored && String(key) === String(stored);
}

function rowToPost_(row) {
  var conds = [];
  try { conds = row[4] ? JSON.parse(row[4]) : []; } catch (e) { conds = String(row[4] || '').split('\n').filter(String); }
  return {
    id: String(row[0]), createdAt: Number(row[1]) || 0, type: row[2] || 'topic',
    question: row[3] || '', conditions: conds, modelAnswer: row[5] || '',
    title: row[6] || '', body: row[7] || '', nickname: row[8] || '名無し',
    likes: Number(row[9]) || 0
  };
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'list';
  var sh = getSheet_();
  if (action === 'list') {
    return json_({ ok: true, posts: rowsToPosts_(sh) });
  }
  return json_({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var payload = {};
    try { payload = JSON.parse(e.postData.contents); } catch (err) {}
    var action = payload.action;
    var sh = getSheet_();

    if (action === 'create') {
      var p = payload.post || {};
      var id = Utilities.getUuid();
      var createdAt = Date.now();
      var type = ['topic', 'topic_answer', 'report'].indexOf(p.type) >= 0 ? p.type : 'topic';
      var conditions = Array.isArray(p.conditions) ? p.conditions : [];
      var row = [
        id,
        createdAt,
        type,
        String(p.question || '').slice(0, 200),
        JSON.stringify(conditions.map(function (c) { return String(c).slice(0, 120); }).slice(0, 5)),
        String(p.modelAnswer || '').slice(0, 4000),
        String(p.title || '').slice(0, 200),
        String(p.body || '').slice(0, 4000),
        String(p.nickname || '名無し').slice(0, 24),
        0
      ];
      sh.appendRow(row);
      return json_({
        ok: true,
        post: {
          id: id, createdAt: createdAt, type: type,
          question: row[3], conditions: conditions, modelAnswer: row[5],
          title: row[6], body: row[7], nickname: row[8], likes: 0
        }
      });
    }

    if (action === 'like') {
      var wantId = String(payload.id || '');
      var values = sh.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]) === wantId) {
          var likes = (Number(values[i][9]) || 0) + 1;
          sh.getRange(i + 1, 10).setValue(likes);
          return json_({ ok: true, likes: likes });
        }
      }
      return json_({ ok: false, error: 'not found' });
    }

    if (action === 'admin_check') {
      return json_({ ok: isAdmin_(payload.adminKey) });
    }

    if (action === 'update') {
      if (!isAdmin_(payload.adminKey)) return json_({ ok: false, error: 'unauthorized' });
      var uid = String(payload.id || '');
      var patch = payload.patch || {};
      var uvals = sh.getDataRange().getValues();
      for (var u = 1; u < uvals.length; u++) {
        if (String(uvals[u][0]) === uid) {
          var rn = u + 1;
          if (patch.type && ['topic', 'topic_answer', 'report'].indexOf(patch.type) >= 0) sh.getRange(rn, 3).setValue(patch.type);
          if (patch.question != null) sh.getRange(rn, 4).setValue(String(patch.question).slice(0, 200));
          if (patch.conditions != null) sh.getRange(rn, 5).setValue(JSON.stringify((Array.isArray(patch.conditions) ? patch.conditions : []).map(function (c) { return String(c).slice(0, 120); }).slice(0, 5)));
          if (patch.modelAnswer != null) sh.getRange(rn, 6).setValue(String(patch.modelAnswer).slice(0, 4000));
          if (patch.title != null) sh.getRange(rn, 7).setValue(String(patch.title).slice(0, 200));
          if (patch.body != null) sh.getRange(rn, 8).setValue(String(patch.body).slice(0, 4000));
          if (patch.nickname != null) sh.getRange(rn, 9).setValue(String(patch.nickname || '名無し').slice(0, 24));
          return json_({ ok: true, post: rowToPost_(sh.getRange(rn, 1, 1, HEADERS.length).getValues()[0]) });
        }
      }
      return json_({ ok: false, error: 'not found' });
    }

    if (action === 'delete') {
      if (!isAdmin_(payload.adminKey)) return json_({ ok: false, error: 'unauthorized' });
      var did = String(payload.id || '');
      var dvals = sh.getDataRange().getValues();
      for (var d = 1; d < dvals.length; d++) {
        if (String(dvals[d][0]) === did) {
          sh.deleteRow(d + 1);
          return json_({ ok: true });
        }
      }
      return json_({ ok: false, error: 'not found' });
    }

    return json_({ ok: false, error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}
