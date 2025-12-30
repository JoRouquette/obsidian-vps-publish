/**
 * Artillery session processor
 * Orchestrates note and asset generation for session upload scenarios
 */

const noteGenerator = require('./note-generator');
const assetGenerator = require('./asset-generator');

/**
 * Generate all payloads needed for a complete session
 */
function generateSessionPayloads(userContext, events, done) {
  // Generate notes
  noteGenerator.generateNotes(userContext, events, (err) => {
    if (err) return done(err);

    // Generate cleanup rules
    noteGenerator.generateCleanupRules(userContext, events, (err) => {
      if (err) return done(err);

      // Generate assets
      assetGenerator.generateAssets(userContext, events, (err) => {
        if (err) return done(err);

        // Log summary
        const notesSize = JSON.stringify(userContext.vars.notes).length;
        const assetsSize = JSON.stringify(userContext.vars.assets).length;

        console.log(
          `[Load Test] Generated ${userContext.vars.notesCount} notes (${(notesSize / 1024 / 1024).toFixed(2)} MB)`
        );
        console.log(
          `[Load Test] Generated ${userContext.vars.assetsCount} assets (${(assetsSize / 1024 / 1024).toFixed(2)} MB)`
        );

        return done();
      });
    });
  });
}

/**
 * Validate session creation response
 */
function validateSessionCreated(requestParams, response, context, ee, next) {
  if (response.statusCode === 201 && response.body.sessionId) {
    console.log(`[Load Test] Session created: ${response.body.sessionId}`);
  } else {
    console.error(`[Load Test] Session creation failed: ${response.statusCode}`);
  }
  return next();
}

/**
 * Validate notes upload response
 */
function validateNotesUploaded(requestParams, response, context, ee, next) {
  if (response.statusCode === 200) {
    console.log(`[Load Test] Notes uploaded successfully`);
  } else {
    console.error(`[Load Test] Notes upload failed: ${response.statusCode}`);
  }
  return next();
}

/**
 * Validate assets upload response
 */
function validateAssetsUploaded(requestParams, response, context, ee, next) {
  if (response.statusCode === 200) {
    console.log(`[Load Test] Assets uploaded successfully`);
  } else {
    console.error(`[Load Test] Assets upload failed: ${response.statusCode}`);
  }
  return next();
}

/**
 * Validate session finish response
 */
function validateSessionFinished(requestParams, response, context, ee, next) {
  if (response.statusCode === 200 && response.body.success) {
    console.log(`[Load Test] Session finished successfully`);
    if (response.body.stats) {
      console.log(`[Load Test] Stats: ${JSON.stringify(response.body.stats)}`);
    }
  } else {
    console.error(`[Load Test] Session finish failed: ${response.statusCode}`);
  }
  return next();
}

module.exports = {
  generateSessionPayloads,
  validateSessionCreated,
  validateNotesUploaded,
  validateAssetsUploaded,
  validateSessionFinished,
};
