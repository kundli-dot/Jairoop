"""
Jai Roop Textiles — IMS System V7
Advanced Inventory Management System
FastAPI + SQLite Backend
"""

import sqlite3
import json
import os
import csv
import io
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ─────────────────────────────────────────────
# APP SETUP
# ─────────────────────────────────────────────
app = FastAPI(title="Jai Roop Textiles IMS", version="7.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "ims.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


# ─────────────────────────────────────────────
# DATABASE HELPERS
# ─────────────────────────────────────────────
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def row_to_dict(row) -> dict:
    return dict(row) if row else {}


def rows_to_list(rows) -> list:
    return [dict(r) for r in rows]


def now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def today_str() -> str:
    return date.today().isoformat()


def log_activity(conn, action: str, module: str, ref_id: str = "", details: str = ""):
    conn.execute(
        "INSERT INTO activity_log (action, module, reference_id, details, created_at) VALUES (?,?,?,?,?)",
        (action, module, ref_id, details, now_str()),
    )


# ─────────────────────────────────────────────
# SCHEMA (DB INIT)
# ─────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS inventory (
    item_code       TEXT PRIMARY KEY,
    item_name       TEXT NOT NULL,
    color           TEXT DEFAULT '',
    category        TEXT DEFAULT 'Raw',
    weight_per_mtr  REAL DEFAULT 0,
    unit            TEXT DEFAULT 'Mtr',
    opening_stock   REAL DEFAULT 0,
    total_in        REAL DEFAULT 0,
    total_out       REAL DEFAULT 0,
    allocated_qty   REAL DEFAULT 0,
    reorder_level   REAL DEFAULT 50,
    purchase_price  REAL DEFAULT 0,
    selling_price   REAL DEFAULT 0,
    supplier_name   TEXT DEFAULT '',
    notes           TEXT DEFAULT '',
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code       TEXT NOT NULL,
    movement_type   TEXT NOT NULL,
    qty             REAL NOT NULL,
    reference_type  TEXT DEFAULT '',
    reference_id    TEXT DEFAULT '',
    notes           TEXT DEFAULT '',
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name     TEXT UNIQUE NOT NULL,
    contact_person  TEXT DEFAULT '',
    phone           TEXT DEFAULT '',
    email           TEXT DEFAULT '',
    address         TEXT DEFAULT '',
    city            TEXT DEFAULT '',
    payment_terms   INTEGER DEFAULT 30,
    credit_limit    REAL DEFAULT 0,
    notes           TEXT DEFAULT '',
    active          INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_name   TEXT UNIQUE NOT NULL,
    contact_person  TEXT DEFAULT '',
    phone           TEXT DEFAULT '',
    email           TEXT DEFAULT '',
    address         TEXT DEFAULT '',
    city            TEXT DEFAULT '',
    payment_terms   INTEGER DEFAULT 30,
    gstin           TEXT DEFAULT '',
    notes           TEXT DEFAULT '',
    active          INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_name     TEXT UNIQUE NOT NULL,
    phone           TEXT DEFAULT '',
    address         TEXT DEFAULT '',
    specialty       TEXT DEFAULT '',
    rate_per_mtr    REAL DEFAULT 0.25,
    notes           TEXT DEFAULT '',
    active          INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        TEXT UNIQUE NOT NULL,
    order_date      TEXT NOT NULL,
    client_name     TEXT NOT NULL,
    item_code       TEXT NOT NULL,
    ordered_qty     REAL NOT NULL,
    unit            TEXT DEFAULT 'Mtr',
    status          TEXT DEFAULT 'Pending',
    priority        TEXT DEFAULT 'Normal',
    delivery_date   TEXT DEFAULT '',
    selling_rate    REAL DEFAULT 0,
    remarks         TEXT DEFAULT '',
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_work (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id          TEXT UNIQUE NOT NULL,
    job_date        TEXT NOT NULL,
    order_id        TEXT DEFAULT '',
    worker_name     TEXT NOT NULL,
    item_code       TEXT NOT NULL,
    sent_qty        REAL DEFAULT 0,
    received_qty    REAL DEFAULT 0,
    wastage_mtr     REAL DEFAULT 0,
    status          TEXT DEFAULT 'Out',
    rate_per_mtr    REAL DEFAULT 0.25,
    total_payment   REAL DEFAULT 0,
    remarks         TEXT DEFAULT '',
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispatch (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dispatch_id     TEXT UNIQUE NOT NULL,
    order_id        TEXT NOT NULL,
    client_name     TEXT NOT NULL,
    item_code       TEXT NOT NULL,
    dispatched_qty  REAL NOT NULL,
    dispatch_date   TEXT NOT NULL,
    challan_no      TEXT DEFAULT '',
    vehicle_no      TEXT DEFAULT '',
    driver_name     TEXT DEFAULT '',
    remarks         TEXT DEFAULT '',
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id           TEXT UNIQUE NOT NULL,
    po_date         TEXT NOT NULL,
    supplier_name   TEXT NOT NULL,
    item_code       TEXT NOT NULL,
    ordered_qty     REAL NOT NULL,
    unit            TEXT DEFAULT 'Mtr',
    purchase_rate   REAL DEFAULT 0,
    expected_date   TEXT DEFAULT '',
    received_qty    REAL DEFAULT 0,
    received_date   TEXT DEFAULT '',
    status          TEXT DEFAULT 'Pending',
    invoice_no      TEXT DEFAULT '',
    remarks         TEXT DEFAULT '',
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    action          TEXT NOT NULL,
    module          TEXT NOT NULL,
    reference_id    TEXT DEFAULT '',
    details         TEXT DEFAULT '',
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);
"""

DEFAULT_SETTINGS = {
    "company_name": "Jai Roop Textiles",
    "company_address": "Your Address Here",
    "company_phone": "+91-XXXXXXXXXX",
    "company_gstin": "GSTIN Number",
    "wastage_threshold": "4.0",
    "default_payment_rate": "0.25",
    "currency": "INR",
    "low_stock_multiplier": "1.0",
    "financial_year_start": "04",
}

SEED_INVENTORY = [
    # Raw Materials - Cotton
    ("2/10/Cotton Kora","210/Cotton Kora","Kora","Raw",1100,200,100,120),
    ("2/20/Cotton Kora","220/Cotton Kora","Kora","Raw",115,500,50,75),
    ("2/30/Cotton Kora","230/Cotton Kora","Kora","Raw",272,0,20,175),
    ("2/40/Cotton Kora","2/40/Cotton Kora","Kora","Raw",108,0,10,0),
    ("3/20/Cotton Kora","3/20/Cotton Kora","Kora","Raw",120,100,50,0),
    # Raw - Polyester
    ("2/10/Spun Poly","2/10/Spun Poly Black","Black","Raw",22,0,0,0),
    ("2/20/Spun Poly","2/20/Spun Poly White","White","Raw",345,0,0,0),
    ("2/42/Spun Poly","2/42/Spun Poly White","White","Raw",255.5,256,0,0),
    ("2/40/Spun Poly","2/40/Spun Poly Black","Black","Raw",20.68,21,0,0),
    ("75/36/Bright FDY","75/36 Bright FDY Recycle","Bright","Raw",215,0,0,0),
    ("70/2/High Bulk","70/2/High Bulk Kora","Kora","Raw",848.19,848,0,0),
    ("75/2/140 Dyed Shade","75/2/140 Dyed Shade Brown","Brown","Raw",79,0,0,0),
    ("75/2/140 Dyed Yarn","75/2/140 Dyed Yarn","Bright","Raw",80.4,80,0,0),
    ("75/250 Bright","75/250 Bright","Bright","Raw",286.84,287,0,0),
    ("100/34 Text Nim Black","100/34 Text 1st Nim Black","Black","Raw",185.4,185,0,0),
    ("150/0 Kora Nim","150/0 Kora Nim Kora","Kora","Raw",995,0,0,0),
    ("150/Roto Kora","150/Roto Kora HIM","Kora","Raw",1091,0,0,0),
    ("150/48/200 Kora","150/48/200 Kora","Kora","Raw",690,0,0,0),
    ("150/0 Black DD","150/0 Black D/D","Black","Raw",447,0,0,0),
    ("160/2 FD Kora","160/2 FD Kora","Kora","Raw",11,0,0,0),
    ("300/Roto Kora","300/Roto Kora","Kora","Raw",287.98,288,0,0),
    # Raw - Spandex/Elastic
    ("420 Spandex","420 Spandex","","Raw",8,0,0,0),
    ("Inviya-840 Lykra","Inviya-840 Lykra","","Raw",1221,0,0,0),
    ("892/800 Spandex","892/800 Spandex Denier","","Raw",1181,0,0,0),
    ("1680 Spandex","1680 Spandex","","Raw",236,0,0,0),
    ("40G Rubber White","40 G Rubber White","White","Raw",233,0,0,0),
    ("40G Rubber Black","40 G Rubber Black","Black","Raw",379,0,0,0),
    ("52G SWG Rubber White","52 SWG Rubber White","White","Raw",20,0,0,0),
    ("52G SWG Rubber Black","52/G SWG Rubber Black","Black","Raw",13,0,0,0),
    ("Bobin Elastic Mix","Bobin Elastic Mix","Mix","Raw",114,0,0,0),
    ("111/2 P Nylon Kora","111/2 P Nylon Kora","Kora","Raw",12.4,12,0,0),
    # Raw - Lurex
    ("Lurex Silver","Lurex Silver","Silver","Raw",11,0,0,0),
    ("Lurex Black","Lurex Black","Black","Raw",12,0,0,0),
    ("Lurex Navy Blue","Lurex Navy Blue","Navy Blue","Raw",24,0,0,0),
    # Semi Finished - Dyes
    ("Yellow Brown 2RFL","Yellow Brown 2RFL","","Semi Finished",43.89,44,0,0),
    ("Red 2BN","Red 2BN","","Semi Finished",6,0,0,0),
    ("Brill Blue BG 200%","Brill Blue BG 200%","","Semi Finished",5,0,0,0),
    ("Orange RL 200%","Orange RL 200%","","Semi Finished",5.38,5,0,0),
    ("Blue 2R Con","Blue 2R Con","","Semi Finished",5,0,0,0),
    ("Pink SB","Pink SB","","Semi Finished",4.6,5,0,0),
    ("Pink RB SF","Pink RB SF","","Semi Finished",5,0,0,0),
    ("Yellow 10GN","Yellow 10GN","","Semi Finished",3.2,3,0,0),
    ("Voilet 3R Con","Voilet 3R Con","","Semi Finished",4,0,0,0),
    ("Red J","Red J","","Semi Finished",3.3,3,0,0),
    ("Blue SR","Blue SR","","Semi Finished",2.9,3,0,0),
    ("Red Voilet FBL 200%","Red Voilet FBL 200%","","Semi Finished",3,0,0,0),
    ("Brill Red F3BS","Brill Red F3BS","","Semi Finished",4,0,0,0),
    ("Yellow C4G HC","Yellow C4G H/C","","Semi Finished",4.5,5,0,0),
    ("Rubine S2G 150%","Rubine S2G 150%","","Semi Finished",1,0,0,0),
    ("Scarlet RR","Scarlet RR","","Semi Finished",4.3,4,0,0),
    ("Dark Red 2B","Dark Red 2B","","Semi Finished",17.58,18,0,0),
    ("Navi Blue 3G HC","Navi Blue 3G H/C","","Semi Finished",20.45,20,0,0),
    ("Black EMRD","Black EMRD","","Semi Finished",29.9,30,0,0),
    # Semi Finished - Satin
    ("3 MM Satin","3 MM Satin White","White","Semi Finished",0.9,952.89,953,0),
    ("6 MM Satin","6 MM Satin White","White","Semi Finished",1.48,864.53,865,0),
    ("10 MM Satin","10 MM Satin White","White","Semi Finished",2.6,22.6,23,0),
    ("12 MM Satin","12 MM Satin White","White","Semi Finished",3.22,27.9,28,0),
    ("20 MM Satin","20 MM Satin White","White","Semi Finished",5,290.17,290,0),
    ("25 MM Satin","25 MM Satin White","White","Semi Finished",5.11,90,0,0),
    ("32 MM Satin","32 MM Satin White","White","Semi Finished",8.8,48,0,0),
    ("40 MM Satin","40 MM Satin White","White","Semi Finished",11.2,64,0,0),
    # Semi Finished - G/G Ribbons
    ("3 MM GG No2","3 MM G/G No.2 White","White","Semi Finished",0.86,21.43,21,0),
    ("6 MM GG No2","6 MM G/G No.2 White","White","Semi Finished",1.46,48.56,49,0),
    ("10 MM GG No2","10 MM G/G No.2 White","White","Semi Finished",2.6,126,0,0),
    ("15 MM GG No1","15 MM G/G No.1 White","White","Semi Finished",3.7,40,0,0),
    ("15 MM GG No2","15 MM G/G No.2 White","White","Semi Finished",4.11,110,0,0),
    ("20 MM GG No1","20 MM G/G No.1 White","White","Semi Finished",3.9,120,0,0),
    ("24 MM GG No1","24 MM G/G No.1 White","White","Semi Finished",7.2,28,0,0),
    ("27 MM GG No2","27 MM G/G No.2 White","White","Semi Finished",8.11,55,0,0),
    ("30 MM GG No2","30 MM G/G No.2 White","White","Semi Finished",9.5,53,0,0),
    ("40 MM GG No1","40 MM G/G No.1 White","White","Semi Finished",11.3,340,0,0),
    ("40 MM GG No2","40 MM G/G No.2 White","White","Semi Finished",11.9,219,0,0),
    ("3 MM GG Radnik","3 MM G/G Radnik White","White","Semi Finished",0.65,21,0,0),
    ("50 MM GG No2","50 MM G/G No.2 White","White","Semi Finished",13.1,187,0,0),
    ("24 MM GG No2","24 MM G/G No.2 White","White","Semi Finished",4.91,0,0,0),
    # Semi Finished - Tape
    ("15 MM Twill Tape","15 MM Twill Tape White","White","Semi Finished",6.1,52,0,0),
    ("16 MM Twill Tape V","16 MM Twill Tape (V) White","White","Semi Finished",6.24,66,0,0),
    ("16 MM Tape W","16 MM Tape (W) White","White","Semi Finished",6.34,35,0,0),
    ("20 MM Twill Tap V","20 MM Twill Tap (V) White","White","Semi Finished",8.12,58,0,0),
    ("25 MM Twill Tap V","25 MM Twill Tap (V) White","White","Semi Finished",9.11,10.2,0,0),
    ("25 MM Tape","25 MM Tape White","White","Semi Finished",7.45,18,0,0),
    ("20 MM Cotton Twill","20 MM Cotton Twill Tape Kora","Kora","Semi Finished",0,0,0,0),
    ("25 MM Edge Satin","25 MM Edge Satin White","White","Semi Finished",6.5,50,0,0),
    # Finished - Knitted Elastics (White)
    ("C-3 Knited Elastic W","C-3 Knited Elastic White","White","Finished",1.86,0,0,0),
    ("C-4 Knited Elastic W","C-4 Knited Elastic White","White","Finished",2.97,0,0,0),
    ("C-8 Knited Elastic W","C-8 Knited Elastic White","White","Finished",5.72,0,0,0),
    ("C-10 Knited Elastic W","C-10 Knited Elastic White","White","Finished",6.87,0,0,0),
    ("18 MM Knited Elastic W","18 MM Knited Elastic White","White","Finished",15.11,0,0,0),
    ("20 MM Knited Elastic W","20 MM Knited Elastic White","White","Finished",18.2,0,0,0),
    ("25 MM Knited Elastic W","25 MM Knited Elastic White","White","Finished",0,0,0,0),
    ("30 MM Knited Elastic W","30 MM Knited Elastic White","White","Finished",23.52,0,0,0),
    ("50 MM Knited Elastic W","50 MM Knited Elastic White","White","Finished",10.28,0,0,0),
    ("60 MM Knited Elastic W","60 MM Knited Elastic White","White","Finished",0,0,0,0),
    # Finished - Knitted Elastics (Black)
    ("C-3 Knited Elastic B","C-3 Knited Elastic Black","Black","Finished",1.83,0,0,0),
    ("C-4 Knited Elastic B","C-4 Knited Elastic Black","Black","Finished",2.9,0,0,0),
    ("C-7 Knited Elastic B","C-7 Knited Elastic Black","Black","Finished",4.82,0,0,0),
    ("25 MM Knited Elastic B","25 MM Knited Elastic Black","Black","Finished",10.45,0,0,0),
    ("30 MM Knited Elastic B","30 MM Knited Elastic Black","Black","Finished",15.3,0,0,0),
    ("30 MM Knited Lycra B","30 MM Knited Lycra Elastic Black","Black","Finished",15.6,0,0,0),
    ("35 MM Knited Elastic B","35 MM Knited Elastic Black","Black","Finished",16.23,0,0,0),
]

SEED_CLIENTS = [
    ("Ravi Garments", "Ravi Kumar", "9876543210", "ravi@ravigarments.com", "Mumbai"),
    ("Patel Textiles", "Suresh Patel", "9123456789", "suresh@pateltex.com", "Surat"),
    ("Fashion House Delhi", "Anita Sharma", "9988776655", "anita@fashiondelhi.com", "Delhi"),
    ("Krishna Exports", "Mahesh Krishna", "9765432109", "mahesh@krishnaexports.com", "Ludhiana"),
    ("Sunrise Fabrics", "Vijay Mehta", "9654321098", "vijay@sunrisefab.com", "Ahmedabad"),
    ("NR Elastic Works", "Naresh Rao", "9543210987", "naresh@nrelastic.com", "Tiruppur"),
]

SEED_SUPPLIERS = [
    ("Shree Ram Yarns", "Ram Prasad", "9876541230", "ram@shreeram.com", "Surat", "GSTIN1234"),
    ("Patel Poly Fibre", "Dinesh Patel", "9765432100", "dinesh@patelpoly.com", "Ahmedabad", "GSTIN5678"),
    ("Krishna Elastics", "Krishna Das", "9654321000", "krishna@krishnaelastic.com", "Tiruppur", "GSTIN9012"),
    ("Modern Dye House", "Sunil Modern", "9543210000", "sunil@moderndye.com", "Surat", "GSTIN3456"),
]

SEED_WORKERS = [
    ("Ramesh Weaver", "9876500001", "Local Area", "Ribbon Weaving", 0.25),
    ("Suresh Operator", "9876500002", "Nearby Town", "Elastic Production", 0.30),
    ("Dinesh Cutter", "9876500003", "City Area", "Cutting & Finishing", 0.20),
    ("Mahesh Knitter", "9876500004", "Local Area", "Knitting", 0.28),
    ("Prakash Winder", "9876500005", "Local Area", "Winding & Packing", 0.22),
]

SEED_ORDERS = [
    ("ORD-20240115-001","2024-01-15","Ravi Garments","3 MM Satin",5000,"In Production","Normal","2024-02-15",""),
    ("ORD-20240118-002","2024-01-18","Patel Textiles","6 MM Satin",3000,"Completed","High","2024-02-10",""),
    ("ORD-20240122-003","2024-01-22","Fashion House Delhi","20 MM GG No1",2500,"Pending","Normal","2024-02-20",""),
    ("ORD-20240125-004","2024-01-25","Krishna Exports","C-4 Knited Elastic W",1500,"In Production","Urgent","2024-02-05",""),
    ("ORD-20240128-005","2024-01-28","Sunrise Fabrics","25 MM Satin",800,"Pending","Normal","2024-03-01",""),
    ("ORD-20240201-006","2024-02-01","NR Elastic Works","30 MM Knited Elastic W",2000,"Completed","Normal","2024-02-25",""),
    ("ORD-20240205-007","2024-02-05","Ravi Garments","20 MM Satin",4500,"In Production","High","2024-03-05",""),
    ("ORD-20240210-008","2024-02-10","Patel Textiles","15 MM GG No2",1200,"Pending","Normal","2024-03-10",""),
]

SEED_JOB_WORK = [
    ("JOB-20240116-001","2024-01-16","ORD-20240115-001","Ramesh Weaver","3 MM Satin",2000,1950,30,"Completed",0.25),
    ("JOB-20240119-002","2024-01-19","ORD-20240118-002","Suresh Operator","6 MM Satin",3000,2940,45,"Completed",0.25),
    ("JOB-20240123-003","2024-01-23","ORD-20240122-003","Dinesh Cutter","20 MM GG No1",1500,0,0,"Out",0.25),
    ("JOB-20240126-004","2024-01-26","ORD-20240125-004","Mahesh Knitter","C-4 Knited Elastic W",1500,1460,25,"Completed",0.30),
    ("JOB-20240202-005","2024-02-02","ORD-20240201-006","Prakash Winder","30 MM Knited Elastic W",2000,1980,15,"Completed",0.25),
    ("JOB-20240206-006","2024-02-06","ORD-20240205-007","Ramesh Weaver","20 MM Satin",2000,0,0,"Out",0.25),
]

SEED_DISPATCH = [
    ("DISP-20240120-001","ORD-20240118-002","Patel Textiles","6 MM Satin",2940,"2024-01-20","CH-2024-001","MH01AB1234","Rajesh Driver",""),
    ("DISP-20240127-002","ORD-20240125-004","Krishna Exports","C-4 Knited Elastic W",1460,"2024-01-27","CH-2024-002","GJ05CD5678","Mahesh Driver",""),
    ("DISP-20240203-003","ORD-20240201-006","NR Elastic Works","30 MM Knited Elastic W",1980,"2024-02-03","CH-2024-003","TN09EF9012","Suresh Driver",""),
]

SEED_PO = [
    ("PO-20240110-001","2024-01-10","Shree Ram Yarns","3 MM Satin",5000,"Mtr",0.90,"2024-01-20",5000,"2024-01-19","Received","INV-SR-001",""),
    ("PO-20240112-002","2024-01-12","Patel Poly Fibre","2/20/Spun Poly",1000,"KG",115.0,"2024-01-25",800,"2024-01-23","Partial","INV-PP-002","Partial receipt"),
    ("PO-20240201-003","2024-02-01","Krishna Elastics","C-4 Knited Elastic W",2000,"Mtr",2.97,"2024-02-15",0,"","Pending","",""),
]


def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA)

        for k, v in DEFAULT_SETTINGS.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?,?,?)",
                (k, v, now_str()),
            )

        # Seed inventory
        for row in SEED_INVENTORY:
            code, name, color, cat, weight, opening, total_in, total_out = row
            closing = opening + total_in - total_out
            conn.execute(
                """INSERT OR IGNORE INTO inventory
                (item_code, item_name, color, category, weight_per_mtr, opening_stock,
                 total_in, total_out, reorder_level, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,50,?,?)""",
                (code, name, color, cat, weight, opening, total_in, total_out, now_str(), now_str()),
            )

        # Seed clients
        for c in SEED_CLIENTS:
            conn.execute(
                "INSERT OR IGNORE INTO clients (client_name,contact_person,phone,email,city) VALUES (?,?,?,?,?)",
                c,
            )

        # Seed suppliers
        for s in SEED_SUPPLIERS:
            conn.execute(
                "INSERT OR IGNORE INTO suppliers (supplier_name,contact_person,phone,email,city,gstin) VALUES (?,?,?,?,?,?)",
                s,
            )

        # Seed workers
        for w in SEED_WORKERS:
            conn.execute(
                "INSERT OR IGNORE INTO workers (worker_name,phone,address,specialty,rate_per_mtr) VALUES (?,?,?,?,?)",
                w,
            )

        # Seed orders
        for o in SEED_ORDERS:
            oid, odate, client, item, qty, status, priority, ddate, remarks = o
            conn.execute(
                """INSERT OR IGNORE INTO orders
                (order_id,order_date,client_name,item_code,ordered_qty,status,priority,delivery_date,remarks,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (oid, odate, client, item, qty, status, priority, ddate, remarks, now_str(), now_str()),
            )

        # Seed job work
        for j in SEED_JOB_WORK:
            jid, jdate, oid, worker, item, sent, recv, waste, status, rate = j
            payment = recv * rate
            conn.execute(
                """INSERT OR IGNORE INTO job_work
                (job_id,job_date,order_id,worker_name,item_code,sent_qty,received_qty,wastage_mtr,status,rate_per_mtr,total_payment,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (jid, jdate, oid, worker, item, sent, recv, waste, status, rate, payment, now_str(), now_str()),
            )

        # Seed dispatch
        for d in SEED_DISPATCH:
            did, oid, client, item, qty, ddate, challan, vehicle, driver, remarks = d
            conn.execute(
                """INSERT OR IGNORE INTO dispatch
                (dispatch_id,order_id,client_name,item_code,dispatched_qty,dispatch_date,challan_no,vehicle_no,driver_name,remarks,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (did, oid, client, item, qty, ddate, challan, vehicle, driver, remarks, now_str()),
            )

        # Seed purchase orders
        for p in SEED_PO:
            pid, pdate, supplier, item, qty, unit, rate, edate, recv, rdate, status, inv, remarks = p
            conn.execute(
                """INSERT OR IGNORE INTO purchase_orders
                (po_id,po_date,supplier_name,item_code,ordered_qty,unit,purchase_rate,expected_date,received_qty,received_date,status,invoice_no,remarks,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (pid, pdate, supplier, item, qty, unit, rate, edate, recv, rdate, status, inv, remarks, now_str(), now_str()),
            )

        # Sync allocated quantities from open orders
        _sync_allocations(conn)


def _sync_allocations(conn):
    conn.execute("UPDATE inventory SET allocated_qty = 0")
    rows = conn.execute(
        "SELECT item_code, SUM(ordered_qty) as total FROM orders WHERE status IN ('Pending','In Production') GROUP BY item_code"
    ).fetchall()
    for r in rows:
        conn.execute(
            "UPDATE inventory SET allocated_qty=? WHERE item_code=?", (r["total"], r["item_code"])
        )


def _reorder_status(closing: float, reorder_level: float, opening: float) -> str:
    if closing <= 0:
        return "REORDER (LOW)"
    if reorder_level > 0 and closing <= reorder_level:
        return "REORDER (LOW)"
    max_stock = opening + 500 if opening > 0 else 500
    if closing > max_stock * 1.5:
        return "ABOVE LEVEL"
    return "NORMAL"


def _closing(item) -> float:
    return (item["opening_stock"] or 0) + (item["total_in"] or 0) - (item["total_out"] or 0)


# ─────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────
class InventoryItem(BaseModel):
    item_code: str
    item_name: str
    color: str = ""
    category: str = "Raw"
    weight_per_mtr: float = 0
    unit: str = "Mtr"
    opening_stock: float = 0
    total_in: float = 0
    total_out: float = 0
    reorder_level: float = 50
    purchase_price: float = 0
    selling_price: float = 0
    supplier_name: str = ""
    notes: str = ""


class InventoryUpdate(BaseModel):
    item_name: Optional[str] = None
    color: Optional[str] = None
    category: Optional[str] = None
    weight_per_mtr: Optional[float] = None
    unit: Optional[str] = None
    opening_stock: Optional[float] = None
    total_in: Optional[float] = None
    total_out: Optional[float] = None
    reorder_level: Optional[float] = None
    purchase_price: Optional[float] = None
    selling_price: Optional[float] = None
    supplier_name: Optional[str] = None
    notes: Optional[str] = None


class StockAdjustment(BaseModel):
    item_code: str
    qty: float
    movement_type: str  # IN or OUT
    reference_type: str = "ADJUSTMENT"
    reference_id: str = ""
    notes: str = ""


class OrderCreate(BaseModel):
    order_date: str
    client_name: str
    item_code: str
    ordered_qty: float
    unit: str = "Mtr"
    status: str = "Pending"
    priority: str = "Normal"
    delivery_date: str = ""
    selling_rate: float = 0
    remarks: str = ""


class OrderUpdate(BaseModel):
    order_date: Optional[str] = None
    client_name: Optional[str] = None
    item_code: Optional[str] = None
    ordered_qty: Optional[float] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    delivery_date: Optional[str] = None
    selling_rate: Optional[float] = None
    remarks: Optional[str] = None


class JobWorkCreate(BaseModel):
    job_date: str
    order_id: str = ""
    worker_name: str
    item_code: str
    sent_qty: float = 0
    received_qty: float = 0
    wastage_mtr: float = 0
    status: str = "Out"
    rate_per_mtr: float = 0.25
    total_payment: float = 0
    remarks: str = ""


class JobWorkUpdate(BaseModel):
    job_date: Optional[str] = None
    worker_name: Optional[str] = None
    item_code: Optional[str] = None
    sent_qty: Optional[float] = None
    received_qty: Optional[float] = None
    wastage_mtr: Optional[float] = None
    status: Optional[str] = None
    rate_per_mtr: Optional[float] = None
    total_payment: Optional[float] = None
    remarks: Optional[str] = None


class DispatchCreate(BaseModel):
    order_id: str
    client_name: str
    item_code: str
    dispatched_qty: float
    dispatch_date: str
    challan_no: str = ""
    vehicle_no: str = ""
    driver_name: str = ""
    remarks: str = ""
    mark_completed: bool = False


class POCreate(BaseModel):
    po_date: str
    supplier_name: str
    item_code: str
    ordered_qty: float
    unit: str = "Mtr"
    purchase_rate: float = 0
    expected_date: str = ""
    invoice_no: str = ""
    remarks: str = ""


class POReceive(BaseModel):
    received_qty: float
    received_date: str
    invoice_no: str = ""
    update_stock: bool = True


class ClientCreate(BaseModel):
    client_name: str
    contact_person: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    city: str = ""
    payment_terms: int = 30
    credit_limit: float = 0
    notes: str = ""


class SupplierCreate(BaseModel):
    supplier_name: str
    contact_person: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    city: str = ""
    payment_terms: int = 30
    gstin: str = ""
    notes: str = ""


class WorkerCreate(BaseModel):
    worker_name: str
    phone: str = ""
    address: str = ""
    specialty: str = ""
    rate_per_mtr: float = 0.25
    notes: str = ""


class SettingsUpdate(BaseModel):
    settings: Dict[str, str]


# ─────────────────────────────────────────────
# HELPER: Generate IDs
# ─────────────────────────────────────────────
def _gen_id(prefix: str, last_row: int) -> str:
    d = date.today().strftime("%Y%m%d")
    return f"{prefix}-{d}-{str(last_row + 1).zfill(3)}"


# ─────────────────────────────────────────────
# ROUTES: DASHBOARD / KPIs
# ─────────────────────────────────────────────
@app.get("/api/kpis")
def get_kpis():
    with get_db() as conn:
        inv = rows_to_list(conn.execute("SELECT * FROM inventory").fetchall())
        orders = rows_to_list(conn.execute("SELECT * FROM orders").fetchall())
        jw = rows_to_list(conn.execute("SELECT * FROM job_work").fetchall())
        disp = rows_to_list(conn.execute("SELECT * FROM dispatch").fetchall())

        for item in inv:
            item["closing_balance"] = _closing(item)
            item["reorder_status"] = _reorder_status(item["closing_balance"], item["reorder_level"], item["opening_stock"])

        reorder_items = [i for i in inv if i["reorder_status"] == "REORDER (LOW)"]
        active_orders = [o for o in orders if o["status"] == "In Production"]
        pending_orders = [o for o in orders if o["status"] == "Pending"]
        completed_orders = [o for o in orders if o["status"] == "Completed"]
        jw_out = [j for j in jw if j["status"] == "Out"]

        total_dispatched = sum(d.get("dispatched_qty", 0) for d in disp)
        total_sent = sum(j.get("sent_qty", 0) for j in jw)
        total_wastage = sum(j.get("wastage_mtr", 0) for j in jw)
        avg_wastage_pct = round(total_wastage / total_sent * 100, 2) if total_sent > 0 else 0

        fulfilment_rate = round(len(completed_orders) / len(orders) * 100, 1) if orders else 0

        # Category breakdown
        cat_map = {}
        for item in inv:
            cat = item.get("category") or "Other"
            if cat not in cat_map:
                cat_map[cat] = {"count": 0, "total_stock": 0}
            cat_map[cat]["count"] += 1
            cat_map[cat]["total_stock"] += item["closing_balance"]

        # Top 5 items by closing balance
        top_items = sorted(
            [i for i in inv if i["closing_balance"] > 0],
            key=lambda x: x["closing_balance"],
            reverse=True,
        )[:5]

        # Monthly dispatch trend
        monthly_dispatch = {}
        for d in disp:
            if d.get("dispatch_date"):
                month = d["dispatch_date"][:7]
                monthly_dispatch[month] = monthly_dispatch.get(month, 0) + (d.get("dispatched_qty") or 0)

        # Worker payment summary
        worker_payments = {}
        for j in jw:
            w = j.get("worker_name") or "Unknown"
            worker_payments[w] = worker_payments.get(w, 0) + (j.get("total_payment") or 0)

        top_workers = sorted(worker_payments.items(), key=lambda x: x[1], reverse=True)[:5]

        # Total inventory value
        total_inv_value = sum(
            (i.get("purchase_price") or 0) * i["closing_balance"] for i in inv
        )

        return {
            "reorder_count": len(reorder_items),
            "reorder_items": [i["item_code"] for i in reorder_items],
            "active_order_count": len(active_orders),
            "pending_order_count": len(pending_orders),
            "completed_order_count": len(completed_orders),
            "total_order_count": len(orders),
            "fulfilment_rate": fulfilment_rate,
            "jw_live_count": len(jw_out),
            "total_dispatched": total_dispatched,
            "avg_wastage_pct": avg_wastage_pct,
            "total_items": len(inv),
            "category_breakdown": cat_map,
            "top_items": [{"code": i["item_code"], "balance": i["closing_balance"]} for i in top_items],
            "monthly_dispatch": monthly_dispatch,
            "top_workers": [{"worker": w[0], "payment": w[1]} for w in top_workers],
            "total_inventory_value": round(total_inv_value, 2),
        }


@app.get("/api/alerts")
def get_alerts():
    with get_db() as conn:
        inv = rows_to_list(conn.execute("SELECT * FROM inventory").fetchall())
        alerts = []
        for item in inv:
            closing = _closing(item)
            allocated = item.get("allocated_qty") or 0
            status = _reorder_status(closing, item["reorder_level"], item["opening_stock"])
            if status == "REORDER (LOW)":
                alerts.append({
                    "type": "critical",
                    "item_code": item["item_code"],
                    "item_name": item["item_name"],
                    "closing_balance": closing,
                    "allocated": allocated,
                    "reorder_level": item["reorder_level"],
                    "message": "Stock at critical level — immediate reorder required",
                })
            elif closing > 0 and allocated > 0 and allocated / closing > 0.8:
                alerts.append({
                    "type": "warning",
                    "item_code": item["item_code"],
                    "item_name": item["item_name"],
                    "closing_balance": closing,
                    "allocated": allocated,
                    "reorder_level": item["reorder_level"],
                    "message": "Over 80% of stock allocated to active orders",
                })
        return alerts


# ─────────────────────────────────────────────
# ROUTES: INVENTORY
# ─────────────────────────────────────────────
@app.get("/api/inventory")
def list_inventory(
    q: str = Query(""),
    category: str = Query(""),
    status: str = Query(""),
):
    with get_db() as conn:
        rows = rows_to_list(conn.execute("SELECT * FROM inventory ORDER BY category, item_code").fetchall())
    result = []
    for item in rows:
        closing = _closing(item)
        item["closing_balance"] = closing
        item["reorder_status"] = _reorder_status(closing, item["reorder_level"], item["opening_stock"])
        if q and q.lower() not in (item["item_code"] + item["item_name"] + item.get("color", "")).lower():
            continue
        if category and item["category"] != category:
            continue
        if status and item["reorder_status"] != status:
            continue
        result.append(item)
    return result


@app.post("/api/inventory", status_code=201)
def add_inventory(data: InventoryItem):
    with get_db() as conn:
        existing = conn.execute("SELECT item_code FROM inventory WHERE item_code=?", (data.item_code,)).fetchone()
        if existing:
            raise HTTPException(400, f"Item code {data.item_code} already exists")
        conn.execute(
            """INSERT INTO inventory
            (item_code,item_name,color,category,weight_per_mtr,unit,opening_stock,
             total_in,total_out,reorder_level,purchase_price,selling_price,supplier_name,notes,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (data.item_code, data.item_name, data.color, data.category, data.weight_per_mtr,
             data.unit, data.opening_stock, data.total_in, data.total_out, data.reorder_level,
             data.purchase_price, data.selling_price, data.supplier_name, data.notes, now_str(), now_str()),
        )
        log_activity(conn, "ADD", "Inventory", data.item_code, f"Added {data.item_name}")
    return {"success": True, "message": f"Item {data.item_code} added successfully"}


@app.put("/api/inventory/{item_code}")
def update_inventory(item_code: str, data: InventoryUpdate):
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM inventory WHERE item_code=?", (item_code,)).fetchone()
        if not existing:
            raise HTTPException(404, "Item not found")
        updates = {k: v for k, v in data.dict().items() if v is not None}
        updates["updated_at"] = now_str()
        set_clause = ", ".join(f"{k}=?" for k in updates)
        conn.execute(
            f"UPDATE inventory SET {set_clause} WHERE item_code=?",
            list(updates.values()) + [item_code],
        )
        log_activity(conn, "UPDATE", "Inventory", item_code, f"Updated fields: {list(updates.keys())}")
    return {"success": True, "message": "Item updated"}


@app.delete("/api/inventory/{item_code}")
def delete_inventory(item_code: str):
    with get_db() as conn:
        conn.execute("DELETE FROM inventory WHERE item_code=?", (item_code,))
        log_activity(conn, "DELETE", "Inventory", item_code, "Item deleted")
    return {"success": True}


@app.post("/api/inventory/adjustment")
def stock_adjustment(data: StockAdjustment):
    with get_db() as conn:
        item = conn.execute("SELECT * FROM inventory WHERE item_code=?", (data.item_code,)).fetchone()
        if not item:
            raise HTTPException(404, "Item not found")
        if data.movement_type == "IN":
            conn.execute("UPDATE inventory SET total_in=total_in+?, updated_at=? WHERE item_code=?",
                         (data.qty, now_str(), data.item_code))
        else:
            conn.execute("UPDATE inventory SET total_out=total_out+?, updated_at=? WHERE item_code=?",
                         (data.qty, now_str(), data.item_code))
        conn.execute(
            "INSERT INTO stock_movements (item_code,movement_type,qty,reference_type,reference_id,notes,created_at) VALUES (?,?,?,?,?,?,?)",
            (data.item_code, data.movement_type, data.qty, data.reference_type, data.reference_id, data.notes, now_str()),
        )
        log_activity(conn, "ADJUSTMENT", "Inventory", data.item_code,
                     f"{data.movement_type} {data.qty} units - {data.notes}")
    return {"success": True, "message": f"Stock adjusted: {data.movement_type} {data.qty}"}


@app.get("/api/inventory/{item_code}/movements")
def get_movements(item_code: str):
    with get_db() as conn:
        return rows_to_list(conn.execute(
            "SELECT * FROM stock_movements WHERE item_code=? ORDER BY created_at DESC LIMIT 50",
            (item_code,),
        ).fetchall())


# ─────────────────────────────────────────────
# ROUTES: ORDERS
# ─────────────────────────────────────────────
@app.get("/api/orders")
def list_orders(
    q: str = Query(""),
    status: str = Query(""),
    client: str = Query(""),
    priority: str = Query(""),
):
    with get_db() as conn:
        rows = rows_to_list(conn.execute("SELECT * FROM orders ORDER BY order_date DESC").fetchall())
    result = []
    for o in rows:
        if q and q.lower() not in (o["order_id"] + o["client_name"] + o["item_code"]).lower():
            continue
        if status and o["status"] != status:
            continue
        if client and o["client_name"] != client:
            continue
        if priority and o["priority"] != priority:
            continue
        result.append(o)
    return result


@app.post("/api/orders", status_code=201)
def create_order(data: OrderCreate):
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) as c FROM orders").fetchone()["c"]
        order_id = _gen_id("ORD", count)
        conn.execute(
            """INSERT INTO orders
            (order_id,order_date,client_name,item_code,ordered_qty,unit,status,priority,delivery_date,selling_rate,remarks,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (order_id, data.order_date, data.client_name, data.item_code, data.ordered_qty,
             data.unit, data.status, data.priority, data.delivery_date, data.selling_rate,
             data.remarks, now_str(), now_str()),
        )
        # Ensure client exists
        conn.execute("INSERT OR IGNORE INTO clients (client_name) VALUES (?)", (data.client_name,))
        _sync_allocations(conn)
        log_activity(conn, "ADD", "Orders", order_id, f"New order for {data.client_name}")
    return {"success": True, "order_id": order_id, "message": f"Order {order_id} created"}


@app.put("/api/orders/{order_id}")
def update_order(order_id: str, data: OrderUpdate):
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM orders WHERE order_id=?", (order_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Order not found")
        updates = {k: v for k, v in data.dict().items() if v is not None}
        updates["updated_at"] = now_str()
        set_clause = ", ".join(f"{k}=?" for k in updates)
        conn.execute(
            f"UPDATE orders SET {set_clause} WHERE order_id=?",
            list(updates.values()) + [order_id],
        )
        _sync_allocations(conn)
        log_activity(conn, "UPDATE", "Orders", order_id, str(updates))
    return {"success": True, "message": f"Order {order_id} updated"}


@app.delete("/api/orders/{order_id}")
def delete_order(order_id: str):
    with get_db() as conn:
        conn.execute("DELETE FROM orders WHERE order_id=?", (order_id,))
        _sync_allocations(conn)
        log_activity(conn, "DELETE", "Orders", order_id, "Order deleted")
    return {"success": True}


@app.get("/api/orders/{order_id}/lifecycle")
def order_lifecycle(order_id: str):
    with get_db() as conn:
        order = row_to_dict(conn.execute("SELECT * FROM orders WHERE order_id=?", (order_id,)).fetchone())
        if not order:
            raise HTTPException(404, "Order not found")
        jobs = rows_to_list(conn.execute("SELECT * FROM job_work WHERE order_id=?", (order_id,)).fetchall())
        dispatches = rows_to_list(conn.execute("SELECT * FROM dispatch WHERE order_id=?", (order_id,)).fetchall())
    return {"order": order, "jobs": jobs, "dispatches": dispatches}


# ─────────────────────────────────────────────
# ROUTES: JOB WORK
# ─────────────────────────────────────────────
@app.get("/api/jobwork")
def list_jobwork(
    q: str = Query(""),
    status: str = Query(""),
    worker: str = Query(""),
):
    with get_db() as conn:
        rows = rows_to_list(conn.execute("SELECT * FROM job_work ORDER BY job_date DESC").fetchall())
    result = []
    for j in rows:
        if q and q.lower() not in (j["job_id"] + j["worker_name"] + j.get("order_id","") + j["item_code"]).lower():
            continue
        if status and j["status"] != status:
            continue
        if worker and j["worker_name"] != worker:
            continue
        result.append(j)
    return result


@app.post("/api/jobwork", status_code=201)
def create_jobwork(data: JobWorkCreate):
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) as c FROM job_work").fetchone()["c"]
        job_id = _gen_id("JOB", count)
        payment = data.total_payment if data.total_payment > 0 else data.received_qty * data.rate_per_mtr
        conn.execute(
            """INSERT INTO job_work
            (job_id,job_date,order_id,worker_name,item_code,sent_qty,received_qty,wastage_mtr,status,rate_per_mtr,total_payment,remarks,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (job_id, data.job_date, data.order_id, data.worker_name, data.item_code,
             data.sent_qty, data.received_qty, data.wastage_mtr, data.status,
             data.rate_per_mtr, payment, data.remarks, now_str(), now_str()),
        )
        # Ensure worker exists
        conn.execute("INSERT OR IGNORE INTO workers (worker_name) VALUES (?)", (data.worker_name,))
        log_activity(conn, "ADD", "JobWork", job_id, f"Job for {data.worker_name}")
    return {"success": True, "job_id": job_id, "message": f"Job {job_id} created"}


@app.put("/api/jobwork/{job_id}")
def update_jobwork(job_id: str, data: JobWorkUpdate):
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM job_work WHERE job_id=?", (job_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "Job not found")
        updates = {k: v for k, v in data.dict().items() if v is not None}
        # Recalculate payment if received_qty or rate changed
        e = dict(existing)
        recv = updates.get("received_qty", e["received_qty"])
        rate = updates.get("rate_per_mtr", e["rate_per_mtr"])
        if "received_qty" in updates or "rate_per_mtr" in updates:
            updates["total_payment"] = recv * rate
        updates["updated_at"] = now_str()
        set_clause = ", ".join(f"{k}=?" for k in updates)
        conn.execute(
            f"UPDATE job_work SET {set_clause} WHERE job_id=?",
            list(updates.values()) + [job_id],
        )
        log_activity(conn, "UPDATE", "JobWork", job_id, str(updates))
    return {"success": True}


@app.delete("/api/jobwork/{job_id}")
def delete_jobwork(job_id: str):
    with get_db() as conn:
        conn.execute("DELETE FROM job_work WHERE job_id=?", (job_id,))
    return {"success": True}


# ─────────────────────────────────────────────
# ROUTES: DISPATCH
# ─────────────────────────────────────────────
@app.get("/api/dispatch")
def list_dispatch(
    q: str = Query(""),
    date_filter: str = Query("all"),
):
    with get_db() as conn:
        rows = rows_to_list(conn.execute("SELECT * FROM dispatch ORDER BY dispatch_date DESC").fetchall())
    today = today_str()
    month = today[:7]
    result = []
    for d in rows:
        if q and q.lower() not in (d["dispatch_id"] + d["order_id"] + d["client_name"] + d.get("challan_no","")).lower():
            continue
        if date_filter == "today" and d.get("dispatch_date") != today:
            continue
        if date_filter == "month" and not (d.get("dispatch_date") or "").startswith(month):
            continue
        result.append(d)
    return result


@app.post("/api/dispatch", status_code=201)
def create_dispatch(data: DispatchCreate):
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) as c FROM dispatch").fetchone()["c"]
        disp_id = _gen_id("DISP", count)
        conn.execute(
            """INSERT INTO dispatch
            (dispatch_id,order_id,client_name,item_code,dispatched_qty,dispatch_date,challan_no,vehicle_no,driver_name,remarks,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (disp_id, data.order_id, data.client_name, data.item_code, data.dispatched_qty,
             data.dispatch_date, data.challan_no, data.vehicle_no, data.driver_name, data.remarks, now_str()),
        )
        # Update stock
        conn.execute("UPDATE inventory SET total_out=total_out+?, updated_at=? WHERE item_code=?",
                     (data.dispatched_qty, now_str(), data.item_code))
        if data.mark_completed:
            conn.execute("UPDATE orders SET status='Completed', updated_at=? WHERE order_id=?",
                         (now_str(), data.order_id))
            _sync_allocations(conn)
        log_activity(conn, "ADD", "Dispatch", disp_id, f"Dispatched {data.dispatched_qty} of {data.item_code} to {data.client_name}")
    return {"success": True, "dispatch_id": disp_id, "message": f"Dispatch {disp_id} logged"}


@app.delete("/api/dispatch/{dispatch_id}")
def delete_dispatch(dispatch_id: str):
    with get_db() as conn:
        conn.execute("DELETE FROM dispatch WHERE dispatch_id=?", (dispatch_id,))
    return {"success": True}


# ─────────────────────────────────────────────
# ROUTES: PURCHASE ORDERS
# ─────────────────────────────────────────────
@app.get("/api/purchase-orders")
def list_po(q: str = Query(""), status: str = Query("")):
    with get_db() as conn:
        rows = rows_to_list(conn.execute("SELECT * FROM purchase_orders ORDER BY po_date DESC").fetchall())
    result = []
    for p in rows:
        if q and q.lower() not in (p["po_id"] + p["supplier_name"] + p["item_code"]).lower():
            continue
        if status and p["status"] != status:
            continue
        result.append(p)
    return result


@app.post("/api/purchase-orders", status_code=201)
def create_po(data: POCreate):
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) as c FROM purchase_orders").fetchone()["c"]
        po_id = _gen_id("PO", count)
        conn.execute(
            """INSERT INTO purchase_orders
            (po_id,po_date,supplier_name,item_code,ordered_qty,unit,purchase_rate,expected_date,invoice_no,remarks,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (po_id, data.po_date, data.supplier_name, data.item_code, data.ordered_qty,
             data.unit, data.purchase_rate, data.expected_date, data.invoice_no, data.remarks, now_str(), now_str()),
        )
        conn.execute("INSERT OR IGNORE INTO suppliers (supplier_name) VALUES (?)", (data.supplier_name,))
        log_activity(conn, "ADD", "PurchaseOrders", po_id, f"PO for {data.item_code} from {data.supplier_name}")
    return {"success": True, "po_id": po_id, "message": f"PO {po_id} created"}


@app.put("/api/purchase-orders/{po_id}/receive")
def receive_po(po_id: str, data: POReceive):
    with get_db() as conn:
        po = row_to_dict(conn.execute("SELECT * FROM purchase_orders WHERE po_id=?", (po_id,)).fetchone())
        if not po:
            raise HTTPException(404, "PO not found")
        total_received = (po.get("received_qty") or 0) + data.received_qty
        new_status = "Received" if total_received >= po["ordered_qty"] else "Partial"
        conn.execute(
            "UPDATE purchase_orders SET received_qty=?,received_date=?,status=?,invoice_no=?,updated_at=? WHERE po_id=?",
            (total_received, data.received_date, new_status,
             data.invoice_no or po.get("invoice_no",""), now_str(), po_id),
        )
        if data.update_stock:
            conn.execute("UPDATE inventory SET total_in=total_in+?, updated_at=? WHERE item_code=?",
                         (data.received_qty, now_str(), po["item_code"]))
            conn.execute(
                "INSERT INTO stock_movements (item_code,movement_type,qty,reference_type,reference_id,notes,created_at) VALUES (?,?,?,?,?,?,?)",
                (po["item_code"], "IN", data.received_qty, "PO", po_id, f"Received from PO {po_id}", now_str()),
            )
        log_activity(conn, "RECEIVE", "PurchaseOrders", po_id, f"Received {data.received_qty} units")
    return {"success": True, "message": f"Goods received for {po_id}"}


@app.delete("/api/purchase-orders/{po_id}")
def delete_po(po_id: str):
    with get_db() as conn:
        conn.execute("DELETE FROM purchase_orders WHERE po_id=?", (po_id,))
    return {"success": True}


# ─────────────────────────────────────────────
# ROUTES: CLIENTS
# ─────────────────────────────────────────────
@app.get("/api/clients")
def list_clients():
    with get_db() as conn:
        clients = rows_to_list(conn.execute("SELECT * FROM clients ORDER BY client_name").fetchall())
        for c in clients:
            orders = conn.execute(
                "SELECT COUNT(*) as cnt, SUM(ordered_qty) as total_qty FROM orders WHERE client_name=?",
                (c["client_name"],),
            ).fetchone()
            c["order_count"] = orders["cnt"] or 0
            c["total_ordered"] = orders["total_qty"] or 0
        return clients


@app.post("/api/clients", status_code=201)
def create_client(data: ClientCreate):
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM clients WHERE client_name=?", (data.client_name,)).fetchone()
        if existing:
            raise HTTPException(400, "Client already exists")
        conn.execute(
            """INSERT INTO clients (client_name,contact_person,phone,email,address,city,payment_terms,credit_limit,notes)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (data.client_name, data.contact_person, data.phone, data.email, data.address,
             data.city, data.payment_terms, data.credit_limit, data.notes),
        )
    return {"success": True, "message": f"Client {data.client_name} added"}


@app.put("/api/clients/{client_id}")
def update_client(client_id: int, data: ClientCreate):
    with get_db() as conn:
        conn.execute(
            """UPDATE clients SET client_name=?,contact_person=?,phone=?,email=?,address=?,city=?,payment_terms=?,credit_limit=?,notes=?
            WHERE id=?""",
            (data.client_name, data.contact_person, data.phone, data.email, data.address,
             data.city, data.payment_terms, data.credit_limit, data.notes, client_id),
        )
    return {"success": True}


@app.delete("/api/clients/{client_id}")
def delete_client(client_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM clients WHERE id=?", (client_id,))
    return {"success": True}


# ─────────────────────────────────────────────
# ROUTES: SUPPLIERS
# ─────────────────────────────────────────────
@app.get("/api/suppliers")
def list_suppliers():
    with get_db() as conn:
        suppliers = rows_to_list(conn.execute("SELECT * FROM suppliers ORDER BY supplier_name").fetchall())
        for s in suppliers:
            pos = conn.execute(
                "SELECT COUNT(*) as cnt, SUM(ordered_qty) as total FROM purchase_orders WHERE supplier_name=?",
                (s["supplier_name"],),
            ).fetchone()
            s["po_count"] = pos["cnt"] or 0
            s["total_ordered"] = pos["total"] or 0
        return suppliers


@app.post("/api/suppliers", status_code=201)
def create_supplier(data: SupplierCreate):
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM suppliers WHERE supplier_name=?", (data.supplier_name,)).fetchone()
        if existing:
            raise HTTPException(400, "Supplier already exists")
        conn.execute(
            """INSERT INTO suppliers (supplier_name,contact_person,phone,email,address,city,payment_terms,gstin,notes)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (data.supplier_name, data.contact_person, data.phone, data.email, data.address,
             data.city, data.payment_terms, data.gstin, data.notes),
        )
    return {"success": True, "message": f"Supplier {data.supplier_name} added"}


@app.put("/api/suppliers/{supplier_id}")
def update_supplier(supplier_id: int, data: SupplierCreate):
    with get_db() as conn:
        conn.execute(
            """UPDATE suppliers SET supplier_name=?,contact_person=?,phone=?,email=?,address=?,city=?,payment_terms=?,gstin=?,notes=?
            WHERE id=?""",
            (data.supplier_name, data.contact_person, data.phone, data.email, data.address,
             data.city, data.payment_terms, data.gstin, data.notes, supplier_id),
        )
    return {"success": True}


@app.delete("/api/suppliers/{supplier_id}")
def delete_supplier(supplier_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM suppliers WHERE id=?", (supplier_id,))
    return {"success": True}


# ─────────────────────────────────────────────
# ROUTES: WORKERS
# ─────────────────────────────────────────────
@app.get("/api/workers")
def list_workers():
    with get_db() as conn:
        workers = rows_to_list(conn.execute("SELECT * FROM workers ORDER BY worker_name").fetchall())
        for w in workers:
            stats = conn.execute(
                """SELECT COUNT(*) as jobs, SUM(sent_qty) as total_sent,
                   SUM(received_qty) as total_recv, SUM(wastage_mtr) as total_waste,
                   SUM(total_payment) as total_pay
                   FROM job_work WHERE worker_name=?""",
                (w["worker_name"],),
            ).fetchone()
            w["job_count"] = stats["jobs"] or 0
            w["total_sent"] = stats["total_sent"] or 0
            w["total_received"] = stats["total_recv"] or 0
            w["total_wastage"] = stats["total_waste"] or 0
            w["total_payment"] = stats["total_pay"] or 0
        return workers


@app.post("/api/workers", status_code=201)
def create_worker(data: WorkerCreate):
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM workers WHERE worker_name=?", (data.worker_name,)).fetchone()
        if existing:
            raise HTTPException(400, "Worker already exists")
        conn.execute(
            "INSERT INTO workers (worker_name,phone,address,specialty,rate_per_mtr,notes) VALUES (?,?,?,?,?,?)",
            (data.worker_name, data.phone, data.address, data.specialty, data.rate_per_mtr, data.notes),
        )
    return {"success": True, "message": f"Worker {data.worker_name} added"}


@app.put("/api/workers/{worker_id}")
def update_worker(worker_id: int, data: WorkerCreate):
    with get_db() as conn:
        conn.execute(
            "UPDATE workers SET worker_name=?,phone=?,address=?,specialty=?,rate_per_mtr=?,notes=? WHERE id=?",
            (data.worker_name, data.phone, data.address, data.specialty, data.rate_per_mtr, data.notes, worker_id),
        )
    return {"success": True}


@app.delete("/api/workers/{worker_id}")
def delete_worker(worker_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM workers WHERE id=?", (worker_id,))
    return {"success": True}


# ─────────────────────────────────────────────
# ROUTES: SETTINGS
# ─────────────────────────────────────────────
@app.get("/api/settings")
def get_settings():
    with get_db() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {r["key"]: r["value"] for r in rows}


@app.put("/api/settings")
def update_settings(data: SettingsUpdate):
    with get_db() as conn:
        for k, v in data.settings.items():
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?,?,?)",
                (k, v, now_str()),
            )
    return {"success": True}


# ─────────────────────────────────────────────
# ROUTES: ACTIVITY LOG
# ─────────────────────────────────────────────
@app.get("/api/activity-log")
def get_activity_log(limit: int = Query(100)):
    with get_db() as conn:
        return rows_to_list(conn.execute(
            "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall())


# ─────────────────────────────────────────────
# ROUTES: REPORTS & EXPORTS
# ─────────────────────────────────────────────
@app.get("/api/reports/stock-summary")
def report_stock_summary(fmt: str = Query("json")):
    with get_db() as conn:
        rows = rows_to_list(conn.execute("SELECT * FROM inventory ORDER BY category, item_code").fetchall())
    data = []
    for item in rows:
        closing = _closing(item)
        data.append({
            "Item Code": item["item_code"],
            "Item Name": item["item_name"],
            "Color": item.get("color",""),
            "Category": item["category"],
            "Opening Stock": item["opening_stock"],
            "Total In": item["total_in"],
            "Total Out": item["total_out"],
            "Closing Balance": closing,
            "Allocated Qty": item.get("allocated_qty", 0),
            "Reorder Level": item["reorder_level"],
            "Status": _reorder_status(closing, item["reorder_level"], item["opening_stock"]),
        })
    if fmt == "csv":
        return _csv_response(data, "stock_summary.csv")
    return data


@app.get("/api/reports/order-summary")
def report_order_summary(fmt: str = Query("json")):
    with get_db() as conn:
        orders = rows_to_list(conn.execute("SELECT * FROM orders ORDER BY order_date DESC").fetchall())
    if fmt == "csv":
        return _csv_response(orders, "order_summary.csv")
    return orders


@app.get("/api/reports/dispatch-summary")
def report_dispatch_summary(fmt: str = Query("json")):
    with get_db() as conn:
        data = rows_to_list(conn.execute("SELECT * FROM dispatch ORDER BY dispatch_date DESC").fetchall())
    if fmt == "csv":
        return _csv_response(data, "dispatch_summary.csv")
    return data


@app.get("/api/reports/worker-payments")
def report_worker_payments(fmt: str = Query("json")):
    with get_db() as conn:
        data = rows_to_list(conn.execute(
            """SELECT worker_name,
               COUNT(*) as job_count,
               SUM(sent_qty) as total_sent,
               SUM(received_qty) as total_received,
               SUM(wastage_mtr) as total_wastage,
               SUM(total_payment) as total_payment
               FROM job_work GROUP BY worker_name ORDER BY total_payment DESC"""
        ).fetchall())
    if fmt == "csv":
        return _csv_response(data, "worker_payments.csv")
    return data


@app.get("/api/reports/client-statement/{client_name}")
def report_client_statement(client_name: str, fmt: str = Query("json")):
    with get_db() as conn:
        orders = rows_to_list(conn.execute(
            "SELECT * FROM orders WHERE client_name=? ORDER BY order_date DESC", (client_name,)
        ).fetchall())
        dispatches = rows_to_list(conn.execute(
            "SELECT * FROM dispatch WHERE client_name=? ORDER BY dispatch_date DESC", (client_name,)
        ).fetchall())
    result = {"orders": orders, "dispatches": dispatches}
    if fmt == "csv":
        return _csv_response(orders, f"client_{client_name}.csv")
    return result


@app.get("/api/reports/reorder-list")
def report_reorder(fmt: str = Query("json")):
    with get_db() as conn:
        rows = rows_to_list(conn.execute("SELECT * FROM inventory").fetchall())
    data = []
    for item in rows:
        closing = _closing(item)
        if _reorder_status(closing, item["reorder_level"], item["opening_stock"]) == "REORDER (LOW)":
            data.append({
                "Item Code": item["item_code"],
                "Item Name": item["item_name"],
                "Category": item["category"],
                "Closing Balance": closing,
                "Reorder Level": item["reorder_level"],
                "Supplier": item.get("supplier_name",""),
            })
    if fmt == "csv":
        return _csv_response(data, "reorder_list.csv")
    return data


def _csv_response(data: list, filename: str):
    if not data:
        return StreamingResponse(io.StringIO("No data"), media_type="text/csv",
                                  headers={"Content-Disposition": f"attachment; filename={filename}"})
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows(data)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─────────────────────────────────────────────
# SERVE FRONTEND
# ─────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    html_path = os.path.join(os.path.dirname(__file__), "frontend", "index.html")
    if os.path.exists(html_path):
        with open(html_path, "r", encoding="utf-8") as f:
            return HTMLResponse(f.read())
    return HTMLResponse("<h1>Frontend not found. Place index.html in /frontend/</h1>", status_code=404)


# ─────────────────────────────────────────────
# STARTUP
# ─────────────────────────────────────────────
@app.on_event("startup")
def startup():
    init_db()
    print("✅ IMS Database initialized")
    print("🚀 Jai Roop Textiles IMS V7 running at http://localhost:8000")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
