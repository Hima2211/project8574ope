#!/usr/bin/env python3
"""
Ensure points_transactions table has reason column by adding it if missing
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ DATABASE_URL not found in .env")
    exit(1)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    print("\n📊 Checking points_transactions table structure...\n")
    
    # Check current columns
    cursor.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'points_transactions'
        ORDER BY ordinal_position;
    """)
    
    columns = cursor.fetchall()
    column_names = [col[0] for col in columns]
    
    print("📋 Current columns in points_transactions:")
    for col_name, col_type in columns:
        print(f"   ✓ {col_name:25} {col_type}")
    
    # Check if reason column exists
    if 'reason' in column_names:
        print("\n✅ 'reason' column already exists")
    else:
        print("\n⚠️  'reason' column is MISSING - adding it now...")
        
        cursor.execute("""
            ALTER TABLE points_transactions
            ADD COLUMN reason TEXT;
        """)
        
        conn.commit()
        print("✅ Added 'reason' column to points_transactions")
    
    # Check if blockchainTxHash column exists with correct name
    if 'blockchain_tx_hash' in column_names:
        print("✅ 'blockchain_tx_hash' column exists")
    else:
        print("⚠️  'blockchain_tx_hash' column is MISSING - adding it now...")
        
        cursor.execute("""
            ALTER TABLE points_transactions
            ADD COLUMN blockchain_tx_hash VARCHAR;
        """)
        
        conn.commit()
        print("✅ Added 'blockchain_tx_hash' column")
    
    # Verify all expected columns exist
    expected_columns = [
        'id',
        'user_id', 
        'challenge_id',
        'transaction_type',
        'amount',
        'reason',
        'blockchain_tx_hash',
        'block_number',
        'chain_id',
        'metadata',
        'created_at'
    ]
    
    missing = [col for col in expected_columns if col not in column_names]
    
    if missing:
        print(f"\n⚠️  Missing columns: {missing}")
        for col in missing:
            print(f"   - {col}")
    else:
        print("\n✅ All expected columns exist!")
    
    # Show final structure
    cursor.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'points_transactions'
        ORDER BY ordinal_position;
    """)
    
    columns = cursor.fetchall()
    print("\n📋 Final points_transactions structure:")
    for col_name, col_type in columns:
        print(f"   ✓ {col_name:25} {col_type}")
    
    conn.close()
    print("\n✅ Migration complete!\n")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
