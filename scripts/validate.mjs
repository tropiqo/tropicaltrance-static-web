import { spawnSync } from 'node:child_process';
import { loadRelease } from './public-inputs.mjs';
import { checkSource, checkOutput } from './check-static.mjs';
import { checkReviewOutput } from './check-review.mjs';

const stage = process.argv[2];
try {
  if (stage === 'inputs') { loadRelease(); await checkSource(); }
  else if (stage === 'output') await checkOutput();
  else if (stage === 'review-output') await checkReviewOutput();
  else if (stage === 'reproducible') {
    // Reuse the existing isolated-build checks and their network blocker.
    const result = spawnSync(process.execPath, ['--test', 'tests/build-isolation.test.mjs'], { stdio: 'inherit' });
    if (result.status !== 0) throw Error(result.error?.message || `Isolated build tests exited ${result.status}`);
  } else if (stage === 'all') {
    // npm test already includes the isolated reproducibility checks; do not repeat them.
    for (const script of ['validate:inputs', 'build', 'review:build', 'test', 'validate:output', 'validate:review-output']) {
      const result = spawnSync('npm', ['run', script], { stdio: 'inherit' });
      if (result.status !== 0) throw Error(`${script} exited ${result.status}`);
    }
  } else throw Error(`Unknown validation stage: ${stage}`);
  console.log(`VALIDATION ${stage}: structural PASS; legal/commercial eligibility, owner visual acceptance, remote CI and external publication/deployment remain separate and UNVERIFIED.`);
} catch (error) {
  console.error(`VALIDATION ${stage}: FAIL: ${error.message}`);
  process.exitCode = 1;
}
