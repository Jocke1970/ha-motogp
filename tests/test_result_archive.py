"""Offline regression tests for the isolated historical-results module."""

import unittest

from backend.result_archive import (
    ArchiveFormatError,
    ResultArchive,
    ResultsHidden,
    ResultUnavailable,
)


class FakeApi:
    def __init__(self):
        self.sessions = {}
        self.classifications = {}
        self.session_calls = []
        self.classification_calls = []

    async def async_get_sessions(self, event_id, category_id):
        self.session_calls.append((event_id, category_id))
        return self.sessions.get((event_id, category_id), [])

    async def async_get_classification(self, session_id):
        self.classification_calls.append(session_id)
        return self.classifications.get(session_id, {"classification": []})


class FakeStore:
    def __init__(self, data=None):
        self.data = data
        self.saves = 0
        self.fail_save = False

    async def async_load(self):
        return self.data

    async def async_save(self, value):
        if self.fail_save:
            raise OSError("simulated write failure")
        self.data = value
        self.saves += 1


def sample_session(session_id="fp1", status="FINISHED"):
    return {
        "id": session_id,
        "name": "Free Practice 1",
        "type": "FP",
        "number": 1,
        "date": "2026-09-18T09:00:00Z",
        "status": status,
    }


class ResultArchiveTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.api = FakeApi()
        self.store = FakeStore()
        self.api.sessions[("race-old", "moto2")] = [sample_session()]
        self.api.sessions[("race-new", "motogp")] = [sample_session("race")]
        self.api.classifications["fp1"] = {
            "classification": [{"position": 1, "rider": "Rider A"}]
        }
        self.archive = ResultArchive(self.api, self.store, lambda rows: list(rows))

    async def test_historical_fp1_is_persisted_and_survives_new_instance(self):
        result = await self.archive.async_get_result(
            "race-old", "moto2", "fp1", no_spoiler=False
        )
        self.assertEqual(result["category_id"], "moto2")
        self.assertEqual(result["session_type"], "FP")
        self.assertEqual(result["riders"][0]["rider"], "Rider A")
        self.assertEqual(self.store.saves, 1)
        self.api.sessions.clear()
        self.api.classifications.clear()
        restarted = ResultArchive(self.api, self.store, lambda rows: list(rows))
        cached = await restarted.async_get_result(
            "race-old", "moto2", "fp1", no_spoiler=False
        )
        self.assertEqual(cached["riders"][0]["rider"], "Rider A")
        self.assertEqual(self.api.classification_calls, ["fp1"])

    async def test_wrong_category_or_event_must_not_fetch_classification(self):
        with self.assertRaises(ResultUnavailable):
            await self.archive.async_get_result(
                "race-new", "motogp", "fp1", no_spoiler=False
            )
        self.assertEqual(self.api.classification_calls, [])
        self.assertEqual(self.store.saves, 0)

    async def test_unfinished_pass_not_archived(self):
        self.api.sessions[("race-old", "moto2")] = [sample_session(status="SCHEDULED")]
        with self.assertRaises(ResultUnavailable):
            await self.archive.async_get_result(
                "race-old", "moto2", "fp1", no_spoiler=False
            )
        self.assertEqual(self.store.saves, 0)

    async def test_unpublished_classification_can_be_retried(self):
        self.api.classifications["fp1"] = {"classification": []}
        with self.assertRaises(ResultUnavailable):
            await self.archive.async_get_result(
                "race-old", "moto2", "fp1", no_spoiler=False
            )
        self.assertEqual(self.store.saves, 0)
        self.api.classifications["fp1"] = {"classification": [{"position": 1}]}
        result = await self.archive.async_get_result(
            "race-old", "moto2", "fp1", no_spoiler=False
        )
        self.assertEqual(len(result["riders"]), 1)

    async def test_spoiler_blocks_api_and_cached_results(self):
        with self.assertRaises(ResultsHidden):
            await self.archive.async_list_sessions(
                "race-old", "moto2", no_spoiler=True
            )
        with self.assertRaises(ResultsHidden):
            await self.archive.async_get_result(
                "race-old", "moto2", "fp1", no_spoiler=True
            )
        self.assertEqual(self.api.session_calls, [])
        await self.archive.async_get_result(
            "race-old", "moto2", "fp1", no_spoiler=False
        )
        with self.assertRaises(ResultsHidden):
            await self.archive.async_get_result(
                "race-old", "moto2", "fp1", no_spoiler=True
            )

    async def test_invalid_store_is_not_overwritten(self):
        self.store.data = {"schema": 999, "entries": {}}
        with self.assertRaises(ArchiveFormatError):
            await self.archive.async_get_result(
                "race-old", "moto2", "fp1", no_spoiler=False
            )
        self.assertEqual(self.store.saves, 0)

    async def test_save_failure_does_not_claim_cached_success(self):
        self.store.fail_save = True
        with self.assertRaises(OSError):
            await self.archive.async_get_result(
                "race-old", "moto2", "fp1", no_spoiler=False
            )
        self.store.fail_save = False
        await self.archive.async_get_result(
            "race-old", "moto2", "fp1", no_spoiler=False
        )
        self.assertEqual(self.api.classification_calls, ["fp1", "fp1"])

    async def test_bounded_cache_evicts_oldest_session(self):
        archive = ResultArchive(
            self.api, self.store, lambda rows: list(rows), max_entries=1
        )
        self.api.classifications["race"] = {"classification": [{"position": 1}]}
        await archive.async_get_result(
            "race-old", "moto2", "fp1", no_spoiler=False
        )
        await archive.async_get_result(
            "race-new", "motogp", "race", no_spoiler=False
        )
        self.assertEqual(len(self.store.data["entries"]), 1)
        self.assertEqual(next(iter(self.store.data["entries"].values()))["session_id"], "race")

    async def test_session_selector_keeps_event_category_boundary(self):
        sessions = await self.archive.async_list_sessions(
            "race-old", "moto2", no_spoiler=False
        )
        self.assertEqual([s["id"] for s in sessions], ["fp1"])
        self.assertEqual(self.api.session_calls, [("race-old", "moto2")])


if __name__ == "__main__":
    unittest.main()
