#!/usr/bin/env python3
"""Deploy an HTTPS reverse proxy for the independently hosted editor (no blog content)."""
import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--config', default=str(root / '.local/editor-deploy-config.json'))
parser.add_argument('--setup', action='store_true', help='Create the dedicated routing project and attach its domain if absent')
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
config = json.loads(Path(args.config).read_text())
origin = urllib.parse.urlsplit(config['origin'])
if origin.scheme != 'https' or not origin.hostname or origin.username or origin.query or origin.fragment:
    raise SystemExit('The upstream must be an HTTPS URL without credentials, query, or fragment')
if not config['domain'] or '/' in config['domain']:
    raise SystemExit('Expected a domain name')
if args.check:
    print('Editor proxy configuration valid (credentials not accessed).')
    raise SystemExit(0)
token = Path(config['tokenFile']).read_text().strip()
proxy_key = Path(config['proxyKeyFile']).read_text().strip()
if len(proxy_key) < 32:
    raise SystemExit('Proxy key must contain at least 32 random characters')

def call(path, body=None, method=None):
    separator = '&' if '?' in path else '?'
    url = 'https://api.vercel.com' + path + separator + urllib.parse.urlencode({'teamId': config['teamId']})
    request = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode(),
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Never print response bodies from credential endpoints.
        raise RuntimeError(f'Vercel HTTP {error.code} for {path.split("?")[0]}') from None

try:
    project = call('/v9/projects/' + config['projectName'])
except RuntimeError as error:
    if not args.setup or 'HTTP 404 ' not in str(error):
        raise
    project = call('/v11/projects', {'name': config['projectName'], 'framework': None,
        'buildCommand': '', 'installCommand': '', 'outputDirectory': None})
project_id = project['id']
if config.get('projectId') and config['projectId'] != project_id:
    raise SystemExit('Editor project identity mismatch')
config['projectId'] = project_id
Path(args.config).write_text(json.dumps(config, indent=2) + '\n')
Path(args.config).chmod(0o600)
# The key is stored as an encrypted Vercel variable, never in deployment source.
call(f'/v10/projects/{project_id}/env?upsert=true', {
    'key': 'EDITOR_PROXY_SECRET', 'value': proxy_key, 'type': 'encrypted', 'target': ['production', 'preview'],
})
if args.setup:
    domains = call(f'/v9/projects/{project_id}/domains').get('domains', [])
    if not any(item['name'] == config['domain'] for item in domains):
        domain = call(f'/v10/projects/{project_id}/domains', {'name': config['domain']})
        print('Editor domain attached; verified:', domain.get('verified'))

routing = {
    'version': 2, 'git': {'deploymentEnabled': False},
    'routes': [{
        'src': '/(.*)', 'dest': config['origin'].rstrip('/') + '/$1',
        'headers': {'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow'},
        'transforms': [
            {'type': 'request.headers', 'op': 'delete', 'target': {'key': 'x-vercel-forwarded-for'}},
            {'type': 'request.headers', 'op': 'delete', 'target': {'key': 'x-real-ip'}},
            {'type': 'request.headers', 'op': 'set', 'target': {'key': 'x-editor-proxy-key'},
            'args': '$EDITOR_PROXY_SECRET', 'env': ['EDITOR_PROXY_SECRET']}],
    }],
}
result = call('/v13/deployments', {'name': config['projectName'], 'project': project_id, 'target': 'production',
    'files': [{'file': 'vercel.json', 'data': json.dumps(routing)},
        {'file': 'proxy-info.txt', 'data': 'PBEngBlog authenticated editor proxy\n'}],
    'projectSettings': {'framework': None, 'buildCommand': '', 'installCommand': '', 'outputDirectory': None},
})
print('Editor routing deployment created:', result['id'], flush=True)
for _ in range(60):
    status = call('/v13/deployments/' + result['id'])
    if status.get('readyState') == 'READY':
        record = {key: status.get(key) for key in ['id', 'url', 'readyState']}
        record.update(projectId=project_id, domain=config['domain'])
        folder = root / '.local/deployments'
        folder.mkdir(parents=True, exist_ok=True)
        (folder / 'editor-production.json').write_text(json.dumps(record, indent=2) + '\n')
        print(json.dumps(record))
        break
    if status.get('readyState') in ['ERROR', 'CANCELED']:
        raise SystemExit('Editor routing deployment failed; inspect Vercel build logs')
    time.sleep(3)
else:
    raise SystemExit('Editor routing deployment still pending; inspect Vercel before retrying')
