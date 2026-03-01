// Re-export register actions for the POS Lobby component
export {
    getPosLobby,
    verifyPosPin,
    openRegisterSession,
    closeRegisterSession,
    setPosPin,
    getRegisterStatus
} from '../../app/(privileged)/sales/register-actions';
