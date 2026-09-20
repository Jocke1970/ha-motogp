"""Offline tests; never writes to Home Assistant or needs API credentials."""
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from backend.session_lap_archive import ArchiveError, SessionLapArchive, SpoilerHidden


def sample(session='race-1', status='S', lap=1, seconds="1'29.533", event='event-1',
           rider='rider-1', **changes):
    live = dict(event_id=event, event_name='Grand Prix of Japan',
                category='MotoGP', championship_id='motogp-uuid', session_id=session,
                session_shortname='RAC', session_status_id=status,
                tv_delay_ready=True, tv_delay_seconds=15,
                riders=[dict(rider_id=rider, number='33', surname='Rider', num_lap=lap+1,
                             last_lap=lap, last_lap_time=seconds)])
    live.update(changes)
    return live


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / 'motogp_data'
        self.archive = SessionLapArchive(self.root)
        self.t = datetime(2026, 9, 20, 13, 30, tzinfo=timezone.utc)

    def observe(self, snap):
        return self.archive.observe(snap, 2026, self.t)

    def doc(self, path):
        return json.loads(path.read_text(encoding='utf-8'))

    def test_auto_create_duplicate_no_rewrite_and_recovery(self):
        path = self.observe(sample())
        first = self.doc(path)
        self.assertIn('grand-prix-of-japan_motogp_rac.json', path.name)
        self.assertEqual(first['riders']['rider-1']['laps']['1']['seconds'], 89.533)
        old_mtime = path.stat().st_mtime_ns
        self.observe(sample())
        self.assertEqual(old_mtime, path.stat().st_mtime_ns)
        recovered = SessionLapArchive(self.root)
        same = recovered.observe(sample(lap=2, seconds="1'28.532"), 2026, self.t)
        self.assertEqual(path, same)
        self.assertEqual(set(self.doc(path)['riders']['rider-1']['laps']), {'1', '2'})

    def test_session_switch_preserves_previous_file_even_same_status(self):
        first = self.observe(sample(session='race-1', lap=1))
        second = self.observe(sample(session='race-2', lap=1))
        self.assertNotEqual(first, second)
        self.assertTrue(first.exists())
        self.assertEqual(self.doc(first)['identity']['session_id'], 'race-1')
        self.assertEqual(self.doc(second)['identity']['session_id'], 'race-2')

    def test_finish_red_flag_offline_and_delayed_warmup(self):
        self.assertIsNone(self.observe(sample(tv_delay_ready=False)))
        self.assertIsNone(self.observe(sample(status='N')))
        self.assertFalse(self.root.exists())
        path = self.observe(sample())
        self.assertIsNone(self.observe(None))
        self.observe(sample(status='R'))
        self.assertEqual(self.doc(path)['status'], 'R')
        self.observe(sample(status='D'))
        self.assertEqual(self.doc(path)['status'], 'D')
        self.observe(sample(status='F'))
        self.assertTrue(self.doc(path)['ended'])
        self.assertTrue(path.exists())

    def test_missing_ids_invalid_lap_and_partial_coverage(self):
        self.assertIsNone(self.observe(sample(session_id='')))
        path = self.observe(sample(lap=4))
        self.assertEqual(self.doc(path)['coverage']['missing_laps_by_rider'],
                         {'rider-1': [1, 2, 3]})
        self.observe(sample(lap=1, seconds='99:90.000'))
        self.assertEqual(self.doc(path)['coverage']['observed_laps'], 1)
        self.observe(sample(lap=2, seconds="1'31.000"))
        self.observe(sample(lap=3, seconds="1'30.000"))
        self.observe(sample(lap=1, seconds="1'29.500"))
        self.assertFalse(self.doc(path)['coverage']['partial'])
        self.assertEqual(self.doc(path)['riders']['rider-1']['laps']['1']['seconds'], 89.5)

    def test_no_spoiler_and_source_readiness(self):
        path = self.observe(sample())
        identity = self.doc(path)['identity']
        with self.assertRaises(SpoilerHidden):
            self.archive.read(identity, no_spoiler=True)
        self.assertEqual(self.archive.read(identity, no_spoiler=False)['status'], 'S')
        self.assertIsNone(self.observe(sample(tv_delay_ready=None)))
        self.assertIsNone(self.observe(sample(tv_delay_ready=False, seconds="1'20.000")))
        self.assertEqual(self.doc(path)['riders']['rider-1']['laps']['1']['seconds'], 89.533)

    def test_corrupt_file_and_name_change_cannot_silently_overwrite(self):
        path = self.observe(sample())
        path.write_text('{corrupt', encoding='utf-8')
        with self.assertRaises(ArchiveError):
            SessionLapArchive(self.root).observe(sample(), 2026, self.t)
        self.assertEqual(path.read_text(encoding='utf-8'), '{corrupt')

    def test_event_rename_reuses_id_based_file(self):
        path = self.observe(sample())
        again = SessionLapArchive(self.root).observe(
            sample(event_name='Sponsored Grand Prix of Japan', lap=2), 2026, self.t)
        self.assertEqual(path, again)
        self.assertEqual(self.doc(path)['coverage']['observed_laps'], 2)

    def test_collision_disambiguates_and_does_not_merge_riders(self):
        path = self.observe(sample())
        different_event = self.observe(sample(event='different-event'))
        self.assertNotEqual(path, different_event)
        self.assertTrue(different_event.name.endswith('.json'))
        self.observe(sample(event='different-event', rider='another', lap=1))
        self.assertEqual(len(self.doc(different_event)['riders']), 2)

    def test_finished_first_observation_is_partial_not_full_history(self):
        path = self.observe(sample(status='F', lap=28))
        self.assertTrue(self.doc(path)['ended'])
        self.assertTrue(self.doc(path)['coverage']['partial'])
        self.assertEqual(self.doc(path)['coverage']['observed_laps'], 1)

    def test_rejects_naive_clock(self):
        with self.assertRaises(ValueError):
            self.archive.observe(sample(), 2026, datetime(2026, 9, 20))


if __name__ == '__main__':
    unittest.main()
