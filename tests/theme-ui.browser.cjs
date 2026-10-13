const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await context.route('https://**',route=>route.abort());
 await context.route('**/auth-google.js',route=>route.fulfill({contentType:'text/javascript',body:'export const db=null;export const auth=null;'}));
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8080/');
 const landing=page.locator('#landing [data-theme-toggle]');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(landing).toHaveAttribute('aria-pressed','false');
 await landing.focus();await page.keyboard.press('Enter');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(landing).toHaveText('Modo claro');await expect(landing).toHaveAttribute('aria-pressed','true');
 assert.equal(await page.evaluate(()=>localStorage.getItem('protocolum.theme.v1')),'dark');await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#101927');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(landing).toHaveText('Modo claro');
 await page.locator('#landingLanguage').click();await expect(landing).toHaveText('Light mode');await page.locator('#landingLanguage').click();
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Landing overflow at '+width);await expect(landing).toBeVisible();}
 await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'/tmp/protocolum-dark-landing.png',fullPage:true});
 const other=await context.newPage();await other.goto('http://127.0.0.1:8080/');await expect(other.locator('html')).toHaveAttribute('data-theme','dark');await landing.click();await expect(other.locator('html')).toHaveAttribute('data-theme','light');await landing.click();await expect(other.locator('html')).toHaveAttribute('data-theme','dark');await other.close();
 await page.evaluate(()=>{localStorage.setItem('clinicalmind.accounts.v1',JSON.stringify({'local@example.com':{email:'local@example.com',name:'Leonardo'}}));sessionStorage.setItem('clinicalmind.session.v1','local@example.com');});await page.reload();
 const app=page.locator('.app-shell-header [data-theme-toggle]');await expect(app).toBeVisible();await expect(app).toHaveAttribute('aria-pressed','true');await app.click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await app.click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'App overflow at '+width);await expect(app).toBeVisible();}
 await page.setViewportSize({width:390,height:844});await page.locator('#sidebarToggle').click();await page.locator('#nav [data-section="Comunidade"]').click();const clinical=page.locator('.case-mobile-header [data-theme-toggle]');await expect(clinical).toBeVisible();await expect(clinical).toHaveAttribute('aria-pressed','true');await clinical.click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await clinical.click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.locator('#caseBack').click();await page.locator('#sidebarToggle').click();await page.locator('#nav [data-section="Perfil"]').click();await expect(page.locator('.profile-page')).toBeVisible();await expect(page.locator('.profile-page-heading h1')).toHaveCSS('color','rgb(237, 244, 255)');await page.waitForTimeout(650);await page.screenshot({path:'/tmp/protocolum-dark-profile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const restricted=await browser.newContext({serviceWorkers:'block'});await restricted.route('https://**',route=>route.abort());await restricted.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='protocolum.theme.v1')throw Error('blocked');return get.call(this,key)};Storage.prototype.setItem=function(key,value){if(key==='protocolum.theme.v1')throw Error('blocked');return set.call(this,key,value)};});const fallback=await restricted.newPage();await fallback.goto('http://127.0.0.1:8080/');await fallback.locator('#landing [data-theme-toggle]').click();await expect(fallback.locator('html')).toHaveAttribute('data-theme','dark');
 await browser.close();console.log('Theme passed: keyboard toggle, reload persistence, language labels, other-tab updates, 320–1440px layouts, mobile clinical control, profile colors and unavailable storage.');
})().catch(error=>{console.error(error);process.exit(1)});
