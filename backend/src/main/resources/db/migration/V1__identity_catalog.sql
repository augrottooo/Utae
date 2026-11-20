-- MySQL 8.0.16+. No seed accounts, destructive DDL, pipeline or learning tables.
CREATE TABLE app_user (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CHECK (role IN ('USER', 'MAINTAINER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE song (
  id VARCHAR(80) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  duration_ms BIGINT NOT NULL,
  visibility VARCHAR(16) NOT NULL,
  lifecycle_status VARCHAR(16) NOT NULL,
  current_published_version_id VARCHAR(36) NULL,
  deleted_at TIMESTAMP(3) NULL,
  CHECK (duration_ms > 0),
  CHECK (visibility IN ('PRIVATE', 'SHARED')),
  CHECK (lifecycle_status IN ('ACTIVE', 'WITHDRAWN', 'DELETING', 'DELETED')),
  INDEX ix_song_catalog (visibility, lifecycle_status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE song_ownership (
  song_id VARCHAR(80) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  permission VARCHAR(16) NOT NULL DEFAULT 'OWNER',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (song_id, user_id),
  INDEX ix_ownership_user (user_id, song_id),
  FOREIGN KEY (song_id) REFERENCES song(id),
  FOREIGN KEY (user_id) REFERENCES app_user(id),
  CHECK (permission = 'OWNER')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE song_package_version (
  id VARCHAR(36) PRIMARY KEY,
  song_id VARCHAR(80) NOT NULL,
  package_version VARCHAR(80) NOT NULL,
  schema_version INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
  -- Immutable Sorane song/chunks snapshot. All paths are mapped through asset IDs.
  manifest_json JSON NOT NULL,
  sha256 CHAR(64) NOT NULL,
  published_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE (song_id, package_version),
  UNIQUE (song_id, id),
  FOREIGN KEY (song_id) REFERENCES song(id),
  CHECK (schema_version = 1),
  CHECK (status IN ('PUBLISHED', 'WITHDRAWN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE song ADD CONSTRAINT fk_song_current_version
  FOREIGN KEY (id, current_published_version_id) REFERENCES song_package_version(song_id, id);

CREATE TABLE stored_asset (
  id VARCHAR(36) PRIMARY KEY,
  object_key VARCHAR(512) NOT NULL UNIQUE,
  sha256 CHAR(64) NOT NULL,
  size_bytes BIGINT NOT NULL,
  media_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CHECK (size_bytes > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE version_lyric_line (
  id VARCHAR(36) PRIMARY KEY,
  version_id VARCHAR(36) NOT NULL,
  source_line_id VARCHAR(255) NOT NULL,
  line_no INT NOT NULL,
  start_ms BIGINT NOT NULL,
  end_ms BIGINT NOT NULL,
  text TEXT NOT NULL,
  translation TEXT NULL,
  UNIQUE (version_id, line_no),
  UNIQUE (version_id, source_line_id),
  FOREIGN KEY (version_id) REFERENCES song_package_version(id),
  CHECK (line_no >= 0 AND start_ms >= 0 AND end_ms > start_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE lyric_token (
  id VARCHAR(36) PRIMARY KEY,
  version_line_id VARCHAR(36) NOT NULL,
  token_no INT NOT NULL,
  text VARCHAR(255) NOT NULL,
  kana VARCHAR(255) NOT NULL,
  romaji VARCHAR(255) NOT NULL,
  start_ms BIGINT NOT NULL,
  end_ms BIGINT NOT NULL,
  UNIQUE (version_line_id, token_no),
  FOREIGN KEY (version_line_id) REFERENCES version_lyric_line(id),
  CHECK (token_no >= 0 AND start_ms >= 0 AND end_ms > start_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE package_version_asset (
  version_id VARCHAR(36) NOT NULL,
  asset_id VARCHAR(36) NOT NULL,
  source_path VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  role VARCHAR(32) NOT NULL,
  PRIMARY KEY (version_id, source_path),
  INDEX ix_version_asset (asset_id, version_id),
  FOREIGN KEY (version_id) REFERENCES song_package_version(id),
  FOREIGN KEY (asset_id) REFERENCES stored_asset(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Deletes RESTRICT. Revoke access before explicit retention/GC in a later stage.
-- The immutable manifest snapshot remains authoritative for faithful schema-1 projection;
-- normalized lyric rows provide indexed business read models for API/learning stages.
