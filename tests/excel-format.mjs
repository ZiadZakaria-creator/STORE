// XLSX fixtures generated with XlsxWriter 3.2.9, independent of App.excel.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
const context=await browser.newContext({serviceWorkers:'block'});
await context.route(/\/firebase-config\.js$/,r=>r.fulfill({contentType:'text/javascript',body:'window.FIREBASE_CONFIG=null;'}));
const p=await context.newPage();
try{
  await p.goto((process.argv[2]||'http://127.0.0.1:8080/')+'admin/index.html');
  const shared=[...readFileSync(new URL('./fixtures/shared-strings.xlsx',import.meta.url))];
  const formula=[...readFileSync(new URL('./fixtures/formula.xlsx',import.meta.url))];
  const result=await p.evaluate(async({shared,formula})=>{
    const read=bytes=>App.excel.read(new File([new Uint8Array(bytes)],'test.xlsx'));
    const rows=await read(shared);
    if(rows[1][0]!=='قميص & <قطن>'||rows[1][1]!=='00123'||rows[1][2]!=='340.5'||rows[1][3]!=='سطر أول\nسطر تاني')throw new Error('External sharedStrings workbook mismatch');
    if(rows[2][0]!=='=HYPERLINK("https://example.com")'||rows[2][1]!==rows[2][3])throw new Error('Literal formula or repeated shared strings changed');
    let blocked=false;try{await read(formula);}catch(e){blocked=e.message.includes('الصف 2')&&e.message.includes('الصيغ');}if(!blocked)throw new Error('Formula accepted');
    const original=[['نص','رقم'],['=1+1',25],['00123','<img src=x>'],['line\nline','&"']];
    const roundtrip=await App.excel.read(App.excel.write([{name:'المنتجات',rows:original}]));
    if(JSON.stringify(roundtrip)!==JSON.stringify(original.map(row=>row.map(String))))throw new Error('Export/import roundtrip mismatch');
    let corrupt=false;try{await read(shared.slice(0,50));}catch{corrupt=true;}if(!corrupt)throw new Error('Truncated archive accepted');
    let huge=false;try{await App.excel.read(new Blob([new Uint8Array(5*1024*1024+1)]));}catch(e){huge=e.message.includes('ميجابايت');}if(!huge)throw new Error('File size limit bypassed');
    return '6 Excel format checks passed (independent shared strings, safe text, formulas, roundtrip, corruption, size)';
  },{shared,formula});
  console.log(result);
}finally{await browser.close();}
