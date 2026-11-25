from datetime import date

from store import spark_start


def test_sparkline_is_seven_days_ending_on_the_filter():
    assert spark_start(date(2026, 11, 25)) == date(2026, 11, 19)
