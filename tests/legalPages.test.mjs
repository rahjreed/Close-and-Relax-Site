import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';
import * as legal from '../src/lib/legalPages.js';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('legal routes match only dedicated exact paths, with deployed SPA refresh rewrites', () => {
  const config = JSON.parse(read('../vercel.json'));
  for (const [path, page] of [['/privacy','privacy'],['/privacy/','privacy'],['/terms','terms'],['/terms/','terms']]) {
    assert.equal(legal.legalPageForPath(path), page);
    assert.ok(config.rewrites.some(item => item.source === path && item.destination === '/index.html'));
  }
  for (const path of ['/', '/insurance', '/dashboard', '/privacy-other', '/terms/extra', null]) assert.equal(legal.legalPageForPath(path), null);
  const app = read('../src/App.jsx');
  assert.ok(app.indexOf('if (legalPage) return <LegalPage') < app.indexOf('function CloseRelaxApp()'));
});

test('legal pages render readable draft disclosures and navigation without authentication or homeowner side effects', async () => {
  const source = read('../src/components/LegalPage.jsx');
  const compiled = await transformWithEsbuild(source, 'LegalPage.jsx', { loader:'jsx', format:'cjs', jsx:'transform' });
  const module = { exports:{} }, require = createRequire(import.meta.url);
  new Function('require','module','exports',compiled.code)(name => name === '../lib/legalPages' ? legal : name === './SupportContactDialog' ? {default:()=>null} : require(name), module, module.exports);
  for (const page of ['privacy','terms']) {
    const html = renderToStaticMarkup(React.createElement(module.exports.default,{page}));
    assert.match(html, /<h1[^>]*>/); assert.ok(html.includes(legal.LEGAL_PAGES[page].title));
    assert.match(html,/not been attorney-reviewed/); assert.match(html,/Contact Support/);
    assert.match(html,/aria-label="Legal"/); assert.match(html,/aria-current="page"/);
    for (let i=1;i<=legal.LEGAL_PAGES[page].sections.length;i++) assert.ok(html.includes(`id="section-${i}"`));
  }
  assert.doesNotMatch(source,/localStorage|sessionStorage|recordHubActivity|\.rpc\(|\.from\(|signOut\(/);
});

test('privacy and terms retain required data boundaries and unresolved-policy markers rather than invented guarantees', () => {
  const privacy = JSON.stringify(legal.LEGAL_PAGES.privacy);
  for (const phrase of ['Supabase','Vercel','Resend','Cloudflare','Goosehead','Google Fonts','YouTube','Calendly','localStorage','Session storage','approximate','Ordinary Realtors cannot read','does not automatically','No fixed deletion deadline','Support']) assert.ok(privacy.includes(phrase),phrase);
  const terms = JSON.stringify(legal.LEGAL_PAGES.terms);
  for (const phrase of ['pending final policy','pending founder decision','not yet available','acceptable','permission','professional legal review']) assert.ok(terms.toLowerCase().includes(phrase.toLowerCase()),phrase);
  assert.doesNotMatch(privacy + terms,/guaranteed savings|we never share|deleted within \d+ days|attorney-approved|governed by the laws of/i);
});

test('legal links are discoverable in account, marketing, hub, insurance review and Support without replacing consent or exposing drafts', () => {
  for (const path of ['App.jsx','components/AccountSettingsDialog.jsx','components/PublicRealtorHub.jsx','components/InsurancePage.jsx','components/InsuranceWizard.jsx','components/SupportContactDialog.jsx']) {
    const source=read(`../src/${path}`);
    assert.match(source,/href="(?:https:\/\/www\.closeandrelax\.com)?\/privacy/);
    assert.match(source,/href="(?:https:\/\/www\.closeandrelax\.com)?\/terms/);
    for (const anchor of source.match(/<a\b[^>]*target="_blank"[^>]*>/g)||[]) {
      if (/href="(?:https:\/\/www\.closeandrelax\.com)?\/(?:privacy|terms)/.test(anchor)) assert.match(anchor,/rel="[^"]*noopener/);
    }
  }
  const wizard=read('../src/components/InsuranceWizard.jsx');
  assert.match(wizard,/I agree to be contacted by the Close &amp; Relax team/);
  assert.match(wizard,/requests contact from Close &amp; Relax/);
  assert.match(read('../src/components/HomeownerSavingsSection.jsx'),/does not mean your Realtor personally selected or endorsed/);
});
