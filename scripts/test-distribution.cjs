#!/usr/bin/env node

const gen = require('../tools/load-tests/artillery/helpers/note-generator');

const count = parseInt(process.env.NOTES_COUNT || '300', 10);
const profile = process.env.NOTE_SIZE_PROFILE || 'balanced';

process.env.NOTES_COUNT = count.toString();
process.env.NOTE_SIZE_PROFILE = profile;

const ctx = { vars: { $loopCount: 0 } };

console.log(`Testing ${count} notes with '${profile}' distribution...\n`);

gen.generateNotes(ctx, {}, () => {
  const stats = ctx.vars.noteSizeStats;
  const total = stats.small + stats.medium + stats.large;

  console.log(`Results:`);
  console.log(`  Small:  ${stats.small} (${((stats.small / total) * 100).toFixed(1)}%)`);
  console.log(`  Medium: ${stats.medium} (${((stats.medium / total) * 100).toFixed(1)}%)`);
  console.log(`  Large:  ${stats.large} (${((stats.large / total) * 100).toFixed(1)}%)`);
  console.log(`  Total:  ${total}`);

  // Calculate total payload size
  const notes = ctx.vars.notes;
  const totalSize = notes.reduce((sum, note) => sum + note.content.length, 0);
  console.log(`\nTotal payload size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
});
