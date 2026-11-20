package com.utae.asset;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.utae.auth.SessionUser;
import com.utae.auth.UserAccount;
import com.utae.catalog.CatalogMapper;
import com.utae.catalog.Rows.AssetRow;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class AssetControllerTest {
    @Test void authorizedRangeIsReturnedAs206AndHeadDoesNotWriteBody() throws Exception {
        CatalogMapper repository = mock(CatalogMapper.class);
        ObjectStore storage = mock(ObjectStore.class);
        var asset = new AssetRow("asset", "private/key", "abc", 10, "audio/wav", "song.wav", "AUDIO");
        when(repository.asset("asset", "v1", "user")).thenReturn(asset);
        when(storage.size("private/key")).thenReturn(10L);
        when(storage.open("private/key", 2, 4)).thenReturn(new ByteArrayInputStream("2345".getBytes(StandardCharsets.UTF_8)));
        var controller = new AssetController(repository, storage);
        var request = new MockHttpServletRequest();
        request.setMethod("GET"); request.addHeader("Range", "bytes=2-5");
        var response = new MockHttpServletResponse();
        var user = new SessionUser(new UserAccount("user", "u", "hash", "USER", true));
        controller.get("asset", "v1", user, request, response);
        assertEquals(206, response.getStatus());
        assertEquals("bytes 2-5/10", response.getHeader("Content-Range"));
        assertEquals("bytes", response.getHeader("Accept-Ranges"));
        assertEquals("2345", response.getContentAsString());
        verify(repository).asset("asset", "v1", "user");

        request = new MockHttpServletRequest(); request.setMethod("HEAD"); request.addHeader("Range", "bytes=2-5");
        response = new MockHttpServletResponse();
        when(storage.open("private/key", 2, 4)).thenReturn(new ByteArrayInputStream(new byte[0]));
        controller.get("asset", "v1", user, request, response);
        assertEquals(206, response.getStatus()); assertEquals(0, response.getContentAsByteArray().length);
    }

    @Test void inaccessibleVersionAndMissingObjectFailClosed() throws Exception {
        CatalogMapper repository = mock(CatalogMapper.class);
        ObjectStore storage = mock(ObjectStore.class);
        var controller = new AssetController(repository, storage);
        var request = new MockHttpServletRequest(); request.setMethod("GET");
        assertEquals(404, assertThrows(com.utae.common.ApiException.class,
            () -> controller.get("other-users-asset", "v1", null, request, new MockHttpServletResponse())).status);
        var asset = new AssetRow("asset", "private/key", "abc", 10, "audio/wav", "song.wav", "AUDIO");
        when(repository.asset("asset", "v1", null)).thenReturn(asset);
        when(storage.size("private/key")).thenThrow(new java.io.FileNotFoundException());
        assertEquals(404, assertThrows(com.utae.common.ApiException.class,
            () -> controller.get("asset", "v1", null, request, new MockHttpServletResponse())).status);
    }
}
