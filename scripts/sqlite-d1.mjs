// Local-only D1 adapter. Production continues to use the platform DB binding.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const program=`import sqlite3,sys,json
p=json.load(sys.stdin)
db=sqlite3.connect(p['file'])
db.row_factory=sqlite3.Row
if 'script' in p:
 db.executescript(p['script']);db.commit();print('{}')
else:
 c=db.execute(p['sql'],p['args']);rows=[dict(r) for r in c.fetchall()];db.commit();print(json.dumps({'results':rows}))
db.close()
`;
export function database(file){
  const run=p=>{const r=spawnSync('python3',['-c',program],{input:JSON.stringify({file,...p}),encoding:'utf8'});if(r.status!==0)throw new Error('Local database query failed: '+r.stderr);return JSON.parse(r.stdout);};
  return {migrate(){for(const f of ['drizzle/0000_user_progress.sql','drizzle/0001_medical_documents.sql','drizzle/0002_nutrition_entries.sql'])run({script:readFileSync(f,'utf8').replace(/CREATE TABLE `/g,'CREATE TABLE IF NOT EXISTS `').replace(/CREATE INDEX `/g,'CREATE INDEX IF NOT EXISTS `')});},prepare(sql){let args=[];return {bind(...values){args=values;return this;},async all(){return run({sql,args});},async first(){return run({sql,args}).results[0]||null;},async run(){return run({sql,args});}};}};
}
