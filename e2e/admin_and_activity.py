import json, subprocess, urllib.request, datetime as dt, calendar, sys
from playwright.sync_api import sync_playwright

RPC="http://127.0.0.1:8545"; SITE="http://localhost:3126"
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
ADMIN="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
def check(label, ok, extra=""):
    results.append((label, ok)); print(("PASS " if ok else "FAIL ")+label, extra)
def bal(a): return int(rpc("eth_getBalance",[a,"latest"]),16)
def admin_page(b, when):
    ctx=b.new_context(viewport={"width":1440,"height":1100}); ctx.add_init_script(PROVIDER % (ADMIN, RPC))
    pg=ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.install(time=dt.datetime.fromisoformat(when+"+00:00")); pg.goto(SITE+"/admin"); pg.wait_for_timeout(5000)
    return pg, errs
def wait_tx(pg):
    pg.get_by_text("Transaction confirmed").wait_for(timeout=20000); pg.wait_for_timeout(1500)

with sync_playwright() as p:
    b=p.chromium.launch()
    chain_to("2026-10-15T20:00:00")
    pg,errs=page_for(b, USER, "2026-10-15T20:00:00")
    pg.get_by_role("tab", name="Stake for").click(); pg.wait_for_timeout(500)
    pg.get_by_role("button", name="Max").click(); pg.wait_for_timeout(300)
    v=pg.locator("#amount").input_value(); check("Max leaves 0.01 for gas", v.startswith("9999.99"), v)
    pg.context.close()
    cast("send",POOL,"stake(uint256)","1","--value","100ether","--from",USER,"--unlocked")
    cast("send",POOL,"stake(uint256)","1","--value","50ether","--from",U2,"--unlocked")

    chain_to("2026-11-20T12:00:00")
    cast("send",DIV,"--value","1000ether","--from",ADMIN,"--unlocked")
    pg,aerr=admin_page(b, "2026-11-20T12:00:00")
    t=pg.locator("main").inner_text()
    check("admin: owner recognised", "CONNECTED AS STAKING OWNER" in t.upper())
    check("admin: dividend pool linked", "LINKED" in t.upper())
    check("admin: dividend balance 1,000", "1,000.00" in t)
    pg.screenshot(path=f"{OUT}/ADM0.png", full_page=True)
    pg.get_by_role("button", name="All", exact=True).click()
    pg.get_by_role("button", name="Send to staking").click(); wait_tx(pg)
    out=cast("call",POOL,"epochReward(uint256)(uint256)",str(2026*12+10))
    check("admin: 1,000 credited to Nov", out.startswith("1000000000000000000000"), out)
    pg.context.close()

    chain_to("2027-01-05T10:00:00")
    pg,aerr2=admin_page(b, "2027-01-05T10:00:00")
    t=pg.locator("main").inner_text()
    check("admin: Nov sweepable 1,000", "Sweep 1,000.00" in t)
    check("admin: 2 abandoned wallets found", "Release all (2 wallets)" in t, "")
    pg.screenshot(path=f"{OUT}/ADM1.png", full_page=True)
    a0=bal(ADMIN)
    pg.get_by_role("button", name="Sweep 1,000.00").click(); wait_tx(pg)
    gain=(bal(ADMIN)-a0)/1e18; check("admin: swept ~1,000 to admin wallet", 999.9<gain<1000.01, f"{gain:.4f}")
    pg.get_by_role("button", name="Dismiss").click(); pg.wait_for_timeout(300)
    u0=bal(USER); v0=bal(U2)
    pg.get_by_role("button", name="Release all (2 wallets)").click(); wait_tx(pg)
    check("admin: release returned principal", abs((bal(USER)-u0)/1e18-100)<0.001 and abs((bal(U2)-v0)/1e18-50)<0.001)
    pg.context.close()

    pg,errs=page_for(b, USER, "2027-01-05T10:00:00")
    pg.get_by_role("tab", name="My stakes").click(); pg.wait_for_timeout(4000)
    act=pg.locator('[data-tour="panel"]').inner_text()
    check("activity: staked, withdrawn, forfeited", "Staked" in act and "Principal withdrawn" in act and "Rewards forfeited" in act, act[:300].replace("\n"," | "))
    pg.locator('[data-tour="panel"]').screenshot(path=f"{OUT}/ACT.png")
    check("no page errors", not (errs or aerr or aerr2), str((errs+aerr+aerr2)[:2]))
    b.close()
print(f"\n{sum(ok for _,ok in results)}/{len(results)} checks passed")
