import pg from 'pg';
import { createApp } from './app.js';
import { createStore } from './store.js';
import { createMailer } from './mail.js';
const configured=Boolean(process.env.DATABASE_URL&&process.env.RESEND_API_KEY&&process.env.MAIL_FROM);
let store,pool,ready=false;
if(process.env.DATABASE_URL){
 pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:8,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
 pool.on('error',()=>console.error('Database connection interrupted.'));store=createStore(pool);
 try{await store.initialize();ready=configured;}catch{console.error('Database initialization failed. Submission remains disabled.');}
}
const app=createApp({store,ready,sendMail:createMailer({apiKey:process.env.RESEND_API_KEY,mailFrom:process.env.MAIL_FROM}),allowedOrigin:process.env.SITE_URL||process.env.RENDER_EXTERNAL_URL||undefined});
const server=app.listen(Number(process.env.PORT)||4173,'0.0.0.0',()=>console.log(`Civil services portal listening; submissions ${ready?'enabled':'awaiting configuration'}.`));
const shutdown=()=>{server.close(async()=>{await pool?.end();process.exit(0);});setTimeout(()=>process.exit(1),25000).unref();};
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
