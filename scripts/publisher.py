#!/usr/bin/env python3
"""Single-consumer publication worker. Executes fixed local scripts, never queued commands."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import urllib.parse
import urllib.request
import uuid

import psycopg
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]
STOP = False


def request_stop(*_):
    global STOP
    STOP = True


def outcome(record):
    """Distinguish safe retry from a possibly accepted remote submission."""
    if record.get('phase') == 'ready' and record.get('id'):
        return 'succeeded'
    if record.get('phase') == 'failed':
        return 'failed'
    if record.get('id'):
        return 'reconcile'
    if record.get('phase') == 'uploading':
        return 'failed'
    return 'needs_review'


class Publisher:
    def __init__(self, config):
        self.connection = psycopg.connect(config['databaseUrl'], autocommit=True, row_factory=dict_row,
                                           connect_timeout=10, options='-c statement_timeout=15000')
        locked = self.connection.execute('SELECT pg_try_advisory_lock(563632027) AS locked').fetchone()['locked']
        if not locked:
            raise RuntimeError('Another publisher already owns this database')
        self.folder = ROOT / '.local/publications'
        self.folder.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.last_reconcile = 0

    def heartbeat(self):
        self.connection.execute('INSERT INTO publisher_state(id,heartbeat_at) VALUES (true,now()) '
                                'ON CONFLICT(id) DO UPDATE SET heartbeat_at=now()')

    def update(self, job, state, message, deployment_id=None, release_id=None):
        self.connection.execute("""UPDATE publication_jobs SET state=%s,message=%s,updated_at=now(),
            deployment_id=COALESCE(%s,deployment_id),release_id=COALESCE(%s,release_id),
            finished_at=CASE WHEN %s IN ('succeeded','failed') THEN now() ELSE NULL END WHERE id=%s""",
            (state, message, deployment_id, release_id, state, job['id']))
        print(f"Publication {job['id']}: {state}", flush=True)

    def paths(self, job):
        job_id = str(uuid.UUID(str(job['id'])))
        return self.folder / (job_id + '.log'), self.folder / (job_id + '.json')

    def run(self, args, job, timeout):
        log, _ = self.paths(job)
        container = 'pb-publish-' + str(job['id'])
        env = {**os.environ, 'PB_RELEASE_LOCK_HELD': '1', 'PB_NODE_CONTAINER_NAME': container}
        with log.open('ab') as output:
            process = subprocess.Popen(args, cwd=ROOT, env=env, stdout=output, stderr=subprocess.STDOUT,
                                       start_new_session=True)
            deadline = time.monotonic() + timeout
            try:
                while process.poll() is None:
                    self.heartbeat()
                    if STOP or time.monotonic() > deadline or log.stat().st_size > 10 * 1024 * 1024:
                        raise RuntimeError('Publication interrupted or exceeded its limits')
                    time.sleep(2)
                return process.returncode
            finally:
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()
                    subprocess.run(['docker', 'rm', '-f', container], stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, timeout=20)

    def reconcile(self, job):
        _, record_path = self.paths(job)
        try:
            record = json.loads(record_path.read_text())
        except (FileNotFoundError, ValueError):
            record = {}
        result = outcome(record)
        if result == 'reconcile':
            try:
                config = json.loads((ROOT / '.local/deploy-config.json').read_text())
                token = Path(config['tokenFile']).read_text().strip()
                query = urllib.parse.urlencode({'teamId': config['teamId']}) if config.get('teamId') else ''
                url = 'https://api.vercel.com/v13/deployments/' + urllib.parse.quote(record['id'], safe='') + '?' + query
                request = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
                with urllib.request.urlopen(request, timeout=20) as response:
                    remote = json.load(response)
                if remote.get('projectId') != config['projectId']:
                    raise RuntimeError('Deployment project mismatch')
                if remote.get('readyState') == 'READY':
                    result = 'succeeded'
                elif remote.get('readyState') in ['ERROR', 'CANCELED']:
                    result = 'failed'
                else:
                    result = 'needs_review'
            except Exception:
                result = 'needs_review'
        messages = {
            'succeeded': 'Published to website',
            'failed': 'Deployment failed. Your draft is saved; you can try publishing again.',
            'needs_review': 'Deployment status is uncertain. Check the deployment before publishing again.',
        }
        self.update(job, result, messages[result], record.get('id'), record.get('release'))
        if result == 'succeeded':
            # Keep CLI rollback metadata accurate even after worker/process restarts.
            saved = ROOT / '.local/deployments' / (record['id'] + '.json')
            if saved.is_file():
                metadata = json.loads(saved.read_text())
                metadata['readyState'] = 'READY'
                target = saved.parent / 'production.json'
                tmp = target.with_suffix('.tmp')
                tmp.write_text(json.dumps(metadata, indent=2) + '\n')
                tmp.replace(target)

    def execute(self, job):
        self.update(job, 'building', 'Building website from the saved publication')
        try:
            code = self.run(['bash', 'scripts/prepare-release.sh', '--publication-id', str(job['id'])], job, 900)
        except Exception:
            code = 1
        if code:
            self.update(job, 'failed', 'Website build failed or was interrupted. Your draft is saved; try publishing again.')
            return
        release = (ROOT / (ROOT / '.local/prepared-release').read_text().strip()).resolve()
        manifest = json.loads((release / 'manifest.json').read_text())
        if manifest.get('publicationId') != str(job['id']):
            self.update(job, 'failed', 'Publication integrity check failed. Your draft is saved.')
            return
        self.update(job, 'deploying', 'Deploying website', release_id=manifest['id'])
        _, record_path = self.paths(job)
        try:
            self.run(['python3', 'scripts/deploy.py', str(release), '--production',
                      '--publication-id', str(job['id']), '--record-file', str(record_path)], job, 900)
        except Exception:
            pass
        self.reconcile(job)

    def tick(self):
        self.heartbeat()
        job = self.connection.execute("SELECT id,state FROM publication_jobs WHERE state IN "
            "('queued','building','deploying','needs_review') ORDER BY created_at LIMIT 1").fetchone()
        if not job:
            return
        with (ROOT / '.local/publish.lock').open('a') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                return
            if job['state'] == 'queued':
                self.execute(job)
            elif job['state'] == 'building':
                # Kill a build left behind by an unclean worker/host stop before accepting another.
                subprocess.run(['docker', 'rm', '-f', 'pb-publish-' + str(job['id'])],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=20)
                self.update(job, 'failed', 'The publisher restarted during the build. Your draft is saved; publish again.')
            elif time.monotonic() - self.last_reconcile > 30:
                self.reconcile(job)
                self.last_reconcile = time.monotonic()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', default=str(ROOT / '.local/publisher-config.json'))
    parser.add_argument('--once', action='store_true', help='Process at most one job (maintenance/testing)')
    args = parser.parse_args()
    os.umask(0o077)
    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    worker = Publisher(json.loads(Path(args.config).read_text()))
    try:
        while not STOP:
            worker.tick()
            if args.once:
                break
            for _ in range(3):
                if STOP:
                    break
                time.sleep(1)
    finally:
        worker.connection.execute("UPDATE publisher_state SET heartbeat_at='epoch' WHERE id=true")
        worker.connection.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Connection strings and arbitrary build output never enter the public status or journal.
        print('Publisher stopped (' + type(error).__name__ + '); inspect private job logs.', flush=True)
        raise SystemExit(1)
