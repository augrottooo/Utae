package com.utae.catalog;

import com.utae.auth.SessionUser;
import com.utae.common.Api;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/songs")
public class CatalogController {
    private final CatalogService service;
    public CatalogController(CatalogService service) { this.service = service; }
    private String scope(SessionUser user) { return user == null ? null : user.id(); }
    @GetMapping
    Api<?> list(@AuthenticationPrincipal SessionUser user, @RequestParam(defaultValue = "library") String scope,
            @RequestParam(defaultValue = "") @Size(max = 200) String keyword,
            @RequestParam(defaultValue = "0") @Min(0) @Max(100000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return Api.ok(service.list(scope(user), scope, keyword, page, size));
    }
    @GetMapping("/{songId}") Api<?> detail(@PathVariable String songId, @AuthenticationPrincipal SessionUser user) {
        return Api.ok(service.detail(songId, scope(user)));
    }
    @GetMapping("/{songId}/versions") Api<?> versions(@PathVariable String songId, @AuthenticationPrincipal SessionUser user) {
        return Api.ok(service.versions(songId, scope(user)));
    }
    @GetMapping("/{songId}/versions/{versionId}") Api<?> version(@PathVariable String songId, @PathVariable String versionId, @AuthenticationPrincipal SessionUser user) {
        return Api.ok(service.versionDto(service.version(songId, versionId, scope(user))));
    }
    @GetMapping("/{songId}/manifest") Api<?> manifest(@PathVariable String songId, @RequestParam(required = false) String versionId, @AuthenticationPrincipal SessionUser user) {
        return Api.ok(service.manifest(songId, versionId, scope(user)));
    }
    @GetMapping("/{songId}/versions/{versionId}/assets") Api<?> assets(@PathVariable String songId, @PathVariable String versionId, @AuthenticationPrincipal SessionUser user) {
        return Api.ok(service.assets(songId, versionId, scope(user)));
    }
    @GetMapping("/{songId}/versions/{versionId}/lyrics") Api<?> lyrics(@PathVariable String songId, @PathVariable String versionId, @AuthenticationPrincipal SessionUser user) {
        return Api.ok(service.lyrics(songId, versionId, scope(user)));
    }
}
