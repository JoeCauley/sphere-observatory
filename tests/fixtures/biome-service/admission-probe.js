/* Test-only trusted factory. It supplies no renderer or usable native region. */
'use strict';
exports.create=(recipe,services)=>Object.freeze({recipe,services});
