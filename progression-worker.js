/** Griffin House of Rooks — FUTURE Progression Worker v2 (DORMANT TEMPLATE)
 * Do NOT deploy/route this until progression.js CONFIG switches are intentionally enabled.
 * Binding required: D1 database named DB. Run progression-schema.sql once.
 * Existing stats-worker.js remains untouched and continues the current legacy stats collection.
 */
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Player-ID,X-Device-Secret'};
const j=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json',...CORS}});
const enc=new TextEncoder();
async function sha256(s){const h=await crypto.subtle.digest('SHA-256',enc.encode(s));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function cleanCode(s){return String(s||'').trim().toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,32);}
function cleanId(s){return String(s||'').trim().slice(0,80);}
async function auth(req,env){const id=cleanId(req.headers.get('X-Player-ID')),sec=String(req.headers.get('X-Device-Secret')||'');if(!id||sec.length<20)return null;const row=await env.DB.prepare('SELECT player_id, secret_hash FROM players WHERE player_id=?').bind(id).first();if(!row)return {newPlayer:true,id,secret:sec};return (await sha256(sec))===row.secret_hash?{id,secret:sec}:null;}
export default {async fetch(req,env){
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS}); if(req.method!=='POST')return j({ok:false,error:'POST only'},405);
 const u=new URL(req.url); let body={}; try{body=await req.json();}catch(e){return j({ok:false,error:'Bad JSON'},400);}
 if(u.pathname==='/v2/recovery/restore'){
   const code=cleanCode(body.code), newSecret=String(body.newDeviceSecret||''); if(!code||newSecret.length<20)return j({ok:false,error:'Invalid recovery request'},400);
   const rh=await sha256(code); const row=await env.DB.prepare('SELECT player_id FROM recovery WHERE recovery_hash=?').bind(rh).first(); if(!row)return j({ok:false,error:'Recovery code not found'},404);
   const sh=await sha256(newSecret); await env.DB.prepare('UPDATE players SET secret_hash=?, updated_at=? WHERE player_id=?').bind(sh,new Date().toISOString(),row.player_id).run();
   return j({ok:true,playerId:row.player_id,deviceSecret:newSecret});
 }
 const a=await auth(req,env); if(!a)return j({ok:false,error:'Unauthorized'},401);
 if(a.newPlayer){const sh=await sha256(a.secret);await env.DB.prepare('INSERT OR IGNORE INTO players(player_id,secret_hash,created_at,updated_at,career_json,achievements_json) VALUES(?,?,?,?,?,?)').bind(a.id,sh,new Date().toISOString(),new Date().toISOString(),'{}','{}').run();}
 if(u.pathname==='/v2/recovery/create'){
   const code=cleanCode(body.code);if(!code)return j({ok:false,error:'Invalid code'},400);const rh=await sha256(code);
   await env.DB.prepare('INSERT OR REPLACE INTO recovery(recovery_hash,player_id,created_at) VALUES(?,?,?)').bind(rh,a.id,new Date().toISOString()).run();return j({ok:true});
 }
 if(u.pathname==='/v2/sync'){
   // Server stores the supplied snapshot. Before public launch, add server-side event validation/rate limiting.
   const career=JSON.stringify(body.career||{}).slice(0,50000), achievements=JSON.stringify(body.achievements||{}).slice(0,50000);
   await env.DB.prepare('UPDATE players SET career_json=?,achievements_json=?,updated_at=? WHERE player_id=?').bind(career,achievements,new Date().toISOString(),a.id).run();return j({ok:true});
 }
 if(u.pathname==='/v2/me'){const row=await env.DB.prepare('SELECT career_json,achievements_json,created_at,updated_at FROM players WHERE player_id=?').bind(a.id).first();return j({ok:true,player:row});}
 return j({ok:false,error:'Not found'},404);
}};
