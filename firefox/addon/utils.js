const sdkPath = require('sdk/fs/path');
const file = require("sdk/io/file");
const notifications = require("sdk/notifications");

const { getTabContentWindow, getActiveTab } = require('sdk/tabs/utils');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');

const { Cc, Ci, Cu } = require('chrome');

const { TextEncoder, OS } = Cu.import("resource://gre/modules/osfile.jsm", {});

const nsIFilePicker = Ci.nsIFilePicker;

Cu.importGlobalProperties(["crypto"]);

Cu.import("resource://gre/modules/Promise.jsm");

exports.getDesktopPath = function(defaultDirectory) {

    var path = OS.Path.join(OS.Constants.Path.desktopDir, defaultDirectory);

    OS.File.makeDir(
        path,
        {
            ignoreExisting: true
        }
    ).catch(function (err) {
        console.log('makeDir failed', err);
    });

    return path;
};

function picker(message, type) {
    var path = null;
    var window = require("sdk/window/utils").getMostRecentBrowserWindow();
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

    fp.init(window, message, type);
    fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);

    var rv = fp.show();

    if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
        path = fp.file.path;
    }

    return path;
}

exports.directoryPicker = function(message) {
    return picker(message, nsIFilePicker.modeGetFolder);
};

function filePicker(message) {
    return picker(message, nsIFilePicker.modeOpen);
};

// http://www.wikidevs.com/3164/firefox-addon-api-for-taking-screenshot
exports.captureActiveTab = function (height) {
    let tab = getActiveTab(getMostRecentBrowserWindow())
    let contentWindow = getTabContentWindow(tab);
    let { document } = contentWindow;

    let w = contentWindow.outerWidth;
    let h = height;
    let x = 0;
    let y = 0;

    let canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');

    canvas.width = w;
    canvas.height = h;

    let ctx = canvas.getContext('2d');

    ctx.clearRect(x, y, w, h);
    ctx.save();
    ctx.drawWindow(contentWindow, x, y, w, h, "rgb(255,255,255)");
    ctx.restore();

    return canvas;
};

// http://stackoverflow.com/questions/31502231/firefox-addon-expose-chrome-function-to-website
// https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/OSFile.jsm/OS.File_for_the_main_thread#Example_Save_Canvas_to_Disk
exports.saveCanvas = function (canvas, basepath, filename, mimeType, password, saltLen, ivLen) {

    var q = Promise.defer();
    var path = basepath + sdkPath.sep + filename;

    file.mkpath(basepath);

    let tab = getActiveTab(getMostRecentBrowserWindow())
    let contentWindow = getTabContentWindow(tab);
    var reader = new contentWindow.FileReader();

    canvas.toBlob(
        function (b) {
            reader.readAsArrayBuffer(b);
        },
        mimeType,
        1
    );

    reader.onloadend = function () {
        var data = new Uint8Array(reader.result);

        if (password !== null) {
            encryptUint8Array(data, password, saltLen, ivLen).then(function(encryptedData) {
                OS.File.writeAtomic(path, encryptedData);
                q.resolve();
            }).catch(function(err) {
                q.reject(err);
            });
        } else {
            OS.File.writeAtomic(path, data);
            q.resolve();
        }
    };

    return q.promise;
};

function encryptUint8Array(data, password, saltLen, ivLen) {
    var salty = crypto.getRandomValues(new Uint8Array(saltLen));
    var encoder = new TextEncoder("utf-8");

    return new Promise(function(resolve, reject) {
        crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            {"name": "PBKDF2"},
            false,
            ["deriveKey"]
        ).then(function (baseKey) {

            crypto.subtle.deriveKey(
                {
                    "name": "PBKDF2",
                    salt: salty,
                    iterations: 1000,
                    hash: {name: "SHA-1"} //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
                },
                baseKey,
                {
                    name: "AES-CBC", //can be any AES algorithm ("AES-CTR", "AES-CBC", "AES-CMAC", "AES-GCM", "AES-CFB", "AES-KW", "ECDH", "DH", or "HMAC")
                    length: 256 //can be  128, 192, or 256
                },
                false,
                ["encrypt"]
            ).then(function (key) {
                var initializationVector = crypto.getRandomValues(new Uint8Array(ivLen));

                crypto.subtle.encrypt(
                    {
                        name: "AES-CBC",
                        iv: initializationVector
                    },
                    key,
                    data
                ).then(function (encrypted) {
                    resolve(joinSaltIvAndData(salty, initializationVector,  new Uint8Array(encrypted)));
                })
                .catch(function (err) {
                    reject(err);
                });
            }).catch(function (err) {
                reject(err);
            });
        }).catch(function(err) {
            reject(err);
        });
    });
};

exports.pickPageCapture = function(password) {
    var path = filePicker('Select a page capture to decrypt');

    if (path !== null) {

        OS.File.read(path).then(
            function onSuccess(array) {
                decrypt(array, path, password, 16, 16);
            },
            function onReject(reason) {
                console.error("Couldn't read from file: " + path + '::::' + reason);
            }
        );
    }
};

exports.showCaptureStatus = function(status, iconPath, filepath, tab) {
    notifications.notify({
        title: "Acceptum Notification",
        text: status,
        iconURL: iconPath,
        data: filepath,
        onClick: function(data) {
            tab.open('file://' + data);
        }
    });
};

function decrypt(buf, path, password, saltLen, ivLen) {

    var parts = separateSaltIvFromData(buf, saltLen, ivLen);
    var encoder = new TextEncoder("utf-8");

    crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        {"name": "PBKDF2"},
        false,
        ["deriveKey"]
    ).then(function (baseKey) {

        console.log('baseKey');

        crypto.subtle.deriveKey(
            {
                "name": "PBKDF2",
                salt: parts.salt,
                iterations: 1000,
                hash: {name: "SHA-1"} //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
            },
            baseKey,
            {
                name: "AES-CBC", //can be any AES algorithm ("AES-CTR", "AES-CBC", "AES-CMAC", "AES-GCM", "AES-CFB", "AES-KW", "ECDH", "DH", or "HMAC")
                length: 256 //can be  128, 192, or 256
            },
            false,
            ["decrypt"]
        ).then(function (key) {
            console.log('key');

            crypto.subtle.decrypt(
                {name: 'AES-CBC', iv: parts.iv},
                key,
                parts.data
            ).then(function (decrypted) {
                OS.File.writeAtomic(path.replace('.enc', ''), new Uint8Array(decrypted));
            });
        });
    });

};

// https://coolaj86.com/articles/webcrypto-encrypt-and-decrypt-with-aes/
function joinSaltIvAndData(salt, iv, data) {
    var sl = salt.length;
    var il = iv.length;
    var buf = new Uint8Array(sl + il + data.length);

    Array.prototype.forEach.call(salt, function (byte, i) {
        buf[i] = byte;
    });

    Array.prototype.forEach.call(iv, function (byte, i) {
        buf[i + sl] = byte;
    });

    Array.prototype.forEach.call(data, function (byte, i) {
        buf[i + sl + il] = byte;
    });

    return buf;
};

// https://coolaj86.com/articles/webcrypto-encrypt-and-decrypt-with-aes/
function separateSaltIvFromData(buf, saltLen, ivLen) {
    var sl = new Uint8Array(saltLen);
    var iv = new Uint8Array(ivLen);
    var data = new Uint8Array(buf.length - ivLen * 2);

    Array.prototype.forEach.call(buf, function (byte, i) {

        if (i < ivLen) {
            sl[i] = byte;
        } else if (i < ivLen * 2 && i >= ivLen) {
            iv[i - ivLen] = byte;
        } else {
            data[i - ivLen * 2] = byte;
        }
    });

    return {salt: sl, iv: iv, data: data};
};
