import json, subprocess, urllib.request, datetime as dt, calendar, sys
from playwright.sync_api import sync_playwright

RPC="http://127.0.0.1:8545"; SITE="http://localhost:3120"
CAST="cast"  # Foundry cast on PATH
OUT="e2e/screens"
POOL="0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"; DIV="0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
ADMIN_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
USER="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
U2="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; U2_KEY="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804e5f4365a"

def rpc(m,p=[]):
    r=urllib.request.urlopen(urllib.request.Request(RPC,json.dumps({"jsonrpc":"2.0","id":1,"method":m,"params":p}).encode(),{"content-type":"application/json"}))
    j=json.loads(r.read()); assert "error" not in j, j; return j["result"]
def ts(s): return calendar.timegm(dt.datetime.fromisoformat(s).timetuple())
def chain_to(s):
    rpc("evm_setNextBlockTimestamp",[ts(s)]); rpc("evm_mine")
def cast(*a):
    r=subprocess.run([CAST,*a,"--rpc-url",RPC],capture_output=True,text=True); assert r.returncode==0, r.stderr; return r.stdout.strip()
def call(sig,*args): return cast("call",POOL,sig,*args)

PROVIDER="""
(() => { const ACC='%s'; window.ethereum = { isRabby:true,
  async request({method, params}) {
    if (method==='eth_requestAccounts'||method==='eth_accounts') return [ACC];
    if (method==='eth_chainId') return '0x3bdc';
    if (method==='net_version') return '15324';
    if (method.startsWith('wallet_')) return method==='wallet_getPermissions'||method==='wallet_requestPermissions' ? [{parentCapability:'eth_accounts'}] : null;
    const r = await fetch('%s',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
    const j = await r.json(); if (j.error) throw j.error; return j.result; },
  on(){}, removeListener(){} };
 try { localStorage.setItem('infra-staking-tour-v1','1') } catch(e) {}
})();"""

def page_for(b, acc, when):
    ctx=b.new_context(viewport={"width":1440,"height":1000})
    ctx.add_init_script(PROVIDER % (acc, RPC))
    pg=ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.install(time=dt.datetime.fromisoformat(when+"+00:00"))
    pg.goto(SITE); pg.wait_for_timeout(2500)
    if pg.get_by_role("button", name="Connect").count():
        pg.get_by_role("button", name="Connect").first.click(); pg.wait_for_timeout(700)
        pg.get_by_text("INFRA Wallet").first.click()
    pg.wait_for_timeout(3500)
    return pg, errs

def banner(pg): return pg.locator('[data-tour="guide"] h2').inner_text()
def shot(pg, name): pg.locator('main').screenshot(path=f"{OUT}/{name}.png")
def wait_success(pg):
    pg.locator(".succ").wait_for(timeout=20000); pg.wait_for_timeout(1200)

results=[]
def check(label, ok, extra=""):
    results.append((label, ok)); print(("PASS " if ok else "FAIL ")+label, extra)

with sync_playwright() as p:
    b=p.chromium.launch()
    # ---- A: October — new user stakes 100 for 2 months
    chain_to("2026-10-15T20:00:00")
    pg,errs=page_for(b, USER, "2026-10-15T20:00:00")
    check("idle banner", "Stake now for Nov 2026" in banner(pg), banner(pg))
    shot(pg,"A0_idle")
    pg.locator("#amount").fill("100")
    pg.get_by_role("button", name="2 mo", exact=True).click()
    check("stake summary shows earning months", "Nov 2026 → Dec 2026" in pg.locator('[data-tour="panel"]').inner_text())
    pg.locator('[data-tour="panel"] input[type=checkbox]').check()
    pg.get_by_role("button", name="Stake ReAED").click(); wait_success(pg)
    pg.screenshot(path=f"{OUT}/A1_stake_success.png")
    pg.get_by_role("button", name="Done").click(); pg.wait_for_timeout(11000)
    check("queued banner", "starts earning on 1 Nov 2026" in banner(pg), banner(pg))
    check("on-chain stake", call("users(address)(uint256,uint64,uint64,uint64,uint64,uint64,uint256,uint256)",USER).split("\n")[0].startswith("100000000000000000000"))
    # second staker via cast: 50 for 1 month
    cast("send",POOL,"stake(uint256)","1","--value","50ether","--from",U2,"--unlocked")
    pg.context.close()

    # ---- B: November 20 — earning; 1,000 sitting in dividend pool
    chain_to("2026-11-20T12:00:00")
    cast("send",DIV,"--value","1000ether","--from","0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","--unlocked")
    pg,errs=page_for(b, USER, "2026-11-20T12:00:00")
    t=banner(pg); check("earning banner", "earning in the Nov 2026 cycle" in t, t)
    body=pg.locator("main").inner_text()
    check("share 66.67%", "66.67%" in body)
    check("dividend pool 1,000 shown", "1,000.00" in body)
    shot(pg,"B_earning")
    pg.context.close()

    # admin sends month-end rewards before midnight UTC
    chain_to("2026-11-30T23:00:00")
    cast("send",DIV,"sendRewardsToStaking(uint256)","1000ether","--from","0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","--unlocked")

    # ---- C: December 3 — claim November rewards
    chain_to("2026-12-03T09:00:00")
    pg,errs=page_for(b, USER, "2026-12-03T09:00:00")
    t=banner(pg); check("claim banner 666.67", "666.67" in t and "31 Dec 2026" in t, t)
    shot(pg,"C0_claim")
    pg.locator('[data-tour="guide"] button').click(); pg.wait_for_timeout(800)
    bal0=int(rpc("eth_getBalance",[USER,"latest"]),16)
    pg.locator('[data-tour="panel"]').get_by_role("button", name="Claim rewards").click(); wait_success(pg)
    pg.screenshot(path=f"{OUT}/C1_claim_success.png")
    gained=(int(rpc("eth_getBalance",[USER,"latest"]),16)-bal0)/1e18
    check("wallet +~666.66", 666.6 < gained < 666.7, f"{gained:.4f}")
    pg.context.close()

    # December rewards 500 (only USER earns in Dec)
    chain_to("2026-12-31T22:00:00")
    cast("send",DIV,"--value","500ether","--from","0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","--unlocked")
    cast("send",DIV,"sendRewardsToStaking(uint256)","500ether","--from","0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","--unlocked")

    # ---- D: January 3 — lock ended, grace: withdraw principal + rewards
    chain_to("2027-01-03T10:00:00")
    pg,errs=page_for(b, USER, "2027-01-03T10:00:00")
    t=banner(pg); check("grace banner 100 + 500", "100.00" in t and "500.00" in t and "2 Feb 2027" in t, t)
    pg.locator('[data-tour="guide"] button').click(); pg.wait_for_timeout(800)
    shot(pg,"D0_grace")
    bal0=int(rpc("eth_getBalance",[USER,"latest"]),16)
    pg.locator('[data-tour="panel"] button.btn-b').click(); wait_success(pg)
    pg.screenshot(path=f"{OUT}/D1_withdraw_success.png")
    gained=(int(rpc("eth_getBalance",[USER,"latest"]),16)-bal0)/1e18
    check("wallet +~600 (principal + Dec)", 599.9 < gained < 600.01, f"{gained:.4f}")
    pg.get_by_role("button", name="Done").click(); pg.wait_for_timeout(11000)
    t=banner(pg); check("back to idle → stake for Feb", "Stake now for Feb 2027" in t, t)
    pg.locator('[data-tour="cycles"]').screenshot(path=f"{OUT}/D2_history.png")
    hist=pg.locator("table.cyc").inner_text()
    check("history shows Nov pool 1,000 and Dec 500", "1,000.00" in hist and "500.00" in hist)
    pg.context.close()

    # ---- E: second user after grace (lock ended Dec 1, grace to Dec 31): principal only
    pg,errs2=page_for(b, U2, "2027-01-03T10:00:00")
    t=banner(pg); check("graceOver banner for U2", "Withdraw your 50.00 ReAED principal" in t, t)
    pg.locator('[data-tour="guide"] button').click(); pg.wait_for_timeout(800)
    shot(pg,"E0_grace_over")
    bal0=int(rpc("eth_getBalance",[U2,"latest"]),16)
    pg.locator('[data-tour="panel"] button.btn-b').click(); wait_success(pg)
    gained=(int(rpc("eth_getBalance",[U2,"latest"]),16)-bal0)/1e18
    check("U2 gets principal only (~50)", 49.99 < gained < 50.01, f"{gained:.4f}")
    # admin sweeps November leftovers (U2's 333.33) to admin wallet
    admin0=int(rpc("eth_getBalance",["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","latest"]),16)
    cast("send",POOL,"sweepExpired(uint256)",str(2026*12+10),"--from",U2,"--unlocked")
    swept=(int(rpc("eth_getBalance",["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","latest"]),16)-admin0)/1e18
    check("expired Nov share swept to admin (~333.33)", 333.3 < swept < 333.4, f"{swept:.4f}")
    check("no page errors", not (errs or errs2), str((errs+errs2)[:2]))
    b.close()

print(f"\n{sum(ok for _,ok in results)}/{len(results)} checks passed")
