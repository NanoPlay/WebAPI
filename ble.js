namespace("com.subnodal.nanoplay.webapi.ble", function(exports) {
    const BLE_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
    const BLE_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
    const BLE_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
    const CHUNK_SIZE = 20;
    const DATA_TIMEOUT = 200;

    var characteristicValueChangeHandler;

    function stringToArrayBuffer(string) {
        var buffer = new ArrayBuffer(string.length);
        var bufferView = new Uint8Array(buffer);

        for (var i = 0; i < string.length; i++) {
            bufferView[i] = string.charCodeAt(i);
        }

        return buffer;
    }

    function arrayBufferToString(buffer) {
        return String.fromCharCode.apply(this, new Uint8Array(buffer));
    }

    exports.SystemSupportError = class extends Error {};
    exports.ConnectionError = class extends Error {};

    exports.QueuedData = class {
        constructor(data, promiseResolver) {
            this.data = data;
            this.promiseResolver = promiseResolver;

            this.maxLength = this.data.length;
        }
    };

    exports.Connection = class {
        constructor() {
            if (window.location.protocol != "https" && window.location.hostname != "localhost" && window.location.hostname != "127.0.0.1") {
                throw new exports.SystemSupportError("Web Bluetooth can only be used in HTTPS contexts (or if the page is served as localhost)");
            }

            if (!exports.Connection.systemSupported()) {
                throw new exports.SystemSupportError("Your system does not support Web Bluetooth");
            }

            this.bleDevice = null;
            this.bleServer = null;
            this.bleService = null;
            this.bleRxCharacteristic = null;
            this.bleTxCharacteristic = null;
            this.bleTxQueue = [];
            this.bleFlowXoff = null;
            this.isOpen = false;
            this.isOpening = false;
            this.isBusy = false;
            this.txInProgress = false;
            this.rxData = "";
        }

        static systemSupported() {
            return !!navigator.bluetooth;
        }

        connect() {
            var thisScope = this;

            return new Promise(function(resolve, reject) {
                navigator.bluetooth.requestDevice({
                    filters: [
                        {namePrefix: "NanoPlay "},
                        {services: [BLE_SERVICE]}
                    ],
                    optionalServices: [BLE_SERVICE]
                }).then(function(device) {
                    thisScope.bleDevice = device;

                    device.addEventListener("gattserverdisconnected", function() {
                        thisScope.disconnect();
                    });
    
                    return device.gatt.connect();
                }).then(function(server) {
                    thisScope.bleServer = server;
    
                    return server.getPrimaryService(BLE_SERVICE);
                }).then(function(service) {
                    thisScope.bleService = service;
    
                    return service.getCharacteristic(BLE_RX);
                }).then(function(characteristic) {
                    thisScope.bleRxCharacteristic = characteristic;

                    if (!characteristicValueChangeHandler) {
                        characteristicValueChangeHandler = function(event) {
                            var dataView = event.target.value;
        
                            for (var i = 0; i < dataView.length; i++) {
                                var byte = dataView.getUint8(i);
        
                                if (byte == 0x11) { // XON
                                    thisScope.bleFlowXoff = false;
                                } else if (byte == 0x13) { // XOFF
                                    thisScope.bleFlowXoff = true;
                                }
                            }
        
                            var dataString = arrayBufferToString(dataView.buffer);

                            thisScope.rxData += dataString;
                        }
                    }

                    thisScope.bleRxCharacteristic.removeEventListener("characteristicvaluechanged", characteristicValueChangeHandler);    
                    thisScope.bleRxCharacteristic.addEventListener("characteristicvaluechanged", characteristicValueChangeHandler);
    
                    return characteristic.startNotifications();
                }).then(function() {
                    return thisScope.bleService.getCharacteristic(BLE_TX);
                }).then(function(characteristic) {
                    thisScope.bleTxCharacteristic = characteristic;
                }).then(function() {
                    thisScope.bleTxQueue = [];
                    thisScope.isOpen = true;
                    thisScope.isOpening = false;
                    thisScope.isBusy = false;
                    thisScope.txInProgress = false;

                    thisScope.write();

                    resolve();
                }).catch(function(error) {
                    reject(error);

                    thisScope.disconnect();
                });
            });
        }

        disconnect() {
            if (this.bleServer != null) {
                this.bleServer.disconnect();
            }

            this.bleDevice = null;
            this.bleServer = null;
            this.bleRxCharacteristic = null;
            this.bleTxCharacteristic = null;

            this.isOpen = false;
            this.isOpening = false;
        }

        write(data, progressCallback = function() {}) {
            var thisScope = this;

            this.rxData = "";
            this.isBusy = true;

            return new Promise(function(resolve, reject) {
                function writeChunk() {
                    if (thisScope.bleFlowXoff) {
                        setTimeout(writeChunk, 100);

                        return;
                    }

                    if (thisScope.bleTxQueue.length == 0) {
                        thisScope.isBusy = false;

                        return;
                    }

                    var chunk = null;
                    var dataToTx = thisScope.bleTxQueue[0];

                    progressCallback(dataToTx.maxLength - dataToTx.data.length, dataToTx.maxLength);

                    if (dataToTx.data.length <= CHUNK_SIZE) {
                        chunk = dataToTx.data;
                        dataToTx.data = "";
                    } else {
                        chunk = dataToTx.data.substring(0, CHUNK_SIZE);
                        dataToTx.data = dataToTx.data.substring(CHUNK_SIZE);
                    }

                    thisScope.txInProgress = true;

                    thisScope.bleTxCharacteristic.writeValue(stringToArrayBuffer(chunk)).then(function() {
                        if (dataToTx.data.length == 0) {
                            thisScope.bleTxQueue.shift();

                            dataToTx.promiseResolver();
                        }

                        thisScope.txInProgress = false;

                        writeChunk();
                    }).catch(function(error) {
                        thisScope.bleTxQueue = [];

                        thisScope.disconnect();
                        reject(error);

                        thisScope.isBusy = false;
                    });
                }

                if (data) {
                    thisScope.bleTxQueue.push(new exports.QueuedData(data, resolve));
                }

                if (thisScope.isOpen && !thisScope.txInProgress) {
                    writeChunk();
                }
            });
        }

        communicate(data, progressCallback = function() {}) {
            var thisScope = this;

            if (!this.isOpen) {
                throw new exports.ConnectionError("Please connect to your NanoPlay first");
            }

            return new Promise(function(resolve, reject) {
                if (thisScope.isBusy) {
                    setTimeout(function() {
                        thisScope.communicate(data, progressCallback).then(resolve);
                    }, 100);
    
                    return;
                }
    
                thisScope.write(data, progressCallback).then(function() {
                    var timeoutStart = new Date().getTime();
                    var lastData = thisScope.rxData;
    
                    setTimeout(function timeout() {
                        if (thisScope.rxData != lastData) {
                            timeoutStart = new Date().getTime();
                            lastData = thisScope.rxData;

                            setTimeout(timeout, 10);
                        } else if (new Date().getTime() - timeoutStart < DATA_TIMEOUT) {
                            setTimeout(timeout, 10);
                        } else {
                            resolve(thisScope.rxData);
    
                            thisScope.rxData = "";
                        }
                    }, 10);
                });
            });
        }

        evaluate(expression, progressCallback = function() {}) {
            var thisScope = this;

            if (!this.isOpen) {
                throw new exports.ConnectionError("Please connect to your NanoPlay first");
            }

            return new Promise(function(resolve, reject) {
                thisScope.rxData = "";

                thisScope.communicate(`;print(btoa(JSON.stringify(eval(atob(\`${btoa(expression)}\`)))))\n`, progressCallback).then(function(data) {
                    try {
                        var jsonData = "";

                        if (data.trim().split("\n").length > 1) {
                            if (data.trim().split("\n")[0] == "") {
                                data = data.trim().split("\n").slice(1).join("\n");
                            }

                            jsonData = atob(data.split("print(btoa(JSON.stringify(eval(atob(")[1].split("\n")[1].trim());
                        } else {
                            resolve(undefined);

                            return;
                        }

                        if (jsonData == "undefined") {
                            resolve(undefined);
                        } else {
                            resolve(JSON.parse(jsonData));
                        }
                    } catch (e) {
                        console.warn(`Couldn't decode evaluated result: ${e}\nData: ${data.trim()}`);
                    }
                });
            });
        }
    };
});