import json, subprocess, urllib.request, datetime as dt, calendar, sys
from playwright.sync_api import sync_playwright

RPC="http://127.0.0.1:8545"; SITE="http://localhost:3125"
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
def bal(a): return int(rpc("eth_getBalance",[a,"latest"]),16)
def stake_ui(pg, amt, mo):
    pg.get_by_role("tab", name="Stake for").click(); pg.wait_for_timeout(600)
    pg.locator("#amount").fill(str(amt))
    pg.get_by_role("button", name=f"{mo} mo", exact=True).click()
    cb=pg.locator('[data-tour="panel"] input[type=checkbox]')
    if not cb.is_checked(): cb.check()
    pg.get_by_role("button", name="Stake ReAED").click(); wait_success(pg)
    pg.get_by_role("button", name="Done").click(); pg.wait_for_timeout(11000)

with sync_playwright() as p:
    b=p.chromium.launch()
    chain_to("2026-10-15T20:00:00")
    pg,errs=page_for(b, USER, "2026-10-15T20:00:00")
    check("idle banner", "Stake now for Nov 2026" in banner(pg), banner(pg))
    stake_ui(pg, 100, 1)
    stake_ui(pg, 50, 2)
    t=banner(pg); check("queued banner sums 2 positions", "150.00" in t, t)
    out=cast("call",POOL,"positionCount(address)(uint256)",USER)
    check("2 positions on-chain", out.startswith("2"), out)
    pg.get_by_role("tab", name="My stakes").click(); pg.wait_for_timeout(800)
    txt=pg.locator('[data-tour="panel"]').inner_text()
    check("panel lists Position 1 and 2", "POSITION 1" in txt.upper() and "POSITION 2" in txt.upper())
    pg.locator('[data-tour="panel"]').screenshot(path=f"{OUT}/P0_positions.png")
    cast("send",POOL,"stake(uint256)","1","--value","50ether","--from",U2,"--unlocked")
    pg.context.close()

    chain_to("2026-11-20T12:00:00")
    cast("send",DIV,"--value","1000ether","--from","0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","--unlocked")
    pg,errs=page_for(b, USER, "2026-11-20T12:00:00")
    t=banner(pg); check("earning banner, 2 positions", "150.00" in t and "2 positions" in pg.locator('[data-tour="guide"]').inner_text(), t)
    check("share 75%", "75%" in pg.locator("main").inner_text())
    pg.context.close()
    chain_to("2026-11-30T23:00:00")
    cast("send",DIV,"sendRewardsToStaking(uint256)","1000ether","--from","0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","--unlocked")

    chain_to("2026-12-03T09:00:00")
    pg,errs=page_for(b, USER, "2026-12-03T09:00:00")
    t=banner(pg); check("grace banner for 1-month position (100 + 500)", "100.00" in t and "500.00" in t and "31 Dec 2026" in t, t)
    pg.locator('[data-tour="guide"] button').click(); pg.wait_for_timeout(900)
    pg.locator('[data-tour="panel"]').screenshot(path=f"{OUT}/P1_grace.png")
    b0=bal(USER)
    pg.locator('[data-tour="panel"] .tile.pos button.btn-b').first.click(); wait_success(pg)
    g=(bal(USER)-b0)/1e18; check("withdraw position 1: +600", 599.99<g<600.01, f"{g:.4f}")
    pg.get_by_role("button", name="Done").click(); pg.wait_for_timeout(11000)
    t=banner(pg); check("claim banner for position 2 (250)", "250.00" in t, t)
    pg.locator('[data-tour="guide"] button').click(); pg.wait_for_timeout(800)
    b0=bal(USER)
    pg.locator('[data-tour="panel"]').get_by_role("button", name="Claim rewards").click(); wait_success(pg)
    g=(bal(USER)-b0)/1e18; check("claim +250", 249.99<g<250.01, f"{g:.4f}")
    pg.context.close()

    chain_to("2026-12-31T22:00:00")
    cast("send",DIV,"--value","500ether","--from","0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","--unlocked")
    cast("send",DIV,"sendRewardsToStaking(uint256)","500ether","--from","0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","--unlocked")

    chain_to("2027-01-03T10:00:00")
    pg,errs=page_for(b, USER, "2027-01-03T10:00:00")
    t=banner(pg); check("grace banner position 2 (50 + 500)", "50.00" in t and "500.00" in t, t)
    pg.locator('[data-tour="guide"] button').click(); pg.wait_for_timeout(900)
    b0=bal(USER)
    pg.locator('[data-tour="panel"] .tile.pos button.btn-b').first.click(); wait_success(pg)
    g=(bal(USER)-b0)/1e18; check("withdraw position 2: +550", 549.99<g<550.01, f"{g:.4f}")
    pg.get_by_role("button", name="Done").click(); pg.wait_for_timeout(11000)
    t=banner(pg); check("back to idle → Feb", "Stake now for Feb 2027" in t, t)
    pg.context.close()

    pg,errs2=page_for(b, U2, "2027-01-03T10:00:00")
    t=banner(pg); check("U2 grace over → principal only", "50.00" in t and "principal" in t, t)
    pg.locator('[data-tour="guide"] button').click(); pg.wait_for_timeout(800)
    b0=bal(U2)
    pg.locator('[data-tour="panel"] .tile.pos button.btn-b').first.click(); wait_success(pg)
    g=(bal(U2)-b0)/1e18; check("U2 +50 only", 49.99<g<50.01, f"{g:.4f}")
    a0=bal("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
    cast("send",POOL,"sweepExpired(uint256)",str(2026*12+10),"--from",U2,"--unlocked")
    sw=(bal("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")-a0)/1e18
    check("U2 Nov share (250) swept to admin", 249.99<sw<250.01, f"{sw:.4f}")
    check("no page errors", not (errs or errs2), str((errs+errs2)[:2]))
    b.close()
print(f"\n{sum(ok for _,ok in results)}/{len(results)} checks passed")
