package com.utae.asset;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
class ByteRangeTest {
    @Test void parsesFullOpenEndedAndSuffixRanges() {
        assertEquals(new ByteRange(0, 99, false), ByteRange.parse(null, null, "e", 100));
        assertEquals(new ByteRange(10, 19, true), ByteRange.parse("bytes=10-19", null, "e", 100));
        assertEquals(new ByteRange(10, 99, true), ByteRange.parse("bytes=10-", null, "e", 100));
        assertEquals(new ByteRange(90, 99, true), ByteRange.parse("bytes=-10", null, "e", 100));
        assertEquals(new ByteRange(0, 99, false), ByteRange.parse("bytes=0-9", "other", "e", 100));
    }
    @Test void rejectsUnsatisfiableAndMultipleRanges() {
        for (String value : new String[]{"bytes=100-", "bytes=4-3", "bytes=0-1,3-4", "bytes=-0"})
            assertEquals(416, assertThrows(com.utae.common.ApiException.class,
                () -> ByteRange.parse(value, null, "e", 100)).status);
    }
}
