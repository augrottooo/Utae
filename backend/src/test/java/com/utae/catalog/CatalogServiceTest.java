package com.utae.catalog;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.utae.common.ApiException;
import java.util.List;
import org.junit.jupiter.api.Test;
import static com.utae.catalog.Rows.*;

class CatalogServiceTest {
    private final CatalogMapper mapper = mock(CatalogMapper.class);
    private final CatalogService service = new CatalogService(mapper, new ManifestMapper(new ObjectMapper()));
    @Test void privateScopeRequiresServerIdentityAndBadScopeIsRejected() {
        assertEquals(401, assertThrows(ApiException.class, () -> service.list(null, "mine", "", 0, 20)).status);
        assertEquals(400, assertThrows(ApiException.class, () -> service.list("u1", "all", "", 0, 20)).status);
        verifyNoInteractions(mapper);
    }
    @Test void privateSongOutsideScopeIsIndistinguishableFromMissing() {
        when(mapper.song("private-song", "u2")).thenReturn(null);
        assertEquals(404, assertThrows(ApiException.class, () -> service.song("private-song", "u2")).status);
        verify(mapper).song("private-song", "u2");
    }
    @Test void listingUsesServerScopeAndDoesNotAcceptOwnerIdArgument() {
        when(mapper.list("server-user", "mine", "", 20, 20)).thenReturn(List.of());
        when(mapper.count("server-user", "mine", "")).thenReturn(21L);
        var result = service.list("server-user", "mine", "", 1, 20);
        assertEquals(21L, result.get("total"));
        verify(mapper).list("server-user", "mine", "", 20, 20);
    }
}
