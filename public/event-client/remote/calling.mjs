/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This frontend module contains remote methods invoked by the server, related to calling
 */

import CallRingerUI from "/$/chat/calling/static/widgets/ringer/widget.mjs";


export default class ChatCallingClientRemoteMethods {

    constructor() {

    }

    /**
     * This method is used to make a call ring in the frontend
     * @param {object} param0 
     * @param {string} param0.call
     * @returns {Promise<void>}
     */
    async ring({ call }) {

        new CallRingerUI(call).show()
    }

}