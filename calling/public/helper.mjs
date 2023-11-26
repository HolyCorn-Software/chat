/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module provides useful functions related to calling
 */



const libCall = {
    /**
     * This method returns a qualified label for a type of call
     * @param {telep.chat.calling.CallType} type 
     * @returns {string}
     */
    getCallTypeLabel(type) {
        return type === 'video' || type == 'voice' ? `${type[0].toUpperCase()}${type.substring(1)}` : `Unknown`
    }
}


export default libCall