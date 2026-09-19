import sqlite3
import os

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database")
DB_PATH = os.path.join(DB_DIR, "railnex.db")

def init_db():
    if not os.path.exists(DB_DIR):
        os.makedirs(DB_DIR)
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create tickets table for verification
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tickets (
        pnr TEXT PRIMARY KEY,
        source TEXT,
        destination TEXT,
        distance INTEGER
    )
    ''')
    
    # Create active_plans table to track validity
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS active_plans (
        pnr TEXT PRIMARY KEY,
        activation_time INTEGER,
        expiry_time INTEGER,
        status TEXT
    )
    ''')
    
    # Insert demo data if not exists
    demo_tickets = [
        ("1234567890", "Delhi", "Ludhiana", 312),
        ("1111111111", "Ludhiana", "Jalandhar", 65),
        ("2222222222", "Delhi", "Ambala", 198)
    ]
    
    for ticket in demo_tickets:
        cursor.execute('''
        INSERT OR IGNORE INTO tickets (pnr, source, destination, distance) 
        VALUES (?, ?, ?, ?)
        ''', ticket)
        
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize db when this module is loaded
init_db()
