import { API_URL, WEBVIEW_BACKEND, WORKDIRS_KEYS } from "./common/Consts";
import { Mutex } from "async-mutex";
import { BaseWebview } from "./bases/BaseWebview";
import { RequestWorkdirStatus, UpdateVersions, UpdateWorkdirStatus } from "./common/ViewMessages";
import { SuibaseJson, SuibaseJsonVersions } from "./common/SuibaseJson";

// One instance per workdir, instantiated in same size and order as WORKDIRS_KEYS.
class BackendWorkdirTracking {
  versions: SuibaseJsonVersions; // Result from getVersions backend call.
  workdirStatus: SuibaseJson; // Result from getWorkdirStatus backend call.

  constructor() {
    this.versions = new SuibaseJsonVersions();
    this.workdirStatus = new SuibaseJson();
  }
}

export class BackendSync {
  private static sInstance?: BackendSync;

  private mWorkdir: string; // Last known active workdir. One of "localnet", "mainnet", "testnet", "devnet".
  private mWorkdirTrackings: BackendWorkdirTracking[] = []; // One instance per workdir, align with WORKDIRS_KEYS.

  // Singleton
  private constructor() {
    this.mWorkdir = "";

    // Create one instance of BackendWorkdirTracking for each element in WORKDIRS_KEYS.
    for (let workdirIdx = 0; workdirIdx < WORKDIRS_KEYS.length; workdirIdx++) {
      this.mWorkdirTrackings.push(new BackendWorkdirTracking());
    }
  }

  public static activate() {
    if (!BackendSync.sInstance) {
      BackendSync.getInstance();
    } else {
      console.error("BackendSync.activate() called more than once");
    }
  }

  public static deactivate() {
    const instance = BackendSync.sInstance;
    if (instance) {
      instance.mWorkdirTrackings = [];
    }
    BackendSync.sInstance = undefined;
  }

  public static getInstance(): BackendSync {
    if (!BackendSync.sInstance) {
      BackendSync.sInstance = new BackendSync();

      // Initialize callback for all Webview messages.
      BaseWebview.setBackendSyncMessageCallback(
        BackendSync.sInstance.handleViewMessage.bind(BackendSync.sInstance)
      );

      // Start periodic sync with backend.
      setTimeout(() => {
        if (BackendSync.sInstance) {
          BackendSync.sInstance.syncLoop();
        }
      }, 1);
    }
    return BackendSync.sInstance;
  }

  public get workdir(): string {
    return this.mWorkdir;
  }

  public handleViewMessage(message: any): void {
    try {
      if (message.name === "ForceVersionsRefresh" || message.name === "InitView") {
        // TODO For now just send the versions. InitView should proactively send more.
        this.forceRefresh();
      } else if (message.name === "WorkdirCommand") {
        let workdir = "";
        if (message.workdirIdx >= 0 && message.workdirIdx < WORKDIRS_KEYS.length) {
          workdir = WORKDIRS_KEYS[message.workdirIdx];
        }
        this.fetchWorkdirCommand(workdir, message.command);
      } else if (message.name === "RequestWorkdirStatus") {
        this.replyWorkdirStatus(message as RequestWorkdirStatus);
      }
    } catch (error) {
      console.error(`Error in handleViewMessage: ${error}`);
    }
  }

  // Allow to trig a force refresh of all backend states.
  // Can be called safely from anywhere.
  public forceRefresh(): void {
    this.syncLoop(true);
  }

  private loopMutex: Mutex = new Mutex();

  private syncLoop(forceRefresh = false): void {
    //console.log("StateLoop::_sync_loop() force_refresh=" + force_refresh);
    // Used for calling the loop() async function when the caller does
    // not care for the returned promise or error.
    //
    // This also eliminate eslint warning when the returned promise is unused.
    this.asyncLoop(forceRefresh).catch((err) => console.log(err));
  }

  private async asyncLoop(forceRefresh: boolean): Promise<void> {
    await this.loopMutex.runExclusive(async () => {
      this.update(forceRefresh);

      if (forceRefresh === false) {
        // Schedule another call in one second.
        setTimeout(() => {
          this.syncLoop(forceRefresh);
        }, 1000);
      }
    }); // End of loop_mutex section
  }

  private async fetchBackend<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    // Do a POST request equivalent to:
    //   curl -H "Content-Type: application/json" --data '{ "id":1, "jsonrpc":"2.0", "method":"getVersions", "params": {"workdir":"localnet"}}' http://0.0.0.0:44399
    //
    // On error, throw an exception.
    // On success, return the parsed JSON response.
    const headers = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Content-Type": "application/json",
    };

    const body = {
      id: 1,
      jsonrpc: "2.0",
      method: method,
      params: params,
    };

    try {
      const fetch = await import("node-fetch").then((fetch) => fetch.default);
      const response = await fetch(API_URL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`${method} ${params} not ok`);
      }
      let json: T = (await response.json()) as T;
      BackendSync.validateHeader(json, method);
      return json;
    } catch (error) {
      let errorMsg = `Error in fetchBackend ${method} ${params}: ${error}`;
      console.error(errorMsg);
      throw error;
    }
  }

  private async fetchGetVersions(workdir: string) {
    // TODO Use BackendWorkdirTracking to detect and ignore out-of-order responses.
    return await this.fetchBackend("getVersions", { workdir: workdir });
  }

  private async fetchGetWorkdirStatus(workdir: string) {
    // TODO Use BackendWorkdirTracking to detect and ignore out-of-order responses.
    return await this.fetchBackend("getWorkdirStatus", { workdir: workdir });
  }

  private async fetchWorkdirCommand(workdir: string, command: string) {
    return await this.fetchBackend("workdirCommand", { workdir: workdir, command: command });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static validateHeader(json: any, methodExpected: string) {
    // Throw an error on any problem detected.
    if (json.jsonrpc !== "2.0") {
      throw new Error("Invalid JSON-RPC version");
    }
    if (json.result.header.method !== methodExpected) {
      throw new Error("Invalid method");
    }
  }

  public async update(forceRefresh: boolean) {
    // Get the global states from the backend.

    // The VersionsUpdate message is periodically pushed to the views.
    //
    // The views then identify if they need to synchronize further with the extension
    // and trig update requests messages as needed.
    try {
      await this.updateUsingBackend(forceRefresh);
    } catch (error) {
      // Do nothing, assume the caller will retry later.
    }
  }

  private async updateUsingBackend(forceRefresh: boolean) {
    // Do getVersions for every possible workdir.
    //
    // TODO Optimize to do this to retrieve all only when dashboard is visible, otherwise just do the active?

    // Iterate the WORKDIRS_KEYS
    for (let workdirIdx = 0; workdirIdx < WORKDIRS_KEYS.length; workdirIdx++) {
      let workdir = WORKDIRS_KEYS[workdirIdx];
      const data = await this.fetchGetVersions(workdir);
      if (data) {
        try {
          // This is an example of data:
          //  {"jsonrpc":"2.0","result":{
          //   "header":{"method":"getVersions", "methodUuid":"...","dataUuid":"...","key":"localnet"},
          //   "versions":[{"method":"getWorkdirStatus","methodUuid":"...","dataUuid":"...","key":"localnet"}],
          //   "asuiSelection":"localnet"},
          //   "id":2}
          //
          // Each element of "versions" match the header you will find for each API method.
          // (e.g. see header example in replyWorkdirStatus)

          // Update the SuibaseJson instance for the workdir.
          const workdirTracking = this.mWorkdirTrackings[workdirIdx];
          const hasChanged = workdirTracking.versions.update(data.result);

          // Broadcast UpdateVersions message to all the views when change detected or requested.
          // The views will then decide if they need to synchronize further with the extension.
          if (hasChanged || forceRefresh) {
            BaseWebview.broadcastMessage(new UpdateVersions(WEBVIEW_BACKEND, workdirIdx, data.result));
          }
        } catch (error) {
          const errorMsg = `Error in updateUsingBackend: ${error}. Data: ${JSON.stringify(data)}`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
      }
    }
  }

  private async replyWorkdirStatus(message: RequestWorkdirStatus) {
    const sender = message.sender; // Will reply to sender only.
    const workdirIdx = message.workdirIdx;
    const methodUuid= message.methodUuid;
    const dataUuid = message.dataUuid;

    let data = null;
    try {
      let workdir = WORKDIRS_KEYS[workdirIdx];
      const workdirTracking = this.mWorkdirTrackings[workdirIdx];
      const tracking = workdirTracking.workdirStatus;
      data = tracking.getJson(); // Start with what is already in-memory (fetch only as needed)
      if (!data || methodUuid !== tracking.getMethodUuid() || dataUuid !== tracking.getDataUuid()) {
        const resp = await this.fetchGetWorkdirStatus(workdir);
        data = resp.result;
        workdirTracking.workdirStatus.update(data); // Save a copy of latest.
      }

      // This is an example of data:
      //  {"jsonrpc":"2.0","result":{"header":{"method":"getWorkdirStatus","methodUuid":"...","dataUuid":"...","key":"localnet"},
      //   "status":"OK","clientVersion":"1.23.0-db6e04d","asuiSelection":"localnet",
      //   "services":[{"label":"Localnet process","status":"OK","statusInfo":null,"helpInfo":null,"pid":null},
      //               {"label":"Faucet process","status":"OK","statusInfo":null,"helpInfo":null,"pid":null},
      //               {"label":"Proxy server","status":"OK","statusInfo":null,"helpInfo":null,"pid":null},
      //               {"label":"Multi-link RPC","status":"OK","statusInfo":null,"helpInfo":null,"pid":null}]},"id":2}
      //
      // Update the SuibaseJson instance for the workdir.
      BaseWebview.postMessageTo(sender,new UpdateWorkdirStatus(WEBVIEW_BACKEND, workdirIdx, data));
    } catch (error) {
      const errorMsg = `Error in replyWorkdirStatus: ${error}. Data: ${JSON.stringify(data)}`;
      console.error(errorMsg);
      //throw new Error(errorMsg);
    }
  }
}
