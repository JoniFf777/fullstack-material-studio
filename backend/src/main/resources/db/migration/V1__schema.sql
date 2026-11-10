CREATE TABLE app_user (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  username      VARCHAR(32)  NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  display_name  VARCHAR(64)  NOT NULL,
  created_at    DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE user_session (
  token_hash CHAR(64)    NOT NULL,
  user_id    BIGINT      NOT NULL,
  created_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (token_hash),
  KEY idx_session_user (user_id),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE template_category (
  code       VARCHAR(32) NOT NULL,
  name       VARCHAR(32) NOT NULL,
  sort_order INT         NOT NULL,
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE template (
  id                   VARCHAR(64)  NOT NULL,
  category_code        VARCHAR(32)  NOT NULL,
  title                VARCHAR(64)  NOT NULL,
  description          VARCHAR(500) NOT NULL,
  cover_url            VARCHAR(255) NOT NULL,
  required_image_count INT          NOT NULL,
  accepted_mime_types  VARCHAR(128) NOT NULL COMMENT '逗号分隔，如 image/jpeg,image/png',
  max_file_size_bytes  BIGINT       NOT NULL,
  sort_order           INT          NOT NULL,
  enabled              TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_template_category (category_code, sort_order),
  CONSTRAINT fk_template_category FOREIGN KEY (category_code) REFERENCES template_category (code),
  CONSTRAINT ck_template_image_count CHECK (required_image_count BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE material (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  user_id       BIGINT       NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(32)  NOT NULL,
  size_bytes    BIGINT       NOT NULL,
  sha256        CHAR(64)     NOT NULL,
  storage_key   VARCHAR(255) NOT NULL COMMENT '相对 STORAGE_ROOT 的路径',
  created_at    DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  KEY idx_material_user (user_id, id),
  CONSTRAINT fk_material_user FOREIGN KEY (user_id) REFERENCES app_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE generation_task (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  user_id           BIGINT       NOT NULL,
  template_id       VARCHAR(64)  NOT NULL,
  status            VARCHAR(16)  NOT NULL COMMENT 'PENDING / PROCESSING / SUCCEEDED / FAILED',
  stage             VARCHAR(32)  NULL     COMMENT 'MATERIAL_CHECK / GENERATING / RESULT_ASSEMBLY',
  failed_stage      VARCHAR(32)  NULL,
  error_code        VARCHAR(64)  NULL,
  error_message     VARCHAR(500) NULL,
  result_key        VARCHAR(255) NULL     COMMENT '相对 STORAGE_ROOT 的结果文件路径',
  sim_plan          VARCHAR(500) NOT NULL COMMENT '受理时的模拟配置快照（JSON）',
  client_request_id VARCHAR(64)  NULL     COMMENT 'Idempotency-Key',
  created_at        DATETIME(3)  NOT NULL,
  started_at        DATETIME(3)  NULL,
  finished_at       DATETIME(3)  NULL,
  updated_at        DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_task_client_request (user_id, client_request_id),
  KEY idx_task_user (user_id, id),
  KEY idx_task_user_template (user_id, template_id, id),
  KEY idx_task_status (status, id),
  CONSTRAINT fk_task_user FOREIGN KEY (user_id) REFERENCES app_user (id),
  CONSTRAINT fk_task_template FOREIGN KEY (template_id) REFERENCES template (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE generation_task_material (
  task_id     BIGINT NOT NULL,
  slot_index  INT    NOT NULL,
  material_id BIGINT NOT NULL,
  PRIMARY KEY (task_id, slot_index),
  CONSTRAINT fk_tm_task FOREIGN KEY (task_id) REFERENCES generation_task (id),
  CONSTRAINT fk_tm_material FOREIGN KEY (material_id) REFERENCES material (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE generation_task_step (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  task_id     BIGINT       NOT NULL,
  stage       VARCHAR(32)  NOT NULL,
  status      VARCHAR(16)  NOT NULL COMMENT 'RUNNING / SUCCEEDED / FAILED',
  started_at  DATETIME(3)  NOT NULL,
  finished_at DATETIME(3)  NULL,
  message     VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_step_task_stage (task_id, stage),
  CONSTRAINT fk_step_task FOREIGN KEY (task_id) REFERENCES generation_task (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
