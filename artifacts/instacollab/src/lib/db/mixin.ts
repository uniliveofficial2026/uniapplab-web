import type { DbCore } from './dbCore';

/** Constructor type for mixin composition (rest args must be `any[]` per TS2545). */
export type Constructor<T extends object = object> = new (...args: any[]) => T;

/** Minimum instance type for mixin bases (`DbCore` + accumulated layers widen `T`). */
export type DbCoreBacked = InstanceType<typeof DbCore>;

/** Merged constructor after applying a domain mixin. */
export type MixinCtor<TBase extends Constructor, TLayer extends object> = Constructor<
  InstanceType<TBase> & TLayer
> &
  TBase;
