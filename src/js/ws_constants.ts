interface SyncTypes {
    IDLE: number,
    RESET: number,
    NODE_ERROR: number,
    NET_ONLINE: number,
    NET_OFFLINE: number,
}

export const syncStatus: SyncTypes = {
    IDLE: -100,
    RESET: -300,
    NODE_ERROR: -200,
    NET_ONLINE: -10,
    NET_OFFLINE: -50
}