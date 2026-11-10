package com.xiaoying.studio.common;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

public final class Times {
    private Times() {}
    public static Instant now(Clock clock) { return clock.instant().truncatedTo(ChronoUnit.MILLIS); }
}
