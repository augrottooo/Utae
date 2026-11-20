package com.utae.asset;

import java.io.InputStream;
import java.io.IOException;

public interface ObjectStore {
    long size(String key) throws IOException;
    InputStream open(String key, long offset, long length) throws IOException;
}
