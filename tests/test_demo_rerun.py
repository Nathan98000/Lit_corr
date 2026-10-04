"""`python -m litcorr demo` run twice into the same folder must collect and measure text both times."""

from __future__ import annotations

import sqlite3

import pytest

from litcorr.demo import DEMO_MARKER, _reset_demo_dir, run_demo


def test_demo_rerun_into_same_folder_still_has_text(tmp_path, capsys):
    out = tmp_path / "demo_out"
    first = run_demo(out, n_per_category=3)
    second = run_demo(out, n_per_category=3)  # the mock site gets a new port: old cache entries must not be reused
    assert first["processed"]["with_text"] > 0
    assert second["processed"]["with_text"] == first["processed"]["with_text"]
    assert (out / DEMO_MARKER).exists()


def test_reset_refuses_a_folder_that_is_not_a_demo(tmp_path):
    real = tmp_path / "data"
    real.mkdir()
    con = sqlite3.connect(real / "state.sqlite3")
    con.execute("CREATE TABLE pages (url TEXT)")
    con.execute("INSERT INTO pages VALUES ('https://www.literotica.com/s/example')")
    con.commit()
    con.close()
    with pytest.raises(SystemExit):
        _reset_demo_dir(real)
    assert (real / "state.sqlite3").exists()
