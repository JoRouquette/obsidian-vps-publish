#!/usr/bin/env node
/**
 * Display success message after report generation
 * Usage: node show-report-info.cjs <profile-name>
 */

const path = require('path');

const profileName = process.argv[2] || 'test';
const reportsDir = 'tools/load-tests/artillery/reports';

console.log('\n' + '='.repeat(60));
console.log('✅ Rapport de test généré avec succès !');
console.log('='.repeat(60));
console.log(`\n📁 Emplacement des fichiers :`);
console.log(`   JSON : ${reportsDir}/${profileName}.json`);
console.log(`   HTML : ${reportsDir}/${profileName}.html`);
console.log(`\n🌐 Pour visualiser le rapport HTML :`);
console.log(`   npm run load:report:open`);
console.log(`\n💡 Ou ouvrir directement :`);
console.log(`   start ${reportsDir}/${profileName}.html  (Windows)`);
console.log(`   open ${reportsDir}/${profileName}.html   (Mac/Linux)`);
console.log('='.repeat(60) + '\n');
