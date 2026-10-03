import { TYPES, questionnaireRows } from '../public/schema.js';
export const GOVERNMENT_UMAIL='nooseunityrp@gmail.com';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function messageFor(row,confirmationPng,{mailFrom}){
 const number=String(row.number).padStart(6,'0');
 const date=new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(row.created_at));
 const rows=[['Numéro de dossier',number],['Type de demande',TYPES[row.type].title],['Date de dépôt',date],['État','Demande enregistrée'],...questionnaireRows(row.type,row.payload).map(f=>[f.label,f.value])];
 const text=['National Office Of Security Enforcement','Confirmation de dépôt jointe en image','',...rows.map(([k,v])=>`${k} : ${v}`),'','Prochaine étape : présentation au Gouvernement de Los Santos.'].join('\n');
 const html=`<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f3f5f7;font-family:Arial,sans-serif;color:#0b2138"><div style="max-width:930px;margin:auto"><img src="cid:confirmation-noose" width="930" alt="Confirmation du dossier ${number}" style="display:block;width:100%;height:auto"><h2 style="font-size:19px;margin-top:32px">Réponses au questionnaire</h2><table width="100%" cellpadding="0" cellspacing="0" style="background:white">${rows.map(([k,v])=>`<tr><td style="padding:12px;border-bottom:1px solid #e1e7ec;font-size:13px;vertical-align:top;color:#60707e;width:45%">${esc(k)}</td><td style="padding:12px;border-bottom:1px solid #e1e7ec;font-size:14px;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table></div></body></html>`;
 return {from:mailFrom,to:[GOVERNMENT_UMAIL],subject:`Confirmation — ${TYPES[row.type].title} — Dossier n°${number}`,text,html,attachments:[{filename:`NOOSE-confirmation-${number}.png`,content:confirmationPng.toString('base64'),content_type:'image/png',content_id:'confirmation-noose'}]};
}
export function createMailer({apiKey,mailFrom,fetcher=fetch}){
 return async function send(row,confirmationPng){
  const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`noose-civil/${row.request_key}/government`},body:JSON.stringify(messageFor(row,confirmationPng,{mailFrom})),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`MAIL_PROVIDER_${response.status}`);
  const result=await response.json();if(!result.id)throw new Error('MAIL_PROVIDER_INVALID_RESPONSE');
 };
}
