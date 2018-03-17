
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

function encryptUint8Array (data, password, saltLen, ivLen) {
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
                    hash: {name: "SHA-512"} //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
                },
                baseKey,
                {
                    name: "AES-GCM", //can be any AES algorithm ("AES-CTR", "AES-CBC", "AES-CMAC", "AES-GCM", "AES-CFB", "AES-KW", "ECDH", "DH", or "HMAC")
                    length: 256 //can be  128, 192, or 256
                },
                false,
                ["encrypt"]
            ).then(function (key) {
                var initializationVector = crypto.getRandomValues(new Uint8Array(ivLen));

                crypto.subtle.encrypt(
                    {
                        name: "AES-GCM",
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


function decrypt(buf, password, saltLen, ivLen) {

  return new Promise(function(resolve, reject) {
    var parts = separateSaltIvFromData(buf, saltLen, ivLen);
    var encoder = new TextEncoder("utf-8");

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
                salt: parts.salt,
                iterations: 1000,
                hash: {name: "SHA-512"} //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
            },
            baseKey,
            {
                name: "AES-GCM", //can be any AES algorithm ("AES-CTR", "AES-CBC", "AES-CMAC", "AES-GCM", "AES-CFB", "AES-KW", "ECDH", "DH", or "HMAC")
                length: 256 //can be  128, 192, or 256
            },
            false,
            ["decrypt"]
        ).then(function (key) {
            crypto.subtle.decrypt(
                {name: 'AES-GCM', iv: parts.iv},
                key,
                parts.data
            ).then(function (decrypted) {
                resolve(new Uint8Array(decrypted));
            }).catch(function(err) {
              reject(err);
            });
        }).catch(function(err) {
          reject(err);
        });
    }).catch(function(err) {
      reject(err);
    });
  });
};

function takeActionOnDataURL(data, command) {
  var b64Data = data.split(',')[1];
  var rawImageData = window.atob(b64Data);
  var i = 0;
  var ab = new ArrayBuffer(rawImageData.length);
  var rawData = new Uint8Array(ab);

  for (; i < rawImageData.length; i++) {
      rawData[i] = rawImageData.charCodeAt(i);
  }
  var blob = new Blob([ab], {type: 'image/png'});
  var dataURL = window.URL.createObjectURL(blob);

  encryptUint8Array(rawData, "test", 16, 16).then(function(encryptedData) {
    decrypt(encryptedData, "test", 16, 16).then(function(decryptedData) {
      var blob = new Blob([encryptedData], {type: 'image/png'});
      var dataURL = window.URL.createObjectURL(blob);
      browser.downloads.download({
        'url': dataURL,
        'incognito': true,
        'conflictAction': 'uniquify',
        'filename': 'test.png'
      }).then(function(downloadId) {
        console.log(downloadId);
      }).catch(function(err){
        console.log(err);
      });
    });
  });
  //console.log(blob, command);
}

function reportError(error) {
  console.error(`Could not save page: ${error}`);
  //TODO: add user notifications
}

function listenForClicks() {
  var captureMethods = {
    "full": function(tabs, command) {
      browser.tabs.sendMessage(
        tabs[0].id, {
          command: command
        }
      )
    },
    "visible": function(tabs, command) {
      function onCaptured(imageUri) {
        takeActionOnDataURL(imageUri, command);
      }

      browser.tabs.captureTab().then(onCaptured, reportError);
    }
  };

  document.addEventListener("click", (e) => {

    function htmlToImage(tabs) {
      var command = e.target.textContent.replace(' ', '');
      browser.storage.local.get("captureArea").then(
        function(config) {
          captureMethods[config.captureArea || "full"](tabs, command);
        },
        reportError
      );
    }


    browser.tabs.query({
        active: true,
        currentWindow: true
      })
      .then(htmlToImage)
      .catch(reportError);
  });
}

browser.tabs.executeScript({
    file: "/content_scripts/html-to-image.js"
  })
  .then(listenForClicks)
  .catch(reportError);

browser.runtime.onMessage.addListener(function(message) {
  takeActionOnDataURL(message.data, message.command);
});
