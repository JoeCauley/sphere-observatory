'use strict';
importScripts('grass-worker.js','prototype/shared-packet-p4.js');
const originalPrepare=SphereMeadowProvider.prepare;
SphereMeadowProvider.prepare=function(job,config,options){const original=originalPrepare(job,config,options),packet=SphereMeadowSharedPacketP4.strip(original);if(packet!==original&&options?.metrics){options.metrics.records=packet.recordCount;options.metrics.outputBytes=packet.byteLength;options.metrics.peakTypedBytes+=packet.byteLength;}return packet;};
