import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { messageFor,createMailer } from '../server/mail.js';
import { renderReceiptImage } from '../server/receipt-image.js';
import { questionnaireRows,validate } from '../public/schema.js';
import { embeddedPool } from './embedded.js';
import { body,fixtures } from './fixtures.js';

test('Three application journeys, sequential durable numbers, retries, validation and mail errors',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'noose-test-'));
 let pool=embeddedPool(directory),store=createStore(pool);await store.initialize();
 const sent=[],failure={government:false};
 const sendMail=async(row,image)=>{if(failure.government)throw new Error('Provider unavailable');sent.push({key:row.request_key,recipient:'government',number:row.number,image});};
 const app=createApp({store,sendMail,ready:true,rateLimit:200,logger:{error(){}}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const url=`http://127.0.0.1:${server.address().port}`;
 const submit=async(data,key=randomUUID(),extra={})=>{const res=await fetch(`${url}/api/applications`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key,...extra},body:JSON.stringify(data)});return {status:res.status,data:await res.json()};};
 try{
  await t.test('All three types: stored answers, government message and receipt',async()=>{
   let n=1;for(const type of ['tourist','work','identity']){const result=await submit(body(type));assert.equal(result.status,201);assert.equal(result.data.number,String(n++).padStart(6,'0'));assert.equal(result.data.type,type);assert.equal(result.data.status,'submitted');assert.equal(result.data.applicantMail,undefined);assert.ok(result.data.confirmationImage.startsWith('data:image/png;base64,'));assert.equal(result.data.confirmationImage.split(',')[1],sent.find(x=>String(x.number)===String(Number(result.data.number))).image.toString('base64'));}
   assert.equal(sent.length,3);const {rows}=await pool.query('SELECT payload FROM noose_civil.applications');assert.equal(rows.length,3);assert.equal(rows[2].payload.reason,'Première demande');
   const reasons=questionnaireRows('identity',fixtures.identity).filter(f=>f.label.endsWith('?'));assert.equal(reasons.find(f=>f.label==='S’agit-il d’une première demande ?').value,'Oui');assert.equal(reasons.find(f=>f.label==='Vol ?').value,'Non');
  });
  await t.test('Duplicate submissions keep one number and one government message',async()=>{const key=randomUUID();const results=await Promise.all(Array.from({length:5},()=>submit(body('tourist'),key)));assert.ok(results.every(r=>r.status===201));assert.equal(new Set(results.map(r=>r.data.number)).size,1);assert.equal(sent.filter(x=>x.key===key).length,1);});
  await t.test('Concurrent independent requests get consecutive unique numbers',async()=>{const results=await Promise.all(Array.from({length:8},()=>submit(body('tourist'))));const ns=results.map(r=>Number(r.data.number)).sort((a,b)=>a-b);assert.deepEqual(ns,[5,6,7,8,9,10,11,12]);});
  await t.test('Required fields, impossible date, optional Umail and employer condition',async()=>{for(const data of [{...body('work'),data:{...fixtures.work,hasEmployer:'Oui'}},{...body('tourist'),data:{...fixtures.tourist,birthDate:'2025-02-30'}},{...body('identity'),data:{...fixtures.identity,notes:''}},{...body('identity'),data:{...fixtures.identity,umail:'incorrect'}}])assert.equal((await submit(data)).status,422);assert.deepEqual(validate('work',fixtures.work),{});assert.equal((await submit({...body('tourist'),attest:{}})).status,422);});
  await t.test('Provider failure never produces confirmation; retry reuses dossier',async()=>{failure.government=true;const key=randomUUID();const failed=await submit(body('tourist'),key);assert.equal(failed.status,502);assert.equal(failed.data.number,undefined);const {rows:[r]}=await pool.query('SELECT * FROM noose_civil.applications WHERE request_key=$1',[key]);assert.equal(r.government_sent,false);failure.government=false;const retry=await submit(body('tourist'),key);assert.equal(retry.data.number,String(r.number).padStart(6,'0'));assert.equal(retry.status,201);});
  await t.test('A supplied Umail never receives a message',async()=>{const data={...body('identity'),data:{...fixtures.identity,umail:'recipient@example.com'}};const before=sent.length;const result=await submit(data);assert.equal(result.status,201);assert.equal(result.data.applicantMail,undefined);assert.equal(sent.length,before+1);assert.equal(sent.at(-1).recipient,'government');});
  await t.test('Immutable retries and unknown origins are rejected',async()=>{const key=randomUUID();await submit(body('tourist'),key);assert.equal((await submit({...body('tourist'),data:{...fixtures.tourist,firstName:'Changed'}},key)).status,409);assert.equal((await submit(body('tourist'),randomUUID(),{Origin:'https://unrelated.example'})).status,403);assert.equal((await fetch(`${url}/api/applications`)).status,404);assert.equal((await fetch(`${url}/api/applications/000001`)).status,404);});
  await t.test('Fixed recipient, high resolution PNG and all questionnaire answers',async()=>{const row={request_key:randomUUID(),number:123,type:'tourist',payload:{...fixtures.tourist,umail:'other@example.com',notes:'<script>alert(1)</script>'},created_at:new Date()};const png=await renderReceiptImage(row);assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1860);const mail=messageFor(row,png,{mailFrom:'office@example.com'});assert.deepEqual(mail.to,['nooseunityrp@gmail.com']);assert.equal(mail.cc,undefined);assert.equal(mail.bcc,undefined);assert.ok(mail.text.includes('000123'));assert.ok(mail.html.includes('&lt;script&gt;'));assert.ok(!mail.html.includes('<script>'));assert.equal(mail.attachments[0].content_id,'confirmation-noose');assert.equal(mail.attachments[0].content,png.toString('base64'));let opts;const send=createMailer({apiKey:'fake-test-key',mailFrom:'office@example.com',fetcher:async(_url,o)=>{opts=o;return {ok:true,json:async()=>({id:'test'})};}});await send(row,png);assert.equal(opts.headers['Idempotency-Key'],`noose-civil/${row.request_key}/government`);assert.deepEqual(JSON.parse(opts.body).to,['nooseunityrp@gmail.com']);});
  await t.test('Counter and dossiers survive database reopening',async()=>{const {rows:[before]}=await pool.query('SELECT value FROM noose_civil.counter');await pool.end();pool=embeddedPool(directory);store=createStore(pool);await store.initialize();const row=await store.reserve(randomUUID(),'tourist',fixtures.tourist);assert.equal(Number(row.number),Number(before.value)+1);});
 }finally{await new Promise(r=>server.close(r));await pool.end();await rm(directory,{recursive:true,force:true});}
});
test('Unconfigured production service fails closed',async()=>{const app=createApp({});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{const url=`http://127.0.0.1:${server.address().port}`;assert.equal((await fetch(`${url}/api/status`).then(r=>r.json())).acceptingApplications,false);const res=await fetch(`${url}/api/applications`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body('tourist'))});assert.equal(res.status,503);}finally{await new Promise(r=>server.close(r));}});
