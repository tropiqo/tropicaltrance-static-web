import { loadRelease } from '../../scripts/public-inputs.mjs';
// No normal brand selection is admitted by the existing v1 publication contract.
export default { ...loadRelease(), brandMedia: {} };
