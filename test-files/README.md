# Test Files

This directory contains test files and tools for performance testing and validation.

## Synthetic Vault Generator

Generate test vaults with configurable number of notes and assets for performance testing.

### Usage

```bash
# Generate a vault with 500 notes and 100 assets
node scripts/generate-test-vault.mjs --notes 500 --assets 100 --output test-files/synthetic-vault

# Generate a large vault for stress testing
node scripts/generate-test-vault.mjs --notes 1000 --assets 368 --output test-files/large-vault
```

### Parameters

- `--notes`: Number of notes to generate (default: 100)
- `--assets`: Number of assets (images) to generate (default: 50)
- `--output`: Output directory path (default: `test-files/synthetic-vault`)

### Generated Vault Structure

```
synthetic-vault/
├── README.md          # Vault information
├── Notes/             # All test notes
│   ├── Test Note 1.md
│   ├── Test Note 2.md
│   └── ...
└── assets/            # Dummy image assets
    ├── test-image-0.png
    ├── test-image-1.png
    └── ...
```

### Note Features

Generated notes include:

- YAML frontmatter with metadata
- Random `publish: false` flags (~10% of notes)
- Multiple sections with lorem ipsum content
- Wikilinks to other notes
- Embedded asset references (![[image.png]])
- Occasional dataview blocks
- Tags

### Testing Workflow

1. **Generate vault**:

   ```bash
   node scripts/generate-test-vault.mjs --notes 500 --assets 100
   ```

2. **Open in Obsidian**:
   - Launch Obsidian
   - "Open folder as vault" → select `test-files/synthetic-vault`

3. **Configure plugin**:
   - Enable "VPS Publish" plugin
   - Configure your VPS settings
   - Set log level to "debug" for detailed profiling

4. **Run publish**:
   - Click the publish button
   - Monitor console output for performance metrics
   - Check for UI freezes or lag

5. **Analyze results**:
   - Check console for "Performance Summary" and "UI Pressure Summary"
   - Look for warnings about:
     - High progress update rate
     - High notice creation rate
     - Blocking operations > 50ms
     - Event loop lag

### Performance Baselines

Target metrics for a 500-note vault on average hardware:

- **Total publish time**: < 30 seconds
- **UI responsiveness**: No freezes > 100ms
- **Progress updates**: < 10/sec
- **Notice creation**: < 2/sec
- **Memory usage**: < 300MB heap

If metrics exceed these thresholds significantly, investigate performance bottlenecks.

## Other Test Files

- `le-code.md`: Manual test file with complex content for feature validation
