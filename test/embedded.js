import { PGlite } from '@electric-sql/pglite';
export function embeddedPool(directory){
 const db=new PGlite(directory);let tail=Promise.resolve();
 const query=async(sql,params)=>params?db.query(sql,params):sql.includes(';')?db.exec(sql):db.query(sql);
 return {db,query,async connect(){let release;const next=new Promise(resolve=>{release=resolve;});const previous=tail;tail=next;await previous;return {query,release};},async end(){await db.close();}};
}
