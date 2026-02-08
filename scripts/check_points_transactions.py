#!/usr/bin/env python3
import os
import sys
import urllib.parse

try:
    import psycopg2
except Exception:
    print('psycopg2 is required. Install with: pip install psycopg2-binary')
    sys.exit(2)


def main():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print('Please set DATABASE_URL in the environment.')
        sys.exit(2)

    # Parse to support libpq URI
    try:
        conn = psycopg2.connect(dsn=db_url)
    except Exception as e:
        print('Failed to connect to database:', e)
        sys.exit(1)

    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'points_transactions'
            ORDER BY ordinal_position;
        """)
        rows = cur.fetchall()
        if not rows:
            print('No columns found for points_transactions (table may not exist)')
        else:
            print('Columns for points_transactions:')
            for col, dtype, nullable in rows:
                print(f"- {col:25} {dtype:15} nullable={nullable}")
    except Exception as e:
        print('Error querying information_schema:', e)
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    main()
