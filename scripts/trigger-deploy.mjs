// A deploy hook is a secret. Never print its URL, response, or exception details.
const hook = process.env.DEPLOY_HOOK_URL;
if (!hook) {
  console.log('No deploy hook configured. The connected host may deploy the new commit through its Git integration.');
} else {
  try {
    const url = new URL(hook);
    if (url.protocol !== 'https:') throw new Error('HTTPS required');
    const response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error('Hook rejected');
    console.log('Hosting deployment requested. Check the hosting dashboard for completion.');
  } catch {
    console.error('Deploy hook failed. The data commit was retained; check the hosting dashboard and secret configuration.');
    process.exitCode = 1;
  }
}
