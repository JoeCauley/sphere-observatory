'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { session, executable } = require('./support/biome-browser.cjs');

(async () => {
  const host = await session(), browser = await chromium.launch({ executablePath:executable(), headless:true });
  try {
    const context = await browser.newContext({viewport:{width:1180,height:760}});
    await host.attach(context);
    const page = await context.newPage(), errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    page.setDefaultTimeout(240000);
    await page.goto(host.origin,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SphereLoading?.ready);
    await page.locator('[data-tab=camera]').click();
    await page.locator('[data-category=biomes]').click();
    await page.selectOption('#placeDestination','biome-9');
    await page.selectOption('#placeAltitude','ground');
    // Observe the card from inside the destination resolver, after a paint opportunity.
    await page.evaluate(()=>{
      const real=SpherePlaces.destination;
      SpherePlaces.destination=async (...args)=>{
        const c=document.querySelector('#travelCurtain'), rect=c.getBoundingClientRect(), view=document.querySelector('#view').getBoundingClientRect();
        window.cardAtWork={shown:!c.hidden,title:c.querySelector('h2').textContent,coversView:Math.abs(rect.width-view.width)<2};
        await new Promise(resolve=>{window.allowTerrain=resolve;});
        SpherePlaces.destination=real;return real(...args);
      };
    });
    await page.locator('#visitPlace').click();
    await page.waitForFunction(()=>window.allowTerrain);
    const observed=await page.evaluate(()=>cardAtWork);
    assert(observed.shown&&observed.coversView);assert.match(observed.title,/Violet/i);
    if(process.env.SPHERE_TRANSIT_PHOTO)await page.screenshot({path:process.env.SPHERE_TRANSIT_PHOTO,type:'jpeg',quality:86});
    await page.locator('#travelCurtain').getByRole('button',{name:'Cancel trip'}).click();
    await page.evaluate(()=>allowTerrain());
    await page.waitForFunction(()=>SphereJourney.travel.status.state==='cancelled' && document.querySelector('#travelCurtain').hidden);
    await page.locator('#retryTravel').click();
    await page.waitForFunction(()=>SphereJourney.travel.status.state==='arrived' && document.querySelector('#travelCurtain').hidden);
    assert.equal(await page.evaluate(()=>SphereApp.getState().siteId),'biome-9');
    await page.evaluate(()=>{const real=SpherePlaces.destination;SpherePlaces.destination=async (...args)=>{SpherePlaces.destination=real;throw Error('No terrain for this test');};});
    await page.locator('#visitPlace').click();
    await page.locator('#travelCurtain').getByText('No terrain for this test').waitFor();
    await page.locator('#travelCurtain').getByRole('button',{name:'Retry'}).click();
    await page.waitForFunction(()=>SphereJourney.travel.status.state==='arrived' && document.querySelector('#travelCurtain').hidden);
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>SphereApp.renderer.gl.getError()),0);
    console.log('PASS visible Visit card precedes terrain resolution, cancellation restores departure, both retry paths arrive, zero page/WebGL errors.');
  } finally { await browser.close();await host.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
