import { runAddUpdate } from './flavor-workflow.mjs';

runAddUpdate('update').catch(error=>{
  console.error(`Flavor update failed: ${error.message}`);
  process.exitCode=1;
});
