// Internal QA only. This entrypoint is never started by Render's npm start.
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { embeddedPool } from './embedded.js';
if(process.env.RENDER || process.env.NODE_ENV==='production')throw new Error('Local QA server must not run in production.');
const pool=embeddedPool(),store=createStore(pool);await store.initialize();
const app=createApp({store,ready:true,rateLimit:200,sendMail:async()=>{},logger:console});
app.listen(Number(process.env.PORT)||4173,'0.0.0.0',()=>console.log('Local QA: ephemeral database, simulated mail only.'));
