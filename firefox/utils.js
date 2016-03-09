const { Cc, Ci, Cu } = require('chrome');
const {TextEncoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});
const { getTabContentWindow, getActiveTab } = require('sdk/tabs/utils');
const { getMostRecentBrowserWindow } = require('sdk/window/utils');

Cu.importGlobalProperties(["crypto"]);

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

exports.directoryPicker = function(message) {
    const nsIFilePicker = Ci.nsIFilePicker;
    var path = null;
    var window = require("sdk/window/utils").getMostRecentBrowserWindow();
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

    fp.init(window, message, nsIFilePicker.modeGetFolder);
    fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText);

    var rv = fp.show();

    if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
        path = fp.file.path;
    }

    return path;
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
exports.saveCanvas = function (canvas, path, password, saltLen, ivLen) {
    var salty = crypto.getRandomValues(new Uint8Array(saltLen));
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
            //returns the derived key
            console.log('key');

            var reader = Cc['@mozilla.org/files/filereader;1'].createInstance(Ci.nsIDOMFileReader);

            canvas.toBlob(function (b) {
                reader.readAsArrayBuffer(b);
            });

            var initializationVector = crypto.getRandomValues(new Uint8Array(ivLen));

            reader.onloadend = function () {
                crypto.subtle.encrypt(
                    {
                        name: "AES-CBC",
                        iv: initializationVector
                    },
                    key,
                    new Uint8Array(reader.result)
                ).then(function (encrypted) {
                    OS.File.writeAtomic(path, joinSaltIvAndData(salty, initializationVector, new Uint8Array(encrypted)));
                })
                .catch(function (err) {
                    console.error(err);
                });
            };
        }).catch(function (err) {
            console.error(err);
        });
    });
};

exports.pickCapture = function() {
//    var path = filePicker();

    OS.File.read('/home/rhiza/test.png').then(
//    OS.File.read(path).then(
        function onSuccess(array) {
            decrypt(array, '/home/rhiza/test.dec.png', 'secret', 16, 16);
        },
        function onReject(reason) {
            console.error("Couldn't read from purls.txt:\n"+reason);
        }
    );
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
                OS.File.writeAtomic(path, new Uint8Array(decrypted));
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