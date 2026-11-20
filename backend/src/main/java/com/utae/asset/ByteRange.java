package com.utae.asset;

import com.utae.common.ApiException;

/** A bounded single byte range; multipart ranges are deliberately rejected with 416. */
public record ByteRange(long first, long last, boolean partial) {
    public long length() { return last - first + 1; }
    public static ByteRange parse(String header, String ifRange, String etag, long size) {
        if (header == null || (ifRange != null && !ifRange.equals(etag))) return new ByteRange(0, size - 1, false);
        try {
            if (!header.matches("bytes=\\d*-\\d*")) throw new IllegalArgumentException();
            String[] parts = header.substring(6).split("-", -1);
            long first, last;
            if (parts[0].isEmpty()) {
                long suffix = Long.parseLong(parts[1]);
                if (suffix <= 0) throw new IllegalArgumentException();
                first = Math.max(0, size - suffix); last = size - 1;
            } else {
                first = Long.parseLong(parts[0]);
                last = parts[1].isEmpty() ? size - 1 : Math.min(size - 1, Long.parseLong(parts[1]));
            }
            if (size <= 0 || first < 0 || first >= size || last < first) throw new IllegalArgumentException();
            return new ByteRange(first, last, true);
        } catch (IllegalArgumentException e) {
            throw new ApiException(416, "RANGE_NOT_SATISFIABLE", "请求的音频范围无效。");
        }
    }
}
