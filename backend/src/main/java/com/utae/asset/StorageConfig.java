package com.utae.asset;

import com.utae.common.ApiException;
import io.minio.*;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
public class StorageConfig {
    @Bean
    @Profile("dev")
    @ConditionalOnProperty(name = "utae.storage.mode", havingValue = "filesystem")
    ObjectStore local(@Value("${utae.storage.root}") String directory) {
        return new ObjectStore() {
            private Path resolve(String key) throws IOException {
                Path root = Path.of(directory).toRealPath();
                Path file = root.resolve(key).normalize();
                if (!file.startsWith(root) || !file.toRealPath().startsWith(root) || !Files.isRegularFile(file))
                    throw new java.io.FileNotFoundException();
                return file;
            }
            public long size(String key) throws IOException { return Files.size(resolve(key)); }
            public InputStream open(String key, long offset, long length) throws IOException {
                InputStream in = Files.newInputStream(resolve(key));
                try { in.skipNBytes(offset); return in; }
                catch (IOException e) { in.close(); throw e; }
            }
        };
    }

    @Bean
    @ConditionalOnProperty(name = "utae.storage.mode", havingValue = "minio", matchIfMissing = true)
    ObjectStore minio(@Value("${utae.storage.endpoint:}") String endpoint,
            @Value("${utae.storage.access-key:}") String accessKey,
            @Value("${utae.storage.secret-key:}") String secretKey,
            @Value("${utae.storage.bucket:utae}") String bucket) {
        return new ObjectStore() {
            private MinioClient client() {
                if (endpoint.isBlank() || accessKey.isBlank() || secretKey.isBlank())
                    throw new ApiException(503, "STORAGE_UNAVAILABLE", "对象存储尚未配置。");
                return MinioClient.builder().endpoint(endpoint).credentials(accessKey, secretKey).build();
            }
            private IOException failure(Exception e) {
                if (e instanceof io.minio.errors.ErrorResponseException error
                        && java.util.Set.of("NoSuchKey", "NoSuchObject", "NoSuchBucket").contains(error.errorResponse().code()))
                    return new java.io.FileNotFoundException();
                return new IOException("Object storage unavailable");
            }
            public long size(String key) throws IOException {
                try { return client().statObject(StatObjectArgs.builder().bucket(bucket).object(key).build()).size(); }
                catch (ApiException e) { throw e; }
                catch (Exception e) { throw failure(e); }
            }
            public InputStream open(String key, long offset, long length) throws IOException {
                try { return client().getObject(GetObjectArgs.builder().bucket(bucket).object(key).offset(offset).length(length).build()); }
                catch (ApiException e) { throw e; }
                catch (Exception e) { throw failure(e); }
            }
        };
    }
}
