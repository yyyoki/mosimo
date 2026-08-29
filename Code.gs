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

    return json_({ ok: false, error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}
