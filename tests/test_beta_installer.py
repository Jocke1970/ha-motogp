"""Offline fail-closed installation tests with synthetic baseline and fake download."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

FILE = Path(__file__).resolve().parents[1] / 'scripts' / 'install-session-archive-beta.py'
spec = importlib.util.spec_from_file_location('beta_installer', FILE)
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
FAKE_COORD = (b'from .api import MotogpApiClient, MotogpApiError\n'
              b'class Dummy:\n'
              b'    def __init__(self, hass, api):\n'
              b'        self.api = api\n'
              b'    async def update(self):\n'
              b'        live = None\n'
              b'        # 3. Detect state transitions and fire events\n')
FAKE_MODULE = b'class ArchiveError(Exception): pass\nclass SessionLapArchive:\n    def __init__(self, path): pass\n'

class BetaInstallerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.config = Path(self.tmp.name)
        self.integration = self.config / 'custom_components' / 'motogp_sensor'
        self.integration.mkdir(parents=True)
        self.original_expected = installer.EXPECTED
        installer.EXPECTED = {name: installer.blob(FAKE_COORD if name == 'coordinator.py' else b'file')
                              for name in self.original_expected}
        self.original_module_blob = installer.ARCHIVE_BLOB
        installer.ARCHIVE_BLOB = installer.blob(FAKE_MODULE)
        self.addCleanup(self.restore_globals)
        for name in self.original_expected:
            (self.integration / name).write_bytes(FAKE_COORD if name == 'coordinator.py' else b'file')
        self.module_patcher = patch.object(installer, 'get_module', return_value=FAKE_MODULE)
        self.module_patcher.start()
        self.addCleanup(self.module_patcher.stop)

    def restore_globals(self):
        installer.EXPECTED = self.original_expected
        installer.ARCHIVE_BLOB = self.original_module_blob

    def test_check_install_rollback_and_backup_cleanup(self):
        installer.install(self.config, check_only=True)
        self.assertFalse((self.config / installer.MARKER).exists())
        installer.install(self.config, check_only=False)
        self.assertTrue((self.config / installer.MARKER).exists())
        self.assertNotEqual((self.integration / 'coordinator.py').read_bytes(), FAKE_COORD)
        self.assertTrue((self.integration / 'session_lap_archive.py').exists())
        self.assertRaises(RuntimeError, installer.install, self.config, check_only=False)
        installer.rollback(self.config)
        self.assertEqual((self.integration / 'coordinator.py').read_bytes(), FAKE_COORD)
        self.assertFalse((self.integration / 'session_lap_archive.py').exists())
        self.assertFalse((self.config / '.motogp_session_beta').exists())

    def test_unrecognized_baseline_blocks_without_writes(self):
        (self.integration / 'helpers.py').write_bytes(b'customized')
        with self.assertRaises(RuntimeError):
            installer.install(self.config, check_only=False)
        self.assertFalse((self.config / '.motogp_session_beta').exists())

    def test_changed_candidate_blocks_rollback_without_overwriting(self):
        installer.install(self.config, check_only=False)
        (self.integration / 'coordinator.py').write_bytes(b'changed by another update')
        with self.assertRaises(RuntimeError):
            installer.rollback(self.config)
        self.assertEqual((self.integration / 'coordinator.py').read_bytes(), b'changed by another update')
        self.assertTrue((self.config / installer.MARKER).exists())

    def test_symlink_module_refused(self):
        (self.integration / 'session_lap_archive.py').symlink_to(self.integration / 'helpers.py')
        with self.assertRaises(RuntimeError):
            installer.install(self.config, check_only=True)
        self.assertEqual((self.integration / 'helpers.py').read_bytes(), b'file')

if __name__ == '__main__':
    unittest.main()
