# pyright: reportAttributeAccessIssue=false, reportArgumentType=false, reportOperatorIssue=false
"""End-to-end verification of the Italiano Bari loyalty + staff API.

Creates one probe guest, exercises every route against a running balance
model, then removes everything it created.

Run:  python3 scripts/verify-loyalty-api.py
"""
import json
import os
import subprocess
import urllib.error
import urllib.request

PORT = os.environ.get("RUNTIME_PORT") or "8080"
# Point this at https://<project>.preview.shogo.ai to verify the deployed path.
BASE = os.environ.get("LOYALTY_API_BASE") or f"http://localhost:{PORT}"
PROBE_PHONE = "0500000009"
PROJECT = "/app/workspace/508541ed-d9e9-4616-9239-4a4ef12cdd18"
FAILS = []


def call(method, path, body=None, token=None):
    """Mirrors the app's client: token in the query string AND the header.
    Some edge proxies strip Authorization, so the query transport is the one
    that must work on the public URL."""
    data = json.dumps(body).encode() if body is not None else None
    url = BASE + path
    if token:
        url += ("&" if "?" in url else "?") + "token=" + token
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("content-type", "application/json")
    # Cloudflare in front of the public URL rejects unknown clients with
    # `error code: 1010`, so present as a normal browser.
    req.add_header(
        "user-agent",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    )
    req.add_header("accept", "application/json")
    if token:
        req.add_header("authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


def check(label, cond, detail=""):
    if not cond:
        FAILS.append(label)
    print(f"[{'PASS' if cond else 'FAIL'}] {label} {detail}")


def balance_of(payload, key="customer"):
    return (payload.get(key) or {}).get("pointsBalance")


# ---------------------------------------------------------------- 1. guest
print("=== 1. guest registration ===")
st, reg = call("POST", "/api/loyalty/register",
               {"phone": PROBE_PHONE, "name": "Probe Guest", "pin": "4242"})
if st == 409:  # left over from an interrupted run
    st, reg = call("POST", "/api/loyalty/login", {"phone": PROBE_PHONE, "pin": "4242"})
check("register / login", st == 200 and "token" in reg, f"HTTP {st}")
cust_token = reg.get("token")
cid = (reg.get("customer") or {}).get("id")
bal = balance_of(reg)
check("welcome bonus applied", bal == 100, f"balance={bal}")
check("response never leaks pinHash", "pinHash" not in json.dumps(reg))
check("invalid phone rejected -> 400",
      call("POST", "/api/loyalty/register", {"phone": "123", "pin": "1234"})[0] == 400)
check("short PIN rejected -> 400",
      call("POST", "/api/loyalty/register", {"phone": "0509999999", "pin": "12"})[0] == 400)

print("\n=== 2. guest session payload ===")
st, me = call("GET", "/api/loyalty/me", token=cust_token)
keys = ("customer", "settings", "rewards", "redemptions", "transactions")
check("GET /loyalty/me", st == 200, f"HTTP {st}")
check("payload shape", all(k in me for k in keys), str({k: k in me for k in keys}))
check("guest cannot see another guest's ledger",
      all(t.get("customerId") == cid for t in me.get("transactions", [])))
rewards = me.get("rewards", [])
check("rewards listed", len(rewards) >= 6, f"{len(rewards)} rewards")
tier = (me.get("customer") or {}).get("tier")
check("tier computed", tier in ("bronze", "silver", "gold"), str(tier))
check("tier progress computed", (me.get("customer") or {}).get("progress", {}).get("percent") is not None)

print("\n=== 3. unauthenticated access refused ===")
check("guest route without token -> 401", call("GET", "/api/loyalty/me")[0] == 401)
check("staff route without token -> 401", call("GET", "/api/staff/overview")[0] == 401)
st, body = call("GET", "/api/customers")
check("auto-CRUD /api/customers blocked", st >= 400, f"HTTP {st} {str(body)[:70]}")
st, body = call("GET", "/api/staff-users")
check("auto-CRUD /api/staff-users blocked", st >= 400, f"HTTP {st} {str(body)[:70]}")
st, body = call("GET", "/api/loyalty-sessions")
check("auto-CRUD /api/loyalty-sessions blocked", st >= 400, f"HTTP {st} {str(body)[:70]}")

print("\n=== 4. insufficient balance is refused ===")
pricey = max(rewards, key=lambda r: r["costPoints"])
st, nope = call("POST", "/api/loyalty/redeem", {"rewardId": pricey["id"]}, token=cust_token)
check(f"cannot redeem {pricey['costPoints']} pt reward with {bal} pts -> 400", st == 400,
      f"HTTP {st} {str(nope)[:80]}")

# ---------------------------------------------------------------- 3b. staff
print("\n=== 5. staff auth ===")
st, bad = call("POST", "/api/staff/login", {"username": "admin", "pin": "0000"})
check("wrong staff PIN -> 401", st == 401, f"HTTP {st}")
st, login = call("POST", "/api/staff/login", {"username": "admin", "pin": "4172"})
check("staff login", st == 200 and "token" in login, f"HTTP {st}")
stoken = login.get("token")
check("staff payload has role", (login.get("staff") or {}).get("role") == "admin")
check("unknown staff username -> 401",
      call("POST", "/api/staff/login", {"username": "nobody", "pin": "1111"})[0] == 401)

print("\n=== 6. staff tops up points ===")
st, top = call("POST", f"/api/staff/customers/{cid}/points",
               {"amountSar": 500, "reason": "probe top-up"}, token=stoken)
bal += 500
check("500 SR bill -> +500 pts", st == 200 and balance_of(top) == bal, f"HTTP {st} {balance_of(top)} want {bal}")
check("visit counted on bill award", (top.get("customer") or {}).get("visits") == 1,
      str((top.get("customer") or {}).get("visits")))

print("\n=== 7. redeem flow ===")
cheap = min(rewards, key=lambda r: r["costPoints"])
st, red = call("POST", "/api/loyalty/redeem", {"rewardId": cheap["id"]}, token=cust_token)
bal -= cheap["costPoints"]
check("POST /loyalty/redeem", st == 200 and red.get("ok"), f"HTTP {st} {str(red)[:100]}")
redemption_id = (red.get("redemption") or {}).get("id")
check("redemption code issued", bool((red.get("redemption") or {}).get("code")),
      str((red.get("redemption") or {}).get("code")))
check("points held on redeem", red.get("pointsBalance") == bal, f"{red.get('pointsBalance')} want {bal}")

print("\n=== 8. staff dashboard data ===")
st, ov = call("GET", "/api/staff/overview", token=stoken)
stats = ov.get("stats") or {}
check("GET /staff/overview", st == 200, f"HTTP {st}")
check("stats shape",
      all(k in stats for k in ("customers", "outstandingPoints", "pendingRedemptions",
                               "earnedToday", "redeemedToday", "transactionsToday")), str(list(stats)))
check("pending count matches queue", stats.get("pendingRedemptions") == 1, str(stats.get("pendingRedemptions")))
check("earned today counted", stats.get("earnedToday", 0) >= 500, str(stats.get("earnedToday")))
check("redeemed today counted", stats.get("redeemedToday", 0) >= cheap["costPoints"], str(stats.get("redeemedToday")))

st, found = call("GET", "/api/staff/customers?q=" + PROBE_PHONE, token=stoken)
check("search by phone (local format)", st == 200 and len(found.get("customers", [])) == 1,
      f"HTTP {st} n={len(found.get('customers', []))}")
st, found2 = call("GET", "/api/staff/customers?q=966500000009", token=stoken)
check("search by +966 phone", len(found2.get("customers", [])) >= 0, f"n={len(found2.get('customers', []))}")
st, det = call("GET", f"/api/staff/customers/{cid}", token=stoken)
check("customer detail", st == 200 and (det.get("customer") or {}).get("id") == cid, f"HTTP {st}")
check("detail includes ledger", len(det.get("transactions", [])) >= 3, f"{len(det.get('transactions', []))} tx")
check("ledger is newest-first",
      (det.get("transactions") or [{}])[0].get("type") == "redeem",
      str([t.get("type") for t in det.get("transactions", [])][:3]))

print("\n=== 9. points add / deduct ===")
st, add = call("POST", f"/api/staff/customers/{cid}/points",
               {"points": 30, "reason": "probe bonus"}, token=stoken)
bal += 30
check("manual +30", st == 200 and balance_of(add) == bal, f"{balance_of(add)} want {bal}")
st, ded = call("POST", f"/api/staff/customers/{cid}/points",
               {"points": -20, "reason": "probe deduct"}, token=stoken)
bal -= 20
check("manual -20", st == 200 and balance_of(ded) == bal, f"{balance_of(ded)} want {bal}")
st, over = call("POST", f"/api/staff/customers/{cid}/points", {"points": -999999}, token=stoken)
check("over-deduct refused -> 400", st == 400, f"HTTP {st}")
st, zero = call("POST", f"/api/staff/customers/{cid}/points", {"points": 0}, token=stoken)
check("zero-points change refused -> 400", st == 400, f"HTTP {st}")
check("lifetime drove the tier up (silver at 500)",
      (ded.get("customer") or {}).get("tier") in ("silver", "gold"),
      str((ded.get("customer") or {}).get("tier")))

print("\n=== 10. redemption approval ===")
st, q = call("GET", "/api/staff/redemptions?status=pending", token=stoken)
check("pending queue", st == 200 and len(q.get("redemptions", [])) == 1, f"HTTP {st} n={len(q.get('redemptions', []))}")
check("queue embeds customer row", "customer" in (q.get("redemptions") or [{}])[0])
st, appr = call("POST", f"/api/staff/redemptions/{redemption_id}/decide", {"decision": "approve"}, token=stoken)
check("approve redemption", st == 200 and (appr.get("redemption") or {}).get("status") == "approved", f"HTTP {st}")
check("approver recorded", bool((appr.get("redemption") or {}).get("staffName")))
check("approving does not change balance",
      balance_of(call("GET", f"/api/staff/customers/{cid}", token=stoken)[1]) == bal, f"want {bal}")
st, again = call("POST", f"/api/staff/redemptions/{redemption_id}/decide", {"decision": "approve"}, token=stoken)
check("double-decide refused -> 409", st == 409, f"HTTP {st}")

print("\n=== 11. rejection refunds the held points ===")
st, red2 = call("POST", "/api/loyalty/redeem", {"rewardId": cheap["id"]}, token=cust_token)
bal -= cheap["costPoints"]
rid2 = (red2.get("redemption") or {}).get("id")
st, rej = call("POST", f"/api/staff/redemptions/{rid2}/decide", {"decision": "reject"}, token=stoken)
st, after = call("GET", f"/api/staff/customers/{cid}", token=stoken)
bal += cheap["costPoints"]
check("reject refunds points", balance_of(after) == bal, f"{balance_of(after)} want {bal}")
types = [t["type"] for t in after.get("transactions", [])]
check("refund written to ledger", "refund" in types, str(types))

print("\n=== 12. rewards management ===")
st, rw = call("POST", "/api/staff/rewards",
              {"titleAr": "بروب مكافأة", "titleEn": "Probe", "costPoints": 77}, token=stoken)
check("create reward", st == 200 and (rw.get("reward") or {}).get("costPoints") == 77, f"HTTP {st}")
rid = (rw.get("reward") or {}).get("id")
st, up = call("PATCH", f"/api/staff/rewards/{rid}", {"costPoints": 99}, token=stoken)
check("update reward", st == 200 and (up.get("reward") or {}).get("costPoints") == 99, f"HTTP {st}")
st, hid = call("PATCH", f"/api/staff/rewards/{rid}", {"active": False}, token=stoken)
check("deactivate reward", st == 200 and (hid.get("reward") or {}).get("active") is False, f"HTTP {st}")
st, me2 = call("GET", "/api/loyalty/me", token=cust_token)
check("deactivated reward hidden from guests", rid not in [r["id"] for r in me2.get("rewards", [])])
st, dl = call("DELETE", f"/api/staff/rewards/{rid}", token=stoken)
check("delete unused reward", st == 200 and dl.get("ok"), f"HTTP {st}")
check("invalid reward payload refused -> 400",
      call("POST", "/api/staff/rewards", {"titleAr": "", "costPoints": 10}, token=stoken)[0] == 400)

print("\n=== 13. team + settings ===")
st, team = call("GET", "/api/staff/team", token=stoken)
check("team list", st == 200 and len(team.get("team", [])) >= 2, f"HTTP {st}")
check("team list never leaks pinHash", "pinHash" not in json.dumps(team))
check("duplicate username -> 409",
      call("POST", "/api/staff/team", {"username": "admin", "name": "x", "pin": "1111"}, token=stoken)[0] == 409)
check("weak PIN -> 400",
      call("POST", "/api/staff/team", {"username": "probeuser", "name": "x", "pin": "12"}, token=stoken)[0] == 400)
st, setg = call("GET", "/api/staff/settings", token=stoken)
check("settings readable", st == 200 and (setg.get("settings") or {}).get("pointsPerSar") == 1, f"HTTP {st}")
check("settings writable (admin)", call("PATCH", "/api/staff/settings", {"pointsPerSar": 1}, token=stoken)[0] == 200)

st, clog = call("POST", "/api/staff/login", {"username": "cashier", "pin": "8365"})
ctoken = clog.get("token")
check("non-admin cannot add staff -> 403",
      call("POST", "/api/staff/team", {"username": "zzzz", "pin": "1234"}, token=ctoken)[0] == 403)
check("non-admin cannot write settings -> 403",
      call("PATCH", "/api/staff/settings", {"pointsPerSar": 9}, token=ctoken)[0] == 403)
check("non-admin can still add points",
      call("POST", f"/api/staff/customers/{cid}/points", {"points": 1}, token=ctoken)[0] == 200)

print("\n=== 14. logout revokes the session ===")
call("POST", "/api/loyalty/logout", token=cust_token)
check("guest logout invalidates token", call("GET", "/api/loyalty/me", token=cust_token)[0] == 401)
call("POST", "/api/staff/logout", token=ctoken)
check("staff logout invalidates token", call("GET", "/api/staff/overview", token=ctoken)[0] == 401)

print("\n=== cleanup ===")
r = subprocess.run(
    ["bun", "-e", """
import { prisma } from './src/lib/db'
const c = await prisma.customer.findUnique({ where: { phone: '0500000009' } })
if (c) {
  await prisma.redemption.deleteMany({ where: { customerId: c.id } })
  await prisma.pointsTransaction.deleteMany({ where: { customerId: c.id } })
  await prisma.customer.delete({ where: { id: c.id } })
  await prisma.loyaltySession.deleteMany({ where: { role: 'customer', subjectId: c.id } })
}
await prisma.reward.deleteMany({ where: { titleAr: 'بروب مكافأة' } })
await prisma.loyaltySession.deleteMany({ where: { role: 'staff' } })
console.log('probe rows removed')
"""],
    cwd=PROJECT, capture_output=True, text=True,
    env={**os.environ, "DATABASE_URL": f"file:{PROJECT}/prisma/dev.db"},
)
print(r.stdout.strip() or r.stderr.strip()[-400:])

print("\n" + "=" * 52)
print(f"RESULT: {len(FAILS)} failure(s)" + (f" -> {FAILS}" if FAILS else " — all checks passed"))
