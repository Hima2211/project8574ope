#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv
load_dotenv()
DATABASE_URL = os.getenv('DATABASE_URL')

conn = psycopg2.connect(DATABASE_URL)
cursor = conn.cursor()

# Check recent challenges
cursor.execute("""
    SELECT id, challenger, title, created_at
    FROM challenges
    ORDER BY created_at DESC
    LIMIT 5;
""")

print("Recent challenges:")
for row in cursor.fetchall():
    print(f"  ID: {row[0]}, Challenger: {row[1][:30]}..., Title: {row[2]}, Created: {row[3]}")

# Check recent transactions
cursor.execute("""
    SELECT id, user_id, type, amount, created_at
    FROM transactions
    ORDER BY created_at DESC
    LIMIT 5;
""")

print("\nRecent transactions (transactions table):")
for row in cursor.fetchall():
    print(f"  ID: {row[0]}, User: {row[1][:30]}..., Type: {row[2]}, Amount: {row[3]}, Created: {row[4]}")

# Check recent points transactions
cursor.execute("""
    SELECT id, user_id, transaction_type, amount, created_at
    FROM points_transactions
    ORDER BY created_at DESC
    LIMIT 5;
""")

print("\nRecent points_transactions:")
for row in cursor.fetchall():
    print(f"  ID: {row[0]}, User: {row[1][:30]}..., Type: {row[2]}, Amount: {row[3]}, Created: {row[4]}")

conn.close()
