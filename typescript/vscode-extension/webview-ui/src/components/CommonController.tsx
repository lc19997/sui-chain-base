// This is a custom Hook used by all other view/controller components.
//
// It keep tracks of the "versions" for each workdir and 
// "status" data for the active workdir.
import { useRef, useState, useEffect } from 'react';
import { useMessage } from "../lib/CustomHooks";
import { SuibaseJsonVersions, SuibaseJsonWorkdirStatus } from "../common/SuibaseJson";
import { WORKDIRS_KEYS } from "../common/Consts";
import { VSCode } from '../lib/VSCode';
import { InitView, RequestWorkdirStatus } from '../common/ViewMessages';

export class ViewWorkdirStates {
    public label: string;
    public workdir: string;
    public workdirIdx: number;
    public versions: SuibaseJsonVersions; // Backend JSON of getVersions for this Workdir.
    public workdirStatus: SuibaseJsonWorkdirStatus; // Backend JSON of getWorkdirStatus for this Workdir.

    constructor(workdir: string, workdirIdx: number) {
      this.label = workdir.charAt(0).toUpperCase() + workdir.slice(1);      
      this.workdir = workdir;
      this.workdirIdx = workdirIdx;
      this.versions = new SuibaseJsonVersions();
      this.workdirStatus = new SuibaseJsonWorkdirStatus();
    }    
  }

export class ViewCommonData {
    private _activeWorkdir: string;
    private _activeWorkdirIdx: number;
    private _activeLoaded: boolean;

    constructor() {
      this._activeWorkdir = "";
      this._activeWorkdirIdx = 0;
      this._activeLoaded = false;
    }

    public get activeWorkdir() {
      return this._activeWorkdir;
    }

    public set activeWorkdir(workdir: string) {      
      const idx = WORKDIRS_KEYS.indexOf(workdir);
      if (idx < 0) {
        console.error(`Invalid workdir: ${workdir}`);
        return;
      }
      // Keep activeWorkdirIdx in-sync.
      this._activeWorkdirIdx = idx;
      this._activeWorkdir = workdir;
      this._activeLoaded = true;
    }

    public get activeWorkdirIdx() {
      return this._activeWorkdirIdx;
    }

    public set activeWorkdirIdx(workdirIdx: number) {    
      // Check that workdirIdx is in-range.
      if (workdirIdx < 0 || workdirIdx >= WORKDIRS_KEYS.length) {
        console.error(`Invalid workdirIdx: ${workdirIdx}`);
        return;
      }
      this._activeWorkdir = WORKDIRS_KEYS[workdirIdx];
      this._activeWorkdirIdx = workdirIdx;
      this._activeLoaded = true;
    }

    public get activeLoaded() {
      return this._activeLoaded;
    }
}

export class ViewObject {
  public name: string;
  public id: string;
  constructor() {
    this.name = "";
    this.id = "";
  }
}

export class ViewAddress {
  public id: string;  
  public ownedObjects: ViewObject[];
  public watchObjects: ViewObject[];
  constructor() {
    this.id = "";
    this.ownedObjects = [];
    this.watchObjects = [];
  }
}

export class ViewPackageData {
  public name: string;
  public id: string;
  public initObjects: ViewObject[];
  public watchObjects: ViewObject[];
  constructor() {
    this.name = "";
    this.id = "";
    this.initObjects = [];
    this.watchObjects = [];
  }
}

export class ViewExplorerData {
  // Packages/Objects/Addresses relevant to the recent publish.
  mostRecents: ViewPackageData[];
  archives: ViewPackageData[];
  constructor() {
    this.mostRecents = [];
    this.archives = [];
  }
}

export const useCommonController = () => {
  const { message } = useMessage();
  const common = useRef(new ViewCommonData());
  const [ workdirs ] = useState<ViewWorkdirStates[]>(WORKDIRS_KEYS.map((key, index) => new ViewWorkdirStates(key, index)));
  /*
  const updateWorkdirs = (index: number, updates: Partial<ViewWorkdirStates>) => {
    setWorkdirs(currentStates =>
      currentStates.map((item, idx) =>
        idx === index ? { ...item, ...updates } : item
      )
    );
  };*/

  // A trick to force a re-render of the component using useCommonController.
  // This simplify greatly the handling of changes of workdirs array elements.
  const [commonTrigger, setUpdateTrigger] = useState(false);

  useEffect(() => {  
    // This is also called when this component is mounted, which is 
    // surprisingly often (e.g. every time user switch tabs in VSCode).

    // Call InitView if any of the backend data is missing.
    // TODO Use persistence to cache the data when the view is unmounted.
    let missingData = common.current.activeLoaded === false;
    if (!missingData) {
      // Check workdirs data.
      for (let i = 0; i < workdirs.length; i++) {
        const workdirTracking = workdirs[i];
        if (!workdirTracking.versions.getJson()) {
          missingData = true;
          break;
        }
      }
    }
    if (missingData) {
      VSCode.postMessage(new InitView());
    }
  }, [workdirs]);

  useEffect(() => {
    try {
      if (message && message.name) {
        let do_render = false;
        switch (message.name) {
          case 'UpdateVersions': {
            const workdirTracking = workdirs[message.workdirIdx];
            const hasChanged = workdirTracking.versions.update(message.json);            
            if (hasChanged) {
              do_render = true;
              // Verify if versions shows that a newer WorkdirStatus is available. If yes, then PostMessage "RequestWorkdirStatus"              
              //console.log(`Received modified versions ${JSON.stringify(message.json)} workdir status: ${JSON.stringify(workdirTracking.workdirStatus)}`)
              const [isUpdateNeeded,methodUuid,dataUuid] = workdirTracking.versions.isWorkdirStatusUpdateNeeded(workdirTracking.workdirStatus);
              //console.log(`isUpdateNeeded: ${isUpdateNeeded}, methodUuid: ${methodUuid}, dataUuid: ${dataUuid}`);
              if (isUpdateNeeded) {
                VSCode.postMessage( new RequestWorkdirStatus(message.workdirIdx, methodUuid, dataUuid) );
              }
            }
            // As needed, update activeWorkdir (and indirectly activeWorkdirIdx ).
            //console.log(`common.current.activeWorkdir: ${common.current.activeWorkdir}, message.json.asuiSelection: ${message.json.asuiSelection}`);
            if (common.current.activeWorkdir !== message.json.asuiSelection) {
              common.current.activeWorkdir = message.json.asuiSelection;                
              do_render = true;
            }
            break;
          }
          case 'UpdateWorkdirStatus': {
            const workdirTracking = workdirs[message.workdirIdx];
            const hasChanged = workdirTracking.workdirStatus.update(message.json);
            if (hasChanged) {
              //workdirTracking.updateCalculatedFields();
              do_render = true;
            }
            break;
          }
          default:
            console.log('Received an unknown command', message);
        }
        if (do_render) {
          setUpdateTrigger(prev => !prev);
        }
      }
    } catch (error) {
      console.error("An error occurred in useCommonController:", error);
    }
  }, [message,workdirs]);

  return {commonTrigger, common, workdirs};
};