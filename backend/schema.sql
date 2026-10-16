CREATE TABLE IF NOT EXISTS candidate_applications (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(254),
  qualification VARCHAR(80) NOT NULL,
  job_category VARCHAR(80) NOT NULL,
  preferred_location VARCHAR(100),
  skills TEXT,
  consent BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'New'
    CHECK (status IN ('New', 'Contacted', 'Interview', 'Placed', 'Closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_applications_created_at
  ON candidate_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_applications_status
  ON candidate_applications (status);
