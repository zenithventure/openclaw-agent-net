#!/bin/bash
# Run migrations via Aurora Data API, splitting multi-statement SQL files
set -euo pipefail

CLUSTER_ARN="${CLUSTER_ARN:-arn:aws:rds:us-east-1:252967153935:cluster:agent-net-dev-aurora}"
SECRET_ARN="${SECRET_ARN:-arn:aws:secretsmanager:us-east-1:252967153935:secret:agentnetdevdatabaseAuroraCl-ZJU9iUM26kKi-brHIkp}"
DB="${DB_NAME:-agent_intranet}"
MIGRATIONS_DIR="$(dirname "$0")/../db/migrations"

run_sql() {
  local sql="$1"
  local desc="$2"
  # Skip empty statements
  if [ -z "$(echo "$sql" | tr -d '[:space:]')" ]; then
    return 0
  fi
  echo "  -> $desc"
  aws rds-data execute-statement \
    --resource-arn "$CLUSTER_ARN" \
    --secret-arn "$SECRET_ARN" \
    --database "$DB" \
    --sql "$sql" > /dev/null 2>&1 || {
    echo "  ❌ FAILED: $desc"
    echo "  SQL: $(echo "$sql" | head -1)..."
    aws rds-data execute-statement \
      --resource-arn "$CLUSTER_ARN" \
      --secret-arn "$SECRET_ARN" \
      --database "$DB" \
      --sql "$sql" 2>&1 | tail -3
    return 1
  }
}

# Extract migrate:up section from a file
extract_up() {
  sed -n '/^-- migrate:up$/,/^-- migrate:down$/{ /^-- migrate:up$/d; /^-- migrate:down$/d; p; }' "$1"
}

# Split SQL into statements, respecting $$ blocks
split_and_run() {
  local file="$1"
  local sql
  sql=$(extract_up "$file")

  # Use python to split statements properly (handles $$ blocks)
  python3 -c "
import sys, re

sql = '''$sql'''

# Split respecting dollar-quoted strings
statements = []
current = ''
in_dollar = False
lines = sql.split('\n')

for line in lines:
    stripped = line.strip()
    # Skip pure comment lines (but keep them in function bodies)
    if stripped.startswith('--') and not in_dollar:
        continue

    # Track dollar quoting
    dollar_count = line.count('\$\$')
    if dollar_count % 2 == 1:
        in_dollar = not in_dollar

    current += line + '\n'

    # If we hit a semicolon at end of line and not in dollar block, it's a statement boundary
    if stripped.endswith(';') and not in_dollar:
        stmt = current.strip()
        if stmt and stmt != ';':
            statements.append(stmt)
        current = ''

# Handle any remaining
if current.strip():
    statements.append(current.strip())

for i, stmt in enumerate(statements):
    # Remove trailing semicolons for Data API
    s = stmt.rstrip().rstrip(';').strip()
    if s:
        print('---STATEMENT_BOUNDARY---')
        print(s)
" | {
    local stmt=""
    local count=0
    while IFS= read -r line; do
      if [ "$line" = "---STATEMENT_BOUNDARY---" ]; then
        if [ -n "$stmt" ]; then
          count=$((count + 1))
          run_sql "$stmt" "statement $count"
          stmt=""
        fi
      else
        if [ -n "$stmt" ]; then
          stmt="$stmt
$line"
        else
          stmt="$line"
        fi
      fi
    done
    # Run last statement
    if [ -n "$stmt" ]; then
      count=$((count + 1))
      run_sql "$stmt" "statement $count"
    fi
    echo "  ✅ $count statements executed"
  }
}

echo "Running migrations against $DB..."
echo ""

for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "=== $(basename "$f") ==="
  split_and_run "$f"
  echo ""
done

echo "✅ All migrations complete!"
