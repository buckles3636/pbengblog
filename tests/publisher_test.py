import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import uuid

spec=importlib.util.spec_from_file_location('publisher',Path(__file__).resolve().parents[1]/'scripts/publisher.py')
publisher=importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)

class PublisherTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.root_patch=patch.object(publisher,'ROOT',self.root);self.root_patch.start()
        self.worker=publisher.Publisher.__new__(publisher.Publisher)
        self.worker.folder=self.root/'.local/publications';self.worker.folder.mkdir(parents=True)
        self.worker.update=Mock()
        self.job={'id':uuid.uuid4(),'state':'queued'}
    def tearDown(self):
        self.root_patch.stop();self.temp.cleanup()
    def test_uncertain_submission_is_never_blindly_retried(self):
        self.assertEqual(publisher.outcome({}),'needs_review')
        self.assertEqual(publisher.outcome({'phase':'submitting'}),'needs_review')
        self.assertEqual(publisher.outcome({'phase':'uploading'}),'failed')
        self.assertEqual(publisher.outcome({'phase':'deploying','id':'dpl_test'}),'reconcile')
        self.assertEqual(publisher.outcome({'phase':'ready','id':'dpl_test'}),'succeeded')
    def test_build_failure_never_calls_deployer(self):
        self.worker.run=Mock(return_value=1)
        self.worker.execute(self.job)
        self.assertEqual(self.worker.run.call_count,1)
        self.assertEqual(self.worker.update.call_args.args[1],'failed')
    def test_fixed_commands_and_exact_job_release(self):
        release=self.root/'.local/releases/test-release';release.mkdir(parents=True)
        (release/'manifest.json').write_text(json.dumps({'id':'test-release','publicationId':str(self.job['id'])}))
        (self.root/'.local/prepared-release').write_text('.local/releases/test-release')
        self.worker.run=Mock(return_value=0);self.worker.reconcile=Mock()
        self.worker.execute(self.job)
        self.assertEqual(self.worker.run.call_args_list[0].args[0],['bash','scripts/prepare-release.sh','--publication-id',str(self.job['id'])])
        self.assertEqual(self.worker.run.call_args_list[1].args[0][:4],['python3','scripts/deploy.py',str(release),'--production'])
        self.worker.reconcile.assert_called_once()
    def test_mismatched_release_never_deploys(self):
        release=self.root/'.local/releases/test-release';release.mkdir(parents=True)
        (release/'manifest.json').write_text(json.dumps({'id':'test-release','publicationId':str(uuid.uuid4())}))
        (self.root/'.local/prepared-release').write_text('.local/releases/test-release')
        self.worker.run=Mock(return_value=0)
        self.worker.execute(self.job)
        self.assertEqual(self.worker.run.call_count,1)
        self.assertEqual(self.worker.update.call_args.args[1],'failed')
    def test_missing_deployment_receipt_requires_review(self):
        self.worker.reconcile(self.job)
        self.assertEqual(self.worker.update.call_args.args[1],'needs_review')
    def test_completed_receipt_recovers_success(self):
        _,record=self.worker.paths(self.job)
        record.write_text(json.dumps({'phase':'ready','id':'dpl_test','release':'test'}))
        self.worker.reconcile(self.job)
        self.assertEqual(self.worker.update.call_args.args[1],'succeeded')
if __name__=='__main__': unittest.main()
