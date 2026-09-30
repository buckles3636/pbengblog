#!/usr/bin/env python3
"""Deploy only integrity-checked published static assets to the configured project."""
import argparse, hashlib, json, time, urllib.request, urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('release')
parser.add_argument('--production',action='store_true')
parser.add_argument('--check',action='store_true',help='Validate the release without accessing Vercel')
parser.add_argument('--config',default=str(root/'.local/deploy-config.json'))
args=parser.parse_args()
release=Path(args.release).resolve();manifest=json.loads((release/'manifest.json').read_text())
if manifest.get('preview') is not False or not manifest.get('articles'):raise SystemExit('Only nonempty published releases may be deployed.')
site=release/'site';expected=json.loads((release/'site-checksums.json').read_text())
actual={p.relative_to(site).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in site.rglob('*') if p.is_file()}
if actual!=expected or 'index.html' not in actual:raise SystemExit('Static release integrity check failed.')
if args.check:
 print(f'Validated {len(actual)} static files for {manifest["articles"]} published articles.');raise SystemExit(0)
config=json.loads(Path(args.config).read_text());token=Path(config['tokenFile']).read_text().strip();team=config.get('teamId')
def call(path,body=None,raw=False,headers=None):
 url='https://api.vercel.com'+path+('?teamId='+team if team else '')
 data=body if raw else (None if body is None else json.dumps(body).encode())
 req=urllib.request.Request(url,data=data,headers={'Authorization':'Bearer '+token,'Content-Type':'application/octet-stream' if raw else 'application/json',**(headers or {})})
 try:
  with urllib.request.urlopen(req,timeout=90) as response:
   result=response.read();return json.loads(result) if result else {}
 except urllib.error.HTTPError as e:raise RuntimeError(f'Vercel HTTP {e.code}: {e.read().decode()[:500]}') from None
project=call('/v9/projects/'+config['projectId'])
if project['name']!=config['projectName']:raise SystemExit('Project name/ID mismatch')
def upload(name):
 data=(site/name).read_bytes();digest=hashlib.sha1(data).hexdigest()
 for attempt in range(3):
  try:call('/v2/files',data,True,{'x-vercel-digest':digest,'x-vercel-size':str(len(data))});break
  except RuntimeError:
   if attempt==2:raise
   time.sleep(2**attempt)
 return {'file':name,'sha':digest,'size':len(data)}
with ThreadPoolExecutor(max_workers=4) as pool:files=list(pool.map(upload,sorted(actual)))
files.append({'file':'vercel.json','data':json.dumps({'version':2,'cleanUrls':True,'trailingSlash':False,'git':{'deploymentEnabled':False},'headers':[{'source':'/(.*)','headers':[{'key':'X-Content-Type-Options','value':'nosniff'}]}]})})
body={'name':config['projectName'],'project':config['projectId'],'files':files,'projectSettings':{'framework':None,'buildCommand':'','installCommand':'','outputDirectory':None},'meta':{'pbengblogRelease':manifest['id']}}
if args.production:body['target']='production'
result=call('/v13/deployments',body)
record={k:result.get(k) for k in ['id','url','readyState','projectId']}
record.update(release=manifest['id'],production=args.production,previousProduction=project.get('targets',{}).get('production',{}).get('id'))
log=root/'.local/deployments';log.mkdir(parents=True,exist_ok=True)
(log/(result['id']+'.json')).write_text(json.dumps(record,indent=2)+'\n')
print('Deployment created:',record['url'],flush=True)
for attempt in range(60):
 status=call('/v13/deployments/'+result['id'])
 if status.get('readyState')=='READY':
  record['readyState']='READY';(log/('production.json' if args.production else 'preview.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record));break
 if status.get('readyState') in ['ERROR','CANCELED']:raise SystemExit('Deployment failed: '+str(status.get('errorMessage','Check Vercel logs')))
 time.sleep(3)
else:raise SystemExit('Deployment still pending; check Vercel before retrying.')
