from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import math
from database import get_db_connection

app = FastAPI(title="RailNex API")

# Add CORS so our frontend can call the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PNRRequest(BaseModel):
    pnr: str

class PaymentRequest(BaseModel):
    pnr: str
    amount: int

class ActivateRequest(BaseModel):
    pnr: str

class ExtendRequest(BaseModel):
    pnr: str

def calculate_plan(distance: int):
    price = 0 if distance < 100 else 10
    validity_minutes = math.ceil((distance / 100) * 20)
    return price, validity_minutes

@app.post("/verify-ticket")
def verify_ticket(req: PNRRequest):
    conn = get_db_connection()
    ticket = conn.execute("SELECT * FROM tickets WHERE pnr = ?", (req.pnr,)).fetchone()
    conn.close()

    if not ticket:
        return {"valid": False, "message": "Ticket not found"}

    price, validity_minutes = calculate_plan(ticket['distance'])

    return {
        "valid": True,
        "source": ticket['source'],
        "destination": ticket['destination'],
        "distance": ticket['distance'],
        "price": price,
        "validity_minutes": validity_minutes
    }

@app.post("/payment")
def process_payment(req: PaymentRequest):
    # Mock payment logic
    if req.amount < 10:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    # In a real app, this would integrate with a payment gateway.
    # We'll just return success.
    return {"success": True, "message": f"Payment of ₹{req.amount} successful"}

@app.post("/activate")
def activate_service(req: ActivateRequest):
    conn = get_db_connection()
    ticket = conn.execute("SELECT * FROM tickets WHERE pnr = ?", (req.pnr,)).fetchone()
    
    if not ticket:
        conn.close()
        raise HTTPException(status_code=404, detail="Ticket not found")

    _, validity_minutes = calculate_plan(ticket['distance'])
    
    activation_time = int(time.time())
    expiry_time = activation_time + (validity_minutes * 60)

    # Insert or update active plan
    conn.execute('''
    INSERT INTO active_plans (pnr, activation_time, expiry_time, status)
    VALUES (?, ?, ?, 'active')
    ON CONFLICT(pnr) DO UPDATE SET
        activation_time=excluded.activation_time,
        expiry_time=excluded.expiry_time,
        status='active'
    ''', (req.pnr, activation_time, expiry_time))
    
    conn.commit()
    conn.close()

    return {
        "success": True,
        "activation_time": activation_time,
        "expiry_time": expiry_time,
        "status": "active"
    }

@app.post("/extend")
def extend_validity(req: ExtendRequest):
    # Extending validity adds a fixed amount of time or triggers a new plan calculation.
    # Based on prototype rules, we'll extend for another 10 Rs. Let's give them another 60 minutes or a predefined amount.
    # The requirement says: "The passenger can extend validity by paying another ₹10."
    # Let's say ₹10 gives 60 minutes for extension.
    extension_minutes = 60
    
    conn = get_db_connection()
    active_plan = conn.execute("SELECT * FROM active_plans WHERE pnr = ?", (req.pnr,)).fetchone()
    
    if not active_plan:
        conn.close()
        raise HTTPException(status_code=404, detail="No active plan found for this PNR")
    
    current_time = int(time.time())
    
    # If already expired, start from current time. If active, add to existing expiry.
    if active_plan['expiry_time'] > current_time:
        new_expiry = active_plan['expiry_time'] + (extension_minutes * 60)
    else:
        new_expiry = current_time + (extension_minutes * 60)
        
    conn.execute("UPDATE active_plans SET expiry_time = ?, status = 'active' WHERE pnr = ?", (new_expiry, req.pnr))
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "new_expiry_time": new_expiry,
        "status": "active"
    }

@app.get("/status")
def get_status(pnr: str):
    conn = get_db_connection()
    plan = conn.execute("SELECT * FROM active_plans WHERE pnr = ?", (pnr,)).fetchone()
    conn.close()
    
    if not plan:
        return {"status": "inactive"}
        
    current_time = int(time.time())
    status = "active" if plan['expiry_time'] > current_time else "expired"
    
    # Update status in DB if expired
    if status == "expired" and plan['status'] != "expired":
        conn = get_db_connection()
        conn.execute("UPDATE active_plans SET status = 'expired' WHERE pnr = ?", (pnr,))
        conn.commit()
        conn.close()
        
    return {
        "status": status,
        "activation_time": plan['activation_time'],
        "expiry_time": plan['expiry_time']
    }
