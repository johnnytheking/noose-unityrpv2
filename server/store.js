import { createHash } from 'node:crypto';
export const MIGRATION = `
CREATE SCHEMA IF NOT EXISTS noose_civil;
CREATE TABLE IF NOT EXISTS noose_civil.counter (singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), value bigint NOT NULL DEFAULT 0 CHECK (value >= 0));
INSERT INTO noose_civil.counter (singleton, value) VALUES (true, 0) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS noose_civil.applications (
 request_key uuid PRIMARY KEY, number bigint NOT NULL UNIQUE,
 type text NOT NULL CHECK (type IN ('tourist','work','identity')),
 payload jsonb NOT NULL, payload_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 government_sent boolean NOT NULL DEFAULT false, applicant_sent boolean NOT NULL DEFAULT false,
 government_attempt_at timestamptz, applicant_attempt_at timestamptz
);`;
export class RequestError extends Error { constructor(status,message){super(message);this.status=status;} }
const hash = obj => createHash('sha256').update(JSON.stringify(obj)).digest('hex');
export function createStore(pool) {
 return {
  async initialize(){await pool.query(MIGRATION);},
  async healthy(){await pool.query('SELECT 1');},
  async reserve(key,type,data){
   const client=await pool.connect();
   try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);
    let {rows:[row]}=await client.query('SELECT * FROM noose_civil.applications WHERE request_key=$1',[key]);
    const digest=hash({type,data});
    if(row && row.payload_hash!==digest)throw new RequestError(409,'Cette tentative correspond déjà à un dossier enregistré avec d’autres informations. Réutilisez les informations initiales pour terminer son envoi.');
    if(!row){
     const {rows:[counter]}=await client.query('UPDATE noose_civil.counter SET value=value+1 WHERE singleton=true RETURNING value');
     ({rows:[row]}=await client.query('INSERT INTO noose_civil.applications (request_key,number,type,payload,payload_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *',[key,counter.value,type,JSON.stringify(data),digest]));
    }
    await client.query('COMMIT');return row;
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  },
  async deliver(key,recipient,send){
   if(recipient!=='government')throw new Error('Only government delivery is permitted.');
   const client=await pool.connect();
   const sent=recipient==='government'?'government_sent':'applicant_sent';
   const attempted=recipient==='government'?'government_attempt_at':'applicant_attempt_at';
   try {
    // Session lock covers commits and the external request, including retries.
    await client.query('SELECT pg_advisory_lock(hashtext($1))',[key]);
    let {rows:[row]}=await client.query('SELECT * FROM noose_civil.applications WHERE request_key=$1',[key]);
    if(row[sent])return row;
    // Resend keys expire after 24h. An uncertain older attempt needs review.
    if(row[attempted] && Date.now()-new Date(row[attempted]).getTime()>23*60*60*1000)throw new RequestError(409,'L’état de cet envoi nécessite une vérification auprès du Gouvernement. Conservez votre demande et ne créez pas de nouveau dossier.');
    if(!row[attempted])({rows:[row]}=await client.query(`UPDATE noose_civil.applications SET ${attempted}=now() WHERE request_key=$1 RETURNING *`,[key]));
    await send(row,recipient);
    ({rows:[row]}=await client.query(`UPDATE noose_civil.applications SET ${sent}=true WHERE request_key=$1 RETURNING *`,[key]));
    return row;
   }finally{try{await client.query('SELECT pg_advisory_unlock(hashtext($1))',[key]);}finally{client.release();}}
  }
 };
}
export function publicReceipt(row){return {status:'submitted',number:String(row.number).padStart(6,'0'),type:row.type,lastName:row.payload.lastName,firstName:row.payload.firstName,createdAt:new Date(row.created_at).toISOString()};}
