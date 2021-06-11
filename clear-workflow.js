const got = require('got');

const {
  GITHUB_REPOSITORY: repository,
  CLEAR_TOKEN: token,
  RETAIN_DAY: retain_day
} = process.env;

const client = got.extend({
  headers: {
    'User-Agent': 'Github Actions',
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `token ${token}`
  },
  timeout: 10000,
  responseType: 'json',
  hooks: {
    afterResponse: [(response) => {
      const { headers } = response;
      const api_limit_remaining = Number(headers['x-ratelimit-remaining']);
      if (api_limit_remaining <= 100) {
        console.log(`API 调用次数剩余 ${api_limit_remaining}，暂停任务`);
        throw '';
      }
      else return response;
    }]
  }
});

async function deleteWorkflows(page, remain = 0) {
  const now = Date.now();
  const { body } = await client.get(`https://api.github.com/repos/${repository}/actions/runs`, {
    searchParams: {
      per_page: 100,
      page
    }
  });
  let workflow_count = body.total_count;
  let deleted = 0, reach_newest = false;
  const completed_workflows = body.workflow_runs.filter(workflow => workflow.status === 'completed').reverse();
  remain += 100 - completed_workflows.length;
  for (const workflow of completed_workflows) {
    if (now - new Date(workflow.created_at).getTime() <= retain_day * 24 * 60 * 60 * 1000) {
      reach_newest = true;
      break;
    }
    try {
      await client.delete(`https://api.github.com/repos/${repository}/actions/runs/${workflow.id}`);
      console.log(`删除 ${workflow.id}`);
      deleted++;
    }
    catch (error) {
      console.log(`删除 ${workflow.id} 失败`);
      remain++;
    }
    await new Promise(res => setTimeout(() => res(), 500));
  }
  workflow_count -= deleted;
  return { workflow_count, remain, reach_newest };
}

(async () => {
  try {
    const { body } = await client.get(`https://api.github.com/repos/${repository}/actions/runs`);
    let workflow_count = body.total_count;
    let remain = 0, reach_newest = false, page;
    while (workflow_count > 1 && !reach_newest) {
      page = Math.ceil(workflow_count / 100) - Math.ceil(remain / 100);
      ({ workflow_count, remain, reach_newest } = await deleteWorkflows(page, remain));
    }
    if (remain > 0) {
      await deleteWorkflows(page + 1);
      await deleteWorkflows(page);
    }
  }
  catch (error) {
    if (!error.response || error.response.statusCode >= 300) console.log(error);
    if (error.response && error.response.statusCode >= 300 && error.response.body) console.log(error.response.body);
    process.exit(1);
  }
})();