import express from 'express';
import { fileURLToPath } from 'node:url';
import { validate,cleanData,TYPES } from '../public/schema.js';
import { publicReceipt } from './store.js';
import { renderReceiptImage } from './receipt-image.js';
export function createApp({store,sendMail,ready=false,allowedOrigin,rateLimit=30,logger=console,renderImage=renderReceiptImage}){
 const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
 app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"});if(req.secure)res.set('Strict-Transport-Security','max-age=31536000');next();});
 app.get('/healthz',(_req,res)=>res.json({status:'ok'}));
 app.get('/api/status',async(_req,res)=>{res.set('Cache-Control','no-store');try{if(!ready)throw new Error();await store.healthy();res.json({acceptingApplications:true});}catch{res.json({acceptingApplications:false});}});
 app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 const rates=new Map();
 app.post('/api/applications',express.json({limit:'24kb'}),async(req,res)=>{
  const now=Date.now();for(const [key,b] of rates)if(b.until<=now)rates.delete(key);
  const ip=req.ip||req.socket.remoteAddress,bucket=rates.get(ip)||{count:0,until:now+15*60*1000};
  if(++bucket.count>rateLimit){res.set('Retry-After',String(Math.ceil((bucket.until-now)/1000)));return res.status(429).json({message:'Trop de tentatives rapprochées. Réessayez dans quelques minutes.'});}rates.set(ip,bucket);
  if(!req.is('application/json'))return res.status(415).json({message:'Le format de la demande est invalide.'});
  const origin=req.get('Origin');if(origin && origin!==(allowedOrigin||`${req.protocol}://${req.get('host')}`))return res.status(403).json({message:'Veuillez envoyer votre demande depuis ce portail.'});
  if(!ready)return res.status(503).json({message:'Le dépôt en ligne est momentanément indisponible. Votre formulaire est conservé dans cet onglet ; veuillez réessayer ultérieurement.'});
  const body=req.body;if(!body||typeof body!=='object'||!Object.hasOwn(TYPES,body.type)||!body.data||Array.isArray(body.data))return res.status(400).json({message:'La demande est incomplète.'});
  const requestKey=req.get('Idempotency-Key');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey||''))return res.status(400).json({message:'Veuillez reprendre votre demande depuis l’accueil.'});
  if(body.website)return res.status(400).json({message:'La demande ne peut pas être transmise.'});
  const fields=validate(body.type,body.data);if(Object.keys(fields).length)return res.status(422).json({message:'Veuillez corriger les champs indiqués.',fields});
  if(body.attest?.accurate!==true||body.attest?.understood!==true)return res.status(422).json({message:'Les deux déclarations doivent être acceptées.'});
  try{
   const data=cleanData(body.type,body.data);let row=await store.reserve(requestKey,body.type,data);
   const confirmationPng=await renderImage(row);
   try{row=await store.deliver(requestKey,'government',record=>sendMail(record,confirmationPng));}catch(error){if(error.status)throw error;logger.error('Government mail not acknowledged; request retained for retry.');return res.status(502).json({message:'La transmission au Gouvernement n’a pas pu être confirmée. Réessayez avec cette même demande : votre numéro sera conservé.'});}
   return res.status(201).json({...publicReceipt(row),confirmationImage:'data:image/png;base64,'+confirmationPng.toString('base64')});
  }catch(error){if(error.status)return res.status(error.status).json({message:error.message});logger.error('Application processing unavailable.');return res.status(503).json({message:'Votre demande n’a pas pu être finalisée. Réessayez l’envoi depuis cette page.'});}
 });
 app.use('/api',(_req,res)=>res.status(404).json({message:'Ressource introuvable.'}));
 app.use(express.static(fileURLToPath(new URL('../public',import.meta.url)),{index:'index.html',maxAge:0,dotfiles:'deny'}));
 app.use((_req,res)=>res.status(404).type('text').send('Page introuvable. Retournez à l’accueil du portail.'));
 app.use((error,_req,res,_next)=>res.status(error.status===413?413:400).json({message:error.status===413?'Le formulaire dépasse la taille autorisée.':'La demande ne peut pas être lue. Vérifiez vos informations.'}));
 return app;
}
