import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { logger } from './utils/logger.js';

const args = parseArgs({
  options: {
    config: {
      type: 'string',
      default: 'config/domains.json'
    },
    mode: {
      type: 'string'
    }
  },
  allowPositionals: false
}).values;

const mode = (args.mode ?? process.env.MODE ?? 'daily').toLowerCase();
const config = loadConfig(args.config);
const todayIso = Number(process.env.TEST_DAY_OF_WEEK ?? getIsoDay());

const domains =
  mode === 'all'
    ? config.domains
    : config.domains.filter((domain) => domain.day_of_week === todayIso);

const matrix = domains.map((domain) => ({ domain_id: domain.id, domain_name: domain.name }));
logger.info('Resolved matrix', { mode, count: matrix.length, todayIso });
// eslint-disable-next-line no-console
console.log(JSON.stringify(matrix));

function getIsoDay() {
  const today = new Date();
  const utcDay = today.getUTCDay();
  return ((utcDay + 6) % 7) + 1;
}
