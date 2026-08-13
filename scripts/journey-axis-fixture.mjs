// READ-ONLY capture of real production answers for the invariance test.
import fs from "node:fs";
const env=Object.fromEntries(fs.readFileSync("/Users/uxellent/mioshy/.env.local","utf8").split("\n").filter(l=>l.trim()&&!l.trim().startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")];}));
const BASE=`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`,H={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`};
async function all(t,s){const o=[];for(let f=0;;f+=1000){const r=await fetch(`${BASE}/${t}?select=${s}`,{cache:"no-store",headers:{...H,Range:`${f}-${f+999}`}});const d=await r.json();o.push(...d);if(d.length<1000)break;}return o;}
const questions=(await all("journey_questions","slug,type,axes,options")).map(q=>({slug:q.slug,type:q.type,axes:q.axes??[],options:q.options??null}));
const raw=(await all("journey_responses","journey_id,question_id,answer,created_at"));
// Anonymise the journey id. The test only needs answers GROUPED by respondent,
// never who they are, and a real uuid in the repo is a pseudonymous identifier
// we have no reason to carry. Stable per run; not reversible.
const idMap=new Map();
const responses=raw.map(r=>{
  if(!idMap.has(r.journey_id)) idMap.set(r.journey_id, `j${String(idMap.size).padStart(4,"0")}`);
  return {journey_id:idMap.get(r.journey_id),question_id:r.question_id,answer:r.answer,created_at:r.created_at};
});
fs.writeFileSync("tests/journey/__fixtures__/journey-axis-fixture.json",JSON.stringify({questions,responses},null,0));
console.log(`questions=${questions.length} responses=${responses.length} journeys=${idMap.size} (ids anonymised)`);
