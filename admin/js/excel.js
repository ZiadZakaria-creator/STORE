/* XLSX بسيط: قيم نصية/رقمية فقط، من غير ماكرو أو تنفيذ صيغ. */
(function (root) {
  'use strict';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const fail = () => { throw new Error('ملف Excel غير مدعوم أو تالف. استخدم القالب واحفظه بصيغة .xlsx بدون باسورد أو صيغ.'); };
  const crcTable = Array.from({length:256}, (_, n) => { for(let i=0;i<8;i++) n = n&1 ? 0xedb88320^(n>>>1) : n>>>1; return n>>>0; });
  const crc = bytes => { let n=0xffffffff; for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8); return (n^0xffffffff)>>>0; };
  const xml = value => String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const col = n => { let s=''; for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s; return s; };
  function zip(files) {
    const parts=[], directory=[]; let offset=0;
    for(const [name, content] of Object.entries(files)) {
      const filename=enc.encode(name), data=enc.encode(content), checksum=crc(data);
      const header=new Uint8Array(30+filename.length), v=new DataView(header.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(12,33,true);v.setUint32(14,checksum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,filename.length,true);header.set(filename,30);
      const central=new Uint8Array(46+filename.length), c=new DataView(central.buffer);
      c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(14,33,true);c.setUint32(16,checksum,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);central.set(filename,46);
      parts.push(header,data);directory.push(central);offset+=header.length+data.length;
    }
    const end=new Uint8Array(22), e=new DataView(end.buffer);
    e.setUint32(0,0x06054b50,true);e.setUint16(8,directory.length,true);e.setUint16(10,directory.length,true);e.setUint32(12,directory.reduce((n,d)=>n+d.length,0),true);e.setUint32(16,offset,true);
    return new Blob([...parts,...directory,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function write(sheets) {
    const files={}, rel='http://schemas.openxmlformats.org/package/2006/relationships', docRel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    files['[Content_Types].xml']=`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    files['_rels/.rels']=`<Relationships xmlns="${rel}"><Relationship Id="rId1" Type="${docRel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    files['xl/workbook.xml']=`<workbook xmlns="${NS}" xmlns:r="${docRel}"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
    files['xl/_rels/workbook.xml.rels']=`<Relationships xmlns="${rel}">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${docRel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`;
    sheets.forEach((s,i)=>{
      files[`xl/worksheets/sheet${i+1}.xml`]=`<worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="64" width="24" customWidth="1"/></cols><sheetData>${s.rows.map((r,y)=>`<row r="${y+1}">${r.map((v,x)=>typeof v==='number'&&Number.isFinite(v)?`<c r="${col(x)}${y+1}"><v>${v}</v></c>`:`<c r="${col(x)}${y+1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
    });
    return zip(files);
  }
  async function unzip(file) {
    if(file.size>5*1024*1024)throw new Error('الملف أكبر من ٥ ميجابايت. قسّمه لملفات أصغر.');
    const bytes=new Uint8Array(await file.arrayBuffer()), v=new DataView(bytes.buffer), files=new Map();
    let end=-1;
    for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(v.getUint32(p,true)===0x06054b50){end=p;break;}
    if(end<0||v.getUint16(end+4,true)||v.getUint16(end+6,true))fail();
    const count=v.getUint16(end+10,true);let pos=v.getUint32(end+16,true), total=0;
    if(count>200||pos>=end)fail();
    for(let i=0;i<count;i++) {
      if(pos+46>end||v.getUint32(pos,true)!==0x02014b50)fail();
      const flags=v.getUint16(pos+8,true), method=v.getUint16(pos+10,true), checksum=v.getUint32(pos+16,true), packed=v.getUint32(pos+20,true), size=v.getUint32(pos+24,true), nl=v.getUint16(pos+28,true), extra=v.getUint16(pos+30,true), comment=v.getUint16(pos+32,true), start=v.getUint32(pos+42,true);
      if(flags&1||![0,8].includes(method)||size>12*1024*1024||(total+=size)>20*1024*1024||pos+46+nl+extra+comment>end||start+30>bytes.length)fail();
      const name=dec.decode(bytes.subarray(pos+46,pos+46+nl));pos+=46+nl+extra+comment;
      if(files.has(name)||name.includes('..')||v.getUint32(start,true)!==0x04034b50)fail();
      const from=start+30+v.getUint16(start+26,true)+v.getUint16(start+28,true);
      if(from+packed>bytes.length)fail();
      let result=bytes.subarray(from,from+packed);
      if(method===8) {
        if(!root.DecompressionStream)throw new Error('حدّث المتصفح علشان تقدر تستورد Excel.');
        const reader=new Blob([result]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(), chunks=[];let length=0;
        try { while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>size){await reader.cancel();fail();}chunks.push(value);} }
        finally {reader.releaseLock();}
        result=new Uint8Array(length);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}
      }
      if(result.length!==size||crc(result)!==checksum)fail();
      files.set(name,dec.decode(result));
    }
    return files;
  }
  const nodes=(doc,name)=>Array.from(doc.getElementsByTagNameNS('*',name));
  function parse(value) {
    if(!value||/<!DOCTYPE|<!ENTITY/i.test(value))fail();
    const doc=new DOMParser().parseFromString(value,'application/xml');
    if(nodes(doc,'parsererror').length)fail();return doc;
  }
  async function read(file) {
    try {
      const files=await unzip(file), book=parse(files.get('xl/workbook.xml')), rels=parse(files.get('xl/_rels/workbook.xml.rels'));
      const sheet=nodes(book,'sheet').find(s=>s.getAttribute('name')==='المنتجات')||nodes(book,'sheet')[0];if(!sheet)fail();
      const id=sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
      const rel=nodes(rels,'Relationship').find(r=>r.getAttribute('Id')===id);if(!rel||rel.getAttribute('TargetMode')==='External')fail();
      const target=rel.getAttribute('Target'), path=target?.startsWith('/')?target.slice(1):'xl/'+target;
      const doc=parse(files.get(path));
      const strings=files.has('xl/sharedStrings.xml')?nodes(parse(files.get('xl/sharedStrings.xml')),'si').map(s=>nodes(s,'t').map(t=>t.textContent).join('')):[];
      const rows=[], seenRows=new Set();
      for(const row of nodes(doc,'row')) {
        const n=Number(row.getAttribute('r'));if(!Number.isInteger(n)||n<1||n>20001||seenRows.has(n))fail();seenRows.add(n);
        const cells=[], seen=new Set();
        for(const cell of nodes(row,'c')) {
          const ref=/^([A-Z]{1,3})([0-9]+)$/.exec(cell.getAttribute('r')||'');if(!ref||Number(ref[2])!==n)fail();
          let x=0;for(const c of ref[1])x=x*26+c.charCodeAt(0)-64;x--;if(x>=64||seen.has(x))fail();seen.add(x);
          if(nodes(cell,'f').length)throw new Error(`الصف ${n}: الصيغ مش مسموحة. انسخ النتيجة والصقها كقيمة في Excel.`);
          const type=cell.getAttribute('t'), val=nodes(cell,'v')[0]?.textContent||'';
          if(type==='e')throw new Error(`الصف ${n}: فيه خلية خطأ من Excel.`);
          if(type==='s'&&(!/^\d+$/.test(val)||!Object.hasOwn(strings,Number(val))))fail();
          cells[x]=type==='s'?strings[Number(val)]:type==='inlineStr'?nodes(cell,'t').map(t=>t.textContent).join(''):val;
          if(cells[x].length>8000)throw new Error(`الصف ${n}: النص أطول من المسموح.`);
        }
        rows[n-1]=cells;
      }
      return Array.from({length:rows.length},(_,i)=>rows[i]||[]);
    } catch(e) { if(e instanceof RangeError||e instanceof TypeError)fail();throw e; }
  }
  function download(blob,name) {
    const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  root.App.excel={write,read,download};
})(window);
