/**
 * Copyright 2024 HolyCorn Software
 * The Faculty of Chat
 * This controller (relay), allows routing of call traffic between peers that cannot directly communicate with one another.
 */


import nodeTurn from 'node-turn'

const turn = new nodeTurn({
    credentials: {
        user: 'user'
    },
    authMech: 'none',
    debugLevel: "ALL",
    listeningIps: ['0.0.0.0', '34.125.19.218']

});



export default turn