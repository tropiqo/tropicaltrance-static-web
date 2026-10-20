import { runAddUpdate } from './flavor-workflow.mjs';

runAddUpdate('add').catch(error=>{
  console.error(`Flavor add failed: ${error.message}`);
  process.exitCode=1;
});
