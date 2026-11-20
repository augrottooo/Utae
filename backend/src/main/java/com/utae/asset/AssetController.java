package com.utae.asset;

import com.utae.auth.SessionUser;
import com.utae.catalog.CatalogMapper;
import com.utae.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.InputStream;
import java.io.IOException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class AssetController {
    private final CatalogMapper repository;
    private final ObjectStore storage;
    public AssetController(CatalogMapper repository, ObjectStore storage) { this.repository = repository; this.storage = storage; }

    @RequestMapping(value = "/api/assets/{assetId}", method = {RequestMethod.GET, RequestMethod.HEAD})
    void get(@PathVariable String assetId, @RequestParam String versionId, @AuthenticationPrincipal SessionUser user,
            HttpServletRequest request, HttpServletResponse response) throws IOException {
        var asset = repository.asset(assetId, versionId, user == null ? null : user.id());
        if (asset == null) throw ApiException.missing();
        String etag = "\"" + asset.sha256() + "\"";
        try {
            if (storage.size(asset.objectKey()) != asset.sizeBytes())
                throw new ApiException(409, "ASSET_INVALID", "音频资产大小与发布记录不一致。");
            response.setHeader("Accept-Ranges", "bytes"); response.setHeader("ETag", etag);
            response.setHeader("Cache-Control", "no-store"); response.setHeader("Vary", "Cookie");
            ByteRange range;
            try { range = ByteRange.parse(request.getHeader("Range"), request.getHeader("If-Range"), etag, asset.sizeBytes()); }
            catch (ApiException e) { response.setHeader("Content-Range", "bytes */" + asset.sizeBytes()); throw e; }
            // Open before committing headers, so missing/backend errors retain a JSON error response.
            try (InputStream in = storage.open(asset.objectKey(), range.first(), range.length())) {
                response.setStatus(range.partial() ? 206 : 200);
                response.setContentType(asset.mediaType()); response.setContentLengthLong(range.length());
                if (range.partial()) response.setHeader("Content-Range", "bytes " + range.first() + "-" + range.last() + "/" + asset.sizeBytes());
                if (request.getMethod().equals("HEAD")) return;
                byte[] buffer = new byte[65536];
                long remaining = range.length();
                while (remaining > 0) {
                    int read = in.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                    if (read < 0) throw new IOException("Truncated asset");
                    response.getOutputStream().write(buffer, 0, read); remaining -= read;
                }
            }
        } catch (java.io.FileNotFoundException | java.nio.file.NoSuchFileException e) { throw ApiException.missing(); }
        catch (IOException e) {
            if (response.isCommitted()) throw e;
            response.reset(); throw new ApiException(503, "STORAGE_UNAVAILABLE", "音频资产暂时不可用。");
        }
    }
}
