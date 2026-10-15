import json, subprocess, urllib.request, datetime as dt, calendar, sys
from playwright.sync_api import sync_playwright

RPC="http://127.0.0.1:8545"; SITE="http://localhost:3129"
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
U3="0x90F79bf6EB2c4f870365E785982E1f101E93b906"
def check(label, ok, extra=""):
    results.append((label, ok)); print(("PASS " if ok else "FAIL ")+label, extra)
def admin_page(b, when):
    ctx=b.new_context(viewport={"width":1440,"height":1100}); ctx.add_init_script(PROVIDER % (ADMIN, RPC))
    pg=ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.install(time=dt.datetime.fromisoformat(when+"+00:00")); pg.goto(SITE+"/admin"); pg.wait_for_timeout(6000)
    return pg, errs
with sync_playwright() as p:
    b=p.chromium.launch()
    chain_to("2026-10-15T20:00:00")
    for who,amt,mo in [(USER,100,1),(USER,50,6),(U2,30,12),(U2,20,8),(U3,10,9)]:
        cast("send",POOL,"stake(uint256)",str(mo),"--value",f"{amt}ether","--from",who,"--unlocked")
    r=subprocess.run([CAST,"send",POOL,"stake(uint256)","3","--value","1ether","--from",U3,"--unlocked","--rpc-url",RPC],capture_output=True,text=True)
    check("contract rejects 3-month lock", r.returncode!=0 and "Bad periods" in (r.stderr+r.stdout))
    pg,errs=page_for(b, USER, "2026-10-15T20:00:00")
    pg.get_by_role("tab", name="Stake for").click(); pg.wait_for_timeout(600)
    chips=pg.locator(".chips button").all_inner_texts()
    check("stake form offers 1,2,6,8,9,12", chips==["1 mo","2 mo","6 mo","8 mo","9 mo","12 mo"], str(chips))
    pg.locator('[data-tour="panel"]').screenshot(path=f"{OUT}/CHIPS.png")
    pg.context.close()
    pg,aerr=admin_page(b, "2026-10-15T20:00:00")
    t=pg.locator("main").inner_text()
    check("admin: 3 stakers", "Stakers (wallets)\n3" in t, "")
    check("admin: 5 positions", "Open positions\n5" in t)
    check("admin: total staked 210", "210.00 ReAED" in t)
    check("admin: stakers table lists 3", "STAKERS · 3" in t.upper())
    check("admin: schedule shows 1 Dec, 1 May, 1 Nov 2027 unlocks", "1 Dec 2026" in t and "1 May 2027" in t and "1 Nov 2027" in t)
    pg.screenshot(path=f"{OUT}/ADM2.png", full_page=True)
    # owner switches off 9-month lock
    pg.locator("tr", has_text="9 months").locator("button").click()
    pg.get_by_text("Transaction confirmed").wait_for(timeout=20000)
    out=cast("call",POOL,"isAllowedPeriod(uint256)(bool)","9")
    check("owner toggled 9 months off", out.strip()=="false", out)
    pg.context.close()
    pg,errs2=page_for(b, USER, "2026-10-15T20:00:00")
    pg.get_by_role("tab", name="Stake for").click(); pg.wait_for_timeout(600)
    chips=pg.locator(".chips button").all_inner_texts()
    check("stake form follows contract (no 9 mo)", "9 mo" not in chips and len(chips)==5, str(chips))
    m=b.new_context(viewport={"width":390,"height":844}); m.add_init_script(PROVIDER % (USER,RPC)); mp=m.new_page()
    mp.goto(SITE); mp.wait_for_timeout(3500); mp.get_by_role("tab", name="Stake for").click(); mp.wait_for_timeout(600)
    check("mobile no horizontal scroll", mp.evaluate("document.documentElement.scrollWidth")<=390)
    check("no page errors", not (errs or aerr or errs2), str((errs+aerr+errs2)[:2]))
    b.close()
print(f"\n{sum(ok for _,ok in results)}/{len(results)} checks passed")
