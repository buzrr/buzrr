// The standings' timing lives in the contract (the server tells players
// when the host's podium stands); re-exported for the web app.
export {
  COUNT_PAUSE_MS,
  MAX_COUNT_MS,
  PODIUM_STEP_MS,
  RESORT_MS,
  SETTLE_DELAY_MS,
  countUpMs,
  podiumDoneMs,
  podiumStartMs,
  resortStartMs,
} from "@buzrr/contract";
