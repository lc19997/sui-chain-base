// Permanent constants
//
// The following should NEVER change because used outside the web app (e.g. backend processing).
//
// Only const of strings and numbers.
//
// No dependency allowed here.

// workdir_idx are hard coded for performance.
// Note: These matches the definition used in the backend.
export const WORKDIR_IDX_MAINNET = 0;
export const WORKDIR_IDX_TESTNET = 1;
export const WORKDIR_IDX_DEVNET = 2;
export const WORKDIR_IDX_LOCALNET = 3;

// List of all possible workdirs planned to be supported.
// The order is important since the position match the WORKDIR_IDX_* constants.
export const WORKDIRS_KEYS = ["mainnet", "testnet", "devnet", "localnet"];
export const WORKDIRS_LABELS = ["Mainnet", "Testnet", "Devnet", "Localnet"];

export const API_URL = "http://0.0.0.0:44399";