const fs = require('fs').promises;
const got = require('got');

const {
  GITHUB_RUN_ID: run_id,
  GITHUB_REPOSITORY: repository,
  GITHUB_TOKEN: token
} = process.env;

const client = got.extend({
  headers: {
    'User-Agent': 'Github Actions'
  },
  timeout: 10000,
  responseType: 'json'
});

async function cancelWorkflow() {
  await client.post(`https://api.github.com/repos/${repository}/actions/runs/${run_id}/cancel`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${token}`
    }
  });
}

(async () => {
  const manifest = JSON.parse(await fs.readFile('ehsyringe.chrome/manifest.json'));
  manifest.update_url = `https://github.com/${repository}/releases/latest/download/update.xml`;
  await fs.writeFile('ehsyringe.chrome/manifest.json', JSON.stringify(manifest, null, 2));
  try {
    const { body } = await client.get(`https://api.github.com/repos/${repository}/releases/latest`);
    if (`${manifest.version}` === body.tag_name.substr(1)) {
      await cancelWorkflow();
      await new Promise(res => setTimeout(() => res(), 60000));
    }
  }
  catch (error) {
    if (!error.response || error.response.statusCode !== 404) {
      console.log(error);
      console.log(error.response.body);
      process.exit(1);
    }
  }
  console.log(manifest.version);
})();