import type { ComposedDbLayers } from './layers';
import type { DbCore } from './dbCore';

/** Full application DB API (core persistence + all domain mixins). */
export type LocalDB = InstanceType<typeof DbCore> & ComposedDbLayers;
