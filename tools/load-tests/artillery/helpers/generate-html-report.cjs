#!/usr/bin/env node
/**
 * Generate HTML report from Artillery JSON output
 * Usage: node generate-html-report.cjs <input.json> <output.html>
 */

const fs = require('fs');
const path = require('path');

const [, , inputFile, outputFile] = process.argv;

if (!inputFile || !outputFile) {
  console.error('Usage: node generate-html-report.cjs <input.json> <output.html>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function getMetric(counters, key) {
  return counters[key] || 0;
}

function getSummary(summaries, key) {
  return summaries[key] || {};
}

const aggregate = data.aggregate || {};
const counters = aggregate.counters || {};
const summaries = aggregate.summaries || {};
const scenarios = getMetric(counters, 'vusers.completed') + getMetric(counters, 'vusers.failed');
const scenariosFailed = getMetric(counters, 'vusers.failed');
const vusersCreated = getMetric(counters, 'vusers.created');
const vusersCompleted = getMetric(counters, 'vusers.completed');
const vusersFailed = getMetric(counters, 'vusers.failed');
const requests = getMetric(counters, 'http.requests');
const responses = getMetric(counters, 'http.responses');
const codes2xx = Object.keys(counters)
  .filter((k) => k.startsWith('http.codes.2'))
  .reduce((sum, k) => sum + counters[k], 0);
const codes4xx = Object.keys(counters)
  .filter((k) => k.startsWith('http.codes.4'))
  .reduce((sum, k) => sum + counters[k], 0);
const codes5xx = Object.keys(counters)
  .filter((k) => k.startsWith('http.codes.5'))
  .reduce((sum, k) => sum + counters[k], 0);
const downloadedBytes = getMetric(counters, 'http.downloaded_bytes');
const responseTime = getSummary(summaries, 'http.response_time');
const sessionLength = getSummary(summaries, 'vusers.session_length');
const errors = Object.keys(counters)
  .filter((k) => k.startsWith('errors.'))
  .map((k) => ({ type: k.replace('errors.', ''), count: counters[k] }));

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Artillery Load Test Report - ${path.basename(inputFile, '.json')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: #f5f5f5; 
      padding: 2rem; 
      color: #333; 
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { 
      font-size: 2rem; 
      margin-bottom: 0.5rem; 
      color: #1a1a1a; 
    }
    .subtitle { 
      color: #666; 
      margin-bottom: 2rem; 
      font-size: 0.9rem; 
    }
    .card { 
      background: white; 
      border-radius: 8px; 
      padding: 1.5rem; 
      margin-bottom: 1.5rem; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
    }
    .card h2 { 
      font-size: 1.25rem; 
      margin-bottom: 1rem; 
      color: #2c3e50; 
      border-bottom: 2px solid #3498db; 
      padding-bottom: 0.5rem; 
    }
    .metrics-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 1rem; 
    }
    .metric { 
      background: #f8f9fa; 
      padding: 1rem; 
      border-radius: 6px; 
      border-left: 4px solid #3498db; 
    }
    .metric-label { 
      font-size: 0.85rem; 
      color: #666; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
      margin-bottom: 0.25rem; 
    }
    .metric-value { 
      font-size: 1.75rem; 
      font-weight: 600; 
      color: #1a1a1a; 
    }
    .metric-unit { 
      font-size: 0.9rem; 
      color: #666; 
      margin-left: 0.25rem; 
    }
    .success { border-left-color: #27ae60; }
    .warning { border-left-color: #f39c12; }
    .error { border-left-color: #e74c3c; }
    .success .metric-value { color: #27ae60; }
    .warning .metric-value { color: #f39c12; }
    .error .metric-value { color: #e74c3c; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 1rem; 
    }
    th, td { 
      padding: 0.75rem; 
      text-align: left; 
      border-bottom: 1px solid #e1e8ed; 
    }
    th { 
      background: #f8f9fa; 
      font-weight: 600; 
      color: #2c3e50; 
      text-transform: uppercase; 
      font-size: 0.8rem; 
      letter-spacing: 0.5px; 
    }
    tr:hover { background: #f8f9fa; }
    .badge { 
      display: inline-block; 
      padding: 0.25rem 0.75rem; 
      border-radius: 12px; 
      font-size: 0.85rem; 
      font-weight: 600; 
    }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-warning { background: #fff3cd; color: #856404; }
    .badge-error { background: #f8d7da; color: #721c24; }
    .footer { 
      text-align: center; 
      margin-top: 2rem; 
      color: #999; 
      font-size: 0.85rem; 
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Artillery Load Test Report</h1>
    <div class="subtitle">
      Rapport généré le ${new Date().toLocaleString('fr-FR')} • Fichier: ${path.basename(inputFile)}
    </div>

    <div class="card">
      <h2>Vue d'ensemble</h2>
      <div class="metrics-grid">
        <div class="metric ${vusersCompleted === vusersCreated ? 'success' : vusersFailed > 0 ? 'error' : 'warning'}">
          <div class="metric-label">Scénarios complétés</div>
          <div class="metric-value">${vusersCompleted}<span class="metric-unit">/ ${vusersCreated}</span></div>
        </div>
        <div class="metric ${vusersFailed === 0 ? 'success' : 'error'}">
          <div class="metric-label">Scénarios échoués</div>
          <div class="metric-value">${vusersFailed}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Requêtes HTTP</div>
          <div class="metric-value">${requests.toLocaleString()}</div>
        </div>
        <div class="metric ${responses === requests ? 'success' : 'warning'}">
          <div class="metric-label">Réponses HTTP</div>
          <div class="metric-value">${responses.toLocaleString()}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Codes de statut HTTP</h2>
      <div class="metrics-grid">
        <div class="metric success">
          <div class="metric-label">2xx Success</div>
          <div class="metric-value">${codes2xx}</div>
        </div>
        <div class="metric ${codes4xx === 0 ? 'success' : 'warning'}">
          <div class="metric-label">4xx Client Error</div>
          <div class="metric-value">${codes4xx}</div>
        </div>
        <div class="metric ${codes5xx === 0 ? 'success' : 'error'}">
          <div class="metric-label">5xx Server Error</div>
          <div class="metric-value">${codes5xx}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Données téléchargées</div>
          <div class="metric-value">${formatBytes(downloadedBytes)}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Temps de réponse HTTP (ms)</h2>
      <table>
        <thead>
          <tr>
            <th>Minimum</th>
            <th>Médiane</th>
            <th>Moyenne</th>
            <th>P95</th>
            <th>P99</th>
            <th>Maximum</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${responseTime.min !== undefined ? Math.round(responseTime.min) : 'N/A'}</td>
            <td>${responseTime.p50 !== undefined ? Math.round(responseTime.p50) : 'N/A'}</td>
            <td>${responseTime.mean !== undefined ? Math.round(responseTime.mean * 10) / 10 : 'N/A'}</td>
            <td>${responseTime.p95 !== undefined ? Math.round(responseTime.p95) : 'N/A'}</td>
            <td>${responseTime.p99 !== undefined ? Math.round(responseTime.p99) : 'N/A'}</td>
            <td>${responseTime.max !== undefined ? Math.round(responseTime.max) : 'N/A'}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Durée de session VU (ms)</h2>
      <table>
        <thead>
          <tr>
            <th>Minimum</th>
            <th>Médiane</th>
            <th>Moyenne</th>
            <th>P95</th>
            <th>P99</th>
            <th>Maximum</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${sessionLength.min !== undefined ? Math.round(sessionLength.min) : 'N/A'}</td>
            <td>${sessionLength.p50 !== undefined ? Math.round(sessionLength.p50) : 'N/A'}</td>
            <td>${sessionLength.mean !== undefined ? Math.round(sessionLength.mean) : 'N/A'}</td>
            <td>${sessionLength.p95 !== undefined ? Math.round(sessionLength.p95) : 'N/A'}</td>
            <td>${sessionLength.p99 !== undefined ? Math.round(sessionLength.p99) : 'N/A'}</td>
            <td>${sessionLength.max !== undefined ? Math.round(sessionLength.max) : 'N/A'}</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${
      errors.length > 0
        ? `
    <div class="card">
      <h2>Erreurs</h2>
      <table>
        <thead>
          <tr>
            <th>Type d'erreur</th>
            <th>Nombre</th>
          </tr>
        </thead>
        <tbody>
          ${errors
            .map(
              (e) => `
          <tr>
            <td>${e.type}</td>
            <td><span class="badge badge-error">${e.count}</span></td>
          </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
    `
        : ''
    }

    <div class="card">
      <h2>Détails des codes HTTP</h2>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Nombre</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${Object.keys(counters)
            .filter((k) => k.startsWith('http.codes.'))
            .map((k) => {
              const code = k.replace('http.codes.', '');
              const count = counters[k];
              const badgeClass = code.startsWith('2')
                ? 'badge-success'
                : code.startsWith('4')
                  ? 'badge-warning'
                  : 'badge-error';
              return `
          <tr>
            <td><strong>${code}</strong></td>
            <td>${count}</td>
            <td><span class="badge ${badgeClass}">${code.startsWith('2') ? 'Succès' : code.startsWith('4') ? 'Erreur client' : 'Erreur serveur'}</span></td>
          </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      Généré automatiquement par Artillery Load Test Reporter • ${new Date().toLocaleDateString('fr-FR')}
    </div>
  </div>
</body>
</html>
`;

fs.writeFileSync(outputFile, html, 'utf8');
console.log(`✅ Rapport HTML généré: ${outputFile}`);
