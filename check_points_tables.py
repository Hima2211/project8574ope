#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv('DATABASE_URL')

conn = psycopg2.connect(DATABASE_URL)
cursor = conn.cursor()

# List all tables with 'points' in name
cursor.execute("""
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_name LIKE '%points%'
    ORDER BY table_schema, table_name;
""")

print("📋 All tables with 'points':")
for schema, table in cursor.fetchall():
    print(f"   {schema}.{table}")
    
    # Show columns for each
    cursor.execute(f"""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = '{schema}' AND table_name = '{table}'
        ORDER BY ordinal_position;
    """)
    
    for col_name, col_type in cursor.fetchall():
        print(f"       - {col_name:25} {col_type}")

conn.close()
