import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bundle = await build({configFile:false,logLevel:'error',build:{write:false,minify:false,lib:{entry:path.join(root,'src/lib/rsvpCsv.ts'),formats:['es']}}});
const chunk = (Array.isArray(bundle)?bundle[0]:bundle).output.find(v=>v.type==='chunk'&&v.isEntry);
const { rsvpsToCsv } = await import('data:text/javascript;base64,'+Buffer.from(chunk.code).toString('base64'));
const entry = { id:'private-id', name:'가상 하객', side:'groom', attending:true, count:2, meal:'yes', memo:'유아 의자', createdAt:'2026-10-03T00:00:00Z' };

// Read the serialized CSV as records, including embedded newlines and quotes.
function records(csv) {
  const rows=[]; let row=[], cell='', quoted=false;
  const text=csv.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
    }else if(c===','&&!quoted){row.push(cell);cell='';}
    else if(c==='\r'&&text[i+1]==='\n'&&!quoted){row.push(cell);rows.push(row);row=[];cell='';i++;}
    else cell+=c;
  }
  assert.equal(quoted,false);
  assert.equal(cell,'');
  return rows;
}

await test('Korean header, UTF-8 BOM, seven columns and KST date',()=>{
  const csv=rsvpsToCsv([entry]);
  assert.equal(csv.charCodeAt(0),0xFEFF);
  assert.deepEqual(records(csv),[
    ['이름','측','참석 여부','참석 인원','식사','메모','응답일 (한국 시간)'],
    ['가상 하객','신랑측','참석','2','예정','유아 의자','2026-10-03 09:00'],
  ]);
});
await test('commas, quotes, semicolons and multiline text stay in the same cell',()=>{
  const name='가상, "하객"'; const memo='첫 줄, "인용"; =1+1\r\n다음 줄\n마지막 줄';
  const rows=records(rsvpsToCsv([{...entry,name,memo}]));
  assert.equal(rows.length,2);assert.equal(rows[1].length,7);
  assert.equal(rows[1][0],name);assert.equal(rows[1][5],memo);
});
await test('ASCII/full-width formulas and leading whitespace become literal text',()=>{
  for(const value of ['=1+1','+1','-1','@SUM(1)','＝1','＋1','－1','＠SUM(1)','  =1','\uFEFF=1','\t=1','\r=1','\n=1','\tordinary']){
    const row=records(rsvpsToCsv([{...entry,name:value,memo:value}]))[1];
    assert.equal(row[0],'문자: '+value);assert.equal(row[5],'문자: '+value);
  }
});
await test('declined responses have zero attendees and no meal commitment; unknown stays unknown',()=>{
  const rows=records(rsvpsToCsv([{...entry,attending:false,count:8,side:'bride'},{...entry,side:'host',meal:undefined,memo:undefined}]));
  assert.deepEqual(rows[1].slice(1,5),['신부측','불참','0','해당 없음']);
  assert.deepEqual(rows[2].slice(1,6),['하객','참석','2','미정','']);
});
await test('empty responses export only headers; invalid dates remain explicit',()=>{
  assert.equal(records(rsvpsToCsv([])).length,1);
  assert.equal(records(rsvpsToCsv([{...entry,createdAt:'invalid'}]))[1][6],'확인 필요');
  assert.equal(records(rsvpsToCsv([{...entry,createdAt:'2026-10-03T23:30:00Z'}]))[1][6],'2026-10-04 08:30');
});
await test('source data is preserved and private identifiers are excluded',()=>{
  const input=[{...entry,session:'private-session',token:'private-token'}]; const before=structuredClone(input);
  const csv=rsvpsToCsv(input);
  assert.deepEqual(input,before);
  for(const secret of ['private-id','private-session','private-token'])assert.equal(csv.includes(secret),false);
});
await test('all 500 permitted responses survive export without truncation',()=>{
  const input=Array.from({length:500},(_,i)=>({...entry,name:`가상 하객 ${i}`}));
  const rows=records(rsvpsToCsv(input));assert.equal(rows.length,501);assert.equal(rows[500][0],'가상 하객 499');
});
