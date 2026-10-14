const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const xml=require('./pubmed-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({serviceWorkers:'block'}),requests=[];
 await context.addInitScript(()=>{localStorage.setItem('clinicalmind.accounts.v1',JSON.stringify({'local@example.com':{name:'Local',email:'local@example.com'}}));sessionStorage.setItem('clinicalmind.session.v1','local@example.com');});
 await context.route('https://**',route=>route.abort());await context.route('**/auth-google.js',route=>route.fulfill({contentType:'text/javascript',body:'export const db=null;export const auth=null;'}));
 await context.route('https://eutils.ncbi.nlm.nih.gov/**',route=>route.fulfill({contentType:route.request().url().includes('esearch')?'application/json':'application/xml',body:route.request().url().includes('esearch')?JSON.stringify({esearchresult:{idlist:['123']}}):xml([{pmid:'123',guideline:true,title:'Lazy loaded reference',abstract:'Summary from the original publication'}])}));
 let releaseProfile,failFlow=true;
 await context.route('**/profile-ui.js',async route=>{await new Promise(resolve=>releaseProfile=resolve);await route.continue();});
 await context.route('**/hf-decision-flow.js',route=>{if(failFlow){failFlow=false;return route.fulfill({status:503,body:'Unavailable'});}return route.continue();});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(new URL(r.url()).pathname));
 await page.goto('http://127.0.0.1:8080/');await expect(page.locator('.item[data-title]')).toHaveCount(1);
 for(const name of ['profile-ui.js','profile-academic.js','friends-network.js','community-case-forum.js','guideline-comparison.js','hf-decision-flow.js','pubmed-lab.js','reader-architecture.js','cloud-sync.js'])assert.ok(!requests.includes('/'+name),'Unopened tool loaded: '+name);
 async function go(route){await page.locator('#sidebarToggle').click();await page.locator(`#nav [data-section="${route}"]`).click();}
 await go('Perfil');await expect(page.locator('#recommendations')).toContainText('Carregando');await expect.poll(()=>Boolean(releaseProfile)).toBe(true);
 await go('Diretrizes');releaseProfile();await expect.poll(()=>page.evaluate(()=>typeof window.renderProfilePage)).toBe('function');await expect(page.locator('.profile-page')).toHaveCount(0);await expect(page.locator('.item[data-title]')).toHaveCount(1);
 await go('Perfil');await expect(page.locator('.profile-page')).toBeVisible();assert.equal(requests.filter(path=>path==='/profile-ui.js').length,1);
 await go('Comparador');await expect(page.locator('.gcomp')).toBeVisible();await go('Comunidade');await expect(page.locator('.case-forum')).toBeVisible();
 await go('Fluxogramas');await expect(page.locator('.feature-load-notice')).toContainText('Não foi possível');await page.locator('.feature-load-notice button').click();await expect(page.locator('.hf-flow')).toBeVisible();
 await go('Laboratório PubMed');await expect(page.locator('.pml-wrap')).toBeVisible();await go('Diretrizes');await page.locator('.item[data-title]').first().click();await expect(page.locator('.reader-architecture')).toBeVisible();await expect(page.locator('#readerSummary')).toContainText('Summary');
 assert.deepEqual(errors,[]);await browser.close();console.log('Feature loading passed: unopened modules deferred, one import per tool, stale navigation ignored, failed first load recovered by reload, and first reader opening initialized. PubMed simulated.');
})().catch(e=>{console.error(e);process.exit(1)});
