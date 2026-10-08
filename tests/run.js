#!/usr/bin/env node
/*
 * Chạy bộ test chung cho engine:  node tests/run.js
 *
 * Mỗi ca trong cases.json mô phỏng một ô nhập: gõ lần lượt từng phím,
 * áp { backs, text } vào văn bản, giống hệt UkEngine.attach().
 * Token đặc biệt trong "input":
 *   {BS}          Backspace (trình duyệt tự xoá, engine đồng bộ lại ở phím sau)
 *   {ENTER}       kết thúc từ rồi xuống dòng
 *   {PASTE:xxx}   dán "xxx" vào trước con trỏ (engine không được báo)
 */
'use strict';
var fs = require('fs');
var path = require('path');
var UkEngine = require('../ukengine.js');

var METHODS = { telex: UkEngine.TELEX, vni: UkEngine.VNI, viqr: UkEngine.VIQR, 'viqr*': UkEngine.VIQR_STAR };

function tokens(input) {
  var out = [], re = /\{BS\}|\{ENTER\}|\{PASTE:([^}]*)\}|[\s\S]/g, m;
  while ((m = re.exec(input))) {
    if (m[0] === '{BS}') out.push({ bs: true });
    else if (m[0] === '{ENTER}') out.push({ enter: true });
    else if (m[1] !== undefined) out.push({ paste: m[1] });
    else out.push({ key: m[0] });
  }
  return out;
}

function type(c) {
  var engine = new UkEngine(Object.assign({ method: METHODS[c.method || 'telex'] }, c.opts || {}));
  if (c.macros) { engine.setMacros(c.macros); engine.setOption('macroEnabled', true); }
  var text = '';
  function apply(r) { text = text.slice(0, text.length - r.backs) + r.text; }
  tokens(c.input).forEach(function (t) {
    if (t.bs) { text = text.slice(0, -1); return; }
    if (t.paste !== undefined) { text += t.paste; return; }
    engine.ensureSync(text);
    if (t.enter) { apply(engine.endWord()); text += '\n'; return; }
    apply(engine.process(t.key));
  });
  return text;
}

var cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
var fail = 0, total = 0;
cases.forEach(function (group) {
  group.cases.forEach(function (c) {
    c = Object.assign({ method: group.method, opts: group.opts }, c);
    total++;
    var got = type(c);
    if (got !== c.expect) {
      fail++;
      console.log('FAIL [' + group.name + '] ' + JSON.stringify(c.input) + ' → ' + JSON.stringify(got) +
                  '  (mong đợi ' + JSON.stringify(c.expect) + ')');
    }
  });
});
console.log((total - fail) + '/' + total + ' ca đạt');
process.exit(fail ? 1 : 0);
