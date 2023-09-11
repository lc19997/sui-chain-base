#!/bin/bash

# Tests for ~/suibase/install
#
# At the end of this script, a valid installation should be in place.
#
SUIBASE_DIR="$HOME/suibase"

# shellcheck source=SCRIPTDIR/../../common/__scripts-tests.sh
source "$SUIBASE_DIR/scripts/common/__scripts-tests.sh"

test_no_workdirs() {
    rm -rf ~/suibase/workdirs
    echo "localnet create"
    (localnet create >&"$OUT") || fail "create"
    assert_workdir_ok "localnet"

    #rm -rf ~/suibase/workdirs
    #echo "localnet update"
    #(localnet update >& "$OUT") || fail "update"
    #assert_workdir_ok "localnet"
    #assert_build_ok "localnet"
}

tests() {
    # shellcheck source=SCRIPTDIR/../../../../suibase/install
    (source ~/suibase/install >&"$OUT") || fail "install exit status=[#?]"
    test_no_workdirs
}

tests
