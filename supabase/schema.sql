-- Verifie Database Schema for Supabase
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/_/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  google_doc_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_doc_id)
);

-- Revisions table (edit history)
CREATE TABLE IF NOT EXISTS revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  revision_id TEXT,
  content_hash TEXT,
  author TEXT,
  author_email TEXT,
  char_count INTEGER DEFAULT 0,
  char_delta INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Editing sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  char_count INTEGER DEFAULT 0,
  keystrokes INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE
);

-- AI analysis results
CREATE TABLE IF NOT EXISTS ai_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  ai_percent INTEGER,
  human_percent INTEGER,
  source TEXT,
  indicators JSONB,
  word_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_google_id ON documents(google_doc_id);
CREATE INDEX IF NOT EXISTS idx_revisions_document ON revisions(document_id);
CREATE INDEX IF NOT EXISTS idx_revisions_timestamp ON revisions(timestamp);
CREATE INDEX IF NOT EXISTS idx_sessions_document ON sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_document ON ai_analysis(document_id);

-- Row Level Security (RLS)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can manage own documents"
  ON documents FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own revisions"
  ON revisions FOR ALL
  USING (document_id IN (
    SELECT id FROM documents WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own sessions"
  ON sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own analysis"
  ON ai_analysis FOR ALL
  USING (document_id IN (
    SELECT id FROM documents WHERE user_id = auth.uid()
  ));

-- Enable Realtime on tables
ALTER PUBLICATION supabase_realtime ADD TABLE revisions;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Analytics view
CREATE OR REPLACE VIEW document_stats AS
SELECT
  d.id,
  d.title,
  d.google_doc_id,
  COUNT(DISTINCT r.id) AS revision_count,
  COUNT(DISTINCT s.id) AS session_count,
  COALESCE(SUM(s.char_count), 0) AS total_chars,
  COALESCE(SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time))), 0) AS total_seconds,
  MAX(r.timestamp) AS last_edit,
  (SELECT ai_percent FROM ai_analysis WHERE document_id = d.id ORDER BY created_at DESC LIMIT 1) AS latest_ai_percent
FROM documents d
LEFT JOIN revisions r ON r.document_id = d.id
LEFT JOIN sessions s ON s.document_id = d.id
GROUP BY d.id, d.title, d.google_doc_id;
