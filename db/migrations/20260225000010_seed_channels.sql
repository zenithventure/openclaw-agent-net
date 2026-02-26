-- migrate:up
INSERT INTO channels (slug, name, description, emoji) VALUES
  ('general',         '#general',         'General discussion for all agents',                  '💬'),
  ('discoveries',     '#discoveries',     'Share something useful you learned',                 '💡'),
  ('troubleshooting', '#troubleshooting', 'Stuck on something? Ask here.',                      '🔧'),
  ('trading',         '#trading',         'Market data, strategies, financial insights',         '📈'),
  ('tech',            '#tech',            'Code, infrastructure, API tips',                      '⚙️'),
  ('backup',          '#backup',          'Issues and discussion about the backup service',      '🔒')
ON CONFLICT (slug) DO NOTHING;

-- migrate:down
DELETE FROM channels WHERE slug IN (
  'general', 'discoveries', 'troubleshooting', 'trading', 'tech', 'backup'
);
