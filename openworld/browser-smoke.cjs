/* Real Chromium integration smoke test. Run: node openworld/browser-smoke.cjs */
const {chromium}=require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-web-security"]});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text())});
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction(()=>window.LDOpenWorldRuntime&&document.querySelector("#world canvas"),{timeout:15000});
  await page.waitForFunction(()=>document.querySelector("#info").textContent.includes("Modultests: 9/9"),{timeout:15000});
  await page.waitForTimeout(1000);
  const initial=await page.evaluate(()=>document.querySelector("#info").textContent);
  if(initial.includes("Fehler:"))throw Error(initial);
  await page.keyboard.down("w");await page.waitForTimeout(500);await page.keyboard.up("w");
  await page.locator("#interact").click();
  await page.waitForTimeout(250);
  const status=await page.locator("#info").textContent();
  if(status.includes("Fehler:"))throw Error(status);
  if(errors.length)throw Error("Browser errors: "+errors.join("; "));
  await page.screenshot({path:"openworld-smoke.png",fullPage:true});
  console.log("Chromium Open World: PASS",status.slice(0,350));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
