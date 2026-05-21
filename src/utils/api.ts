import { Api } from '@statsfm/statsfm.js';

let instance: Api | null = null;

export function getApi(): Api {
  if (!instance) instance = new Api(
    {
      http: {
        retries: 3,
      }
    }
  );

  return instance;
}
