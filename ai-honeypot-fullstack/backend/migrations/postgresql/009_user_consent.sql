-- User Consent Management Table
CREATE TABLE IF NOT EXISTS user_consent (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    consent_given BOOLEAN NOT NULL DEFAULT false,
    preferences TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_consent_user_id ON user_consent(user_id);
