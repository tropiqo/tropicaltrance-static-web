import { runRemove } from './flavor-workflow.mjs';

runRemove().catch(error=>{
  console.error(`Flavor removal failed: ${error.message}`);
  process.exitCode=1;
});
