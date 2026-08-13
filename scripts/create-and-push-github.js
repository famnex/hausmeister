const https = require('https');
const { execSync } = require('child_process');

const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_NAME = 'hausmeister';
const TARGET_OWNER = 'famnex';

function githubApiRequest(path, method, body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'User-Agent': 'NodeJS-Agent',
        'Authorization': `token ${TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: responseData });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function main() {
  if (!TOKEN) {
    console.error('GITHUB_TOKEN environment variable not set');
    process.exit(1);
  }

  console.log('1. Checking user/org details on GitHub...');
  const userRes = await githubApiRequest('/user', 'GET');
  console.log('Authenticated User:', userRes.body.login);

  console.log(`2. Creating public repository ${TARGET_OWNER}/${REPO_NAME}...`);
  
  let createRes = await githubApiRequest(`/orgs/${TARGET_OWNER}/repos`, 'POST', {
    name: REPO_NAME,
    private: false,
    description: 'Schul-Hausmeister Ticket-System (Facility Management in Node.js & SQLite)'
  });

  if (createRes.statusCode !== 201) {
    console.log(`Org creation returned status ${createRes.statusCode}, trying user endpoint...`);
    createRes = await githubApiRequest('/user/repos', 'POST', {
      name: REPO_NAME,
      private: false,
      description: 'Schul-Hausmeister Ticket-System (Facility Management in Node.js & SQLite)'
    });
  }

  if (createRes.statusCode === 201 || (createRes.body && createRes.body.message && createRes.body.message.includes('already exists'))) {
    console.log('Repository ready on GitHub!');
  } else {
    console.log('Response status:', createRes.statusCode, createRes.body);
  }

  const remoteUrl = `https://${TOKEN}@github.com/${TARGET_OWNER}/${REPO_NAME}.git`;

  console.log('3. Updating git commit and pushing...');
  try {
    execSync('git reset', { stdio: 'inherit' });
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit --amend -m "Initial commit - Hausmeister Ticket System"', { stdio: 'inherit' });
    execSync('git branch -M main', { stdio: 'inherit' });
    
    try {
      execSync('git remote remove origin', { stdio: 'ignore' });
    } catch {}

    execSync(`git remote add origin ${remoteUrl}`, { stdio: 'inherit' });
    execSync('git push -u origin main --force', { stdio: 'inherit' });
    console.log('\n[SUCCESS] Successfully pushed to https://github.com/' + TARGET_OWNER + '/' + REPO_NAME);
  } catch (err) {
    console.error('Git error:', err.message);
  }
}

main();
