export function createEventEnvelope(input: any): any;
export function createRoomOrchestrator(input: { provider: any }): any;
export function createCallOrchestrator(): any;
export function createPkOrchestrator(): any;
export function createSeatOrchestrator(opts?: { maxSeats?: number }): any;
export function createLiveOrchestrator(input: { roomOrchestrator: any }): any;
export function createRtcRuntime(input: { provider: any }): any;
