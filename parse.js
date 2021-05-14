const fs = require('fs').promises;

const {
  GITHUB_REPOSITORY: repository
} = process.env;

(async () => {
  const manifest = JSON.parse(await fs.readFile('ehsyringe.chrome/manifest.json'));
  manifest.update_url = `https://github.com/${repository}/releases/latest/download/update.xml`;
  await fs.writeFile('ehsyringe.chrome/manifest.json', JSON.stringify(manifest, null, 2));
})();