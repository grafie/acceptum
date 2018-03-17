// https://coolaj86.com/articles/webcrypto-encrypt-and-decrypt-with-aes/
function joinSaltIvAndData(salt, iv, data) {
  var sl = salt.length;
  var il = iv.length;
  var buf = new Uint8Array(sl + il + data.length);

  Array.prototype.forEach.call(salt, function(byte, i) {
    buf[i] = byte;
  });

  Array.prototype.forEach.call(iv, function(byte, i) {
    buf[i + sl] = byte;
  });

  Array.prototype.forEach.call(data, function(byte, i) {
    buf[i + sl + il] = byte;
  });

  return buf;
};

// https://coolaj86.com/articles/webcrypto-encrypt-and-decrypt-with-aes/
function separateSaltIvFromData(buf, saltLen, ivLen) {
  var sl = new Uint8Array(saltLen);
  var iv = new Uint8Array(ivLen);
  var data = new Uint8Array(buf.length - ivLen * 2);

  Array.prototype.forEach.call(buf, function(byte, i) {

    if (i < ivLen) {
      sl[i] = byte;
    } else if (i < ivLen * 2 && i >= ivLen) {
      iv[i - ivLen] = byte;
    } else {
      data[i - ivLen * 2] = byte;
    }
  });

  return {
    salt: sl,
    iv: iv,
    data: data
  };
};

function encryptUint8Array(data, password, saltLen, ivLen) {
  var salty = crypto.getRandomValues(new Uint8Array(saltLen));
  var encoder = new TextEncoder("utf-8");

  return new Promise(function(resolve, reject) {
    crypto.subtle.importKey(
      "raw",
      encoder.encode(password), {
        "name": "PBKDF2"
      },
      false, ["deriveKey"]
    ).then(function(baseKey) {

      crypto.subtle.deriveKey({
          "name": "PBKDF2",
          salt: salty,
          iterations: 1000,
          hash: {
            name: "SHA-512"
          } //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
        },
        baseKey, {
          name: "AES-GCM", //can be any AES algorithm ("AES-CTR", "AES-CBC", "AES-CMAC", "AES-GCM", "AES-CFB", "AES-KW", "ECDH", "DH", or "HMAC")
          length: 256 //can be  128, 192, or 256
        },
        false, ["encrypt"]
      ).then(function(key) {
        var initializationVector = crypto.getRandomValues(new Uint8Array(ivLen));

        crypto.subtle.encrypt({
              name: "AES-GCM",
              iv: initializationVector
            },
            key,
            data
          ).then(function(encrypted) {
            resolve(joinSaltIvAndData(salty, initializationVector, new Uint8Array(encrypted)));
          })
          .catch(function(err) {
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


function decrypt(buf, password, saltLen, ivLen) {

  return new Promise(function(resolve, reject) {
    var parts = separateSaltIvFromData(buf, saltLen, ivLen);
    var encoder = new TextEncoder("utf-8");

    crypto.subtle.importKey(
      "raw",
      encoder.encode(password), {
        "name": "PBKDF2"
      },
      false, ["deriveKey"]
    ).then(function(baseKey) {

      crypto.subtle.deriveKey({
          "name": "PBKDF2",
          salt: parts.salt,
          iterations: 1000,
          hash: {
            name: "SHA-512"
          } //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
        },
        baseKey, {
          name: "AES-GCM", //can be any AES algorithm ("AES-CTR", "AES-CBC", "AES-CMAC", "AES-GCM", "AES-CFB", "AES-KW", "ECDH", "DH", or "HMAC")
          length: 256 //can be  128, 192, or 256
        },
        false, ["decrypt"]
      ).then(function(key) {
        crypto.subtle.decrypt({
            name: 'AES-GCM',
            iv: parts.iv
          },
          key,
          parts.data
        ).then(function(decrypted) {
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

function downloadDataURL(dataURL) {
  browser.downloads.download({
    'url': dataURL,
    'incognito': true,
    'conflictAction': 'uniquify',
    'filename': 'test.png'
  }).then(function(downloadId) {
    console.log(downloadId);
  }).catch(function(err) {
    console.log(err);
  });
}

function takeActionOnDataURL(data, settings) {
  let b64Data = data.split(',')[1];
  let rawImageData = window.atob(b64Data);
  var i = 0;
  var ab = new ArrayBuffer(rawImageData.length);
  var rawData = new Uint8Array(ab);

  for (; i < rawImageData.length; i++) {
    rawData[i] = rawImageData.charCodeAt(i);
  }
console.log(settings);
  if (settings.encrypt === "encrypt") {
    let password = document.querySelector('input#password').value;

    encryptUint8Array(rawData, password, 16, 16).then(function(encryptedData) {
      decrypt(encryptedData, password, 16, 16).then(function(decryptedData) {
        var blob = new Blob([decryptedData], {
          type: 'image/png'
        });
        downloadDataURL(window.URL.createObjectURL(blob));
      });
    });
  } else {
    var blob = new Blob([ab], {
      type: 'image/png'
    });
    downloadDataURL(window.URL.createObjectURL(blob));
  }
}

function reportError(error) {
  console.error(`Could not save page: ${error}`);
  //TODO: add user notifications
}

function listenForClicks() {
  var captureMethods = {
    "full": function(tabs, settings) {
      browser.tabs.sendMessage(
        tabs[0].id, {
          settings: settings
        }
      )
    },
    "visible": function(tabs, settings) {
      function onCaptured(imageUri) {
        takeActionOnDataURL(imageUri, settings);
      }

      browser.tabs.captureTab().then(onCaptured, reportError);
    },
    "pdf": function(tabs, settings) {//TODO: expose?
      browser.tabs.saveAsPDF({}).then(function(status) {
        //TODO: add user notification on status success?
      }).catch(reportError);
    }
  };

  browser.tabs.query({
    active: true,
    currentWindow: true
  }).then(function(tabs) {
    document.addEventListener("click", (e) => {

      if (e.target.id !== 'doitbutton') {
        e.preventDefault();
        return false;
      }

      let settings = {
        "area": document.querySelector('select#captureAreaSetting').value,
        "encrypt": document.querySelector('select#captureEncryptionSetting').value,
        "storage": document.querySelector('select#captureStorageSetting').value
      }

      browser.storage.local.set(settings)
        .catch(reportError)
        .then(function() {
          captureMethods[settings.area](tabs, settings);
        });
    });
    // set default selections from past selection or the inline defaults if this is the first run
    browser.storage.local.get(["area", "encrypt", "storage"]).then(
      function(settings) {
        let areaSetting = settings.area || "full";
        let encryptSetting = settings.encrypt || "none";
        let storageSetting = settings.storage || "database";
        let encryptSettingElement = document.querySelector('select#captureEncryptionSetting');

        document.querySelector('select#captureAreaSetting').value = areaSetting;
        encryptSettingElement.value = encryptSetting;
        document.querySelector('select#captureStorageSetting').value = storageSetting;
        let passwordInput = document.querySelector('div#passwordField');

        if (encryptSetting === 'encrypt') {
          passwordInput.classList.remove('hidden');
        }

        encryptSettingElement.addEventListener("change", (evt) => {

          if (evt.target.value === "encrypt") {
            passwordInput.classList.remove('hidden');
          } else {
            passwordInput.classList.add('hidden');
          }
        });

      }).catch(reportError);
  }).catch(reportError);
}

browser.tabs.executeScript({
    file: "/content_scripts/html-to-image.js"
  })
  .then(listenForClicks)
  .catch(reportError);

browser.runtime.onMessage.addListener(function(message) {
  takeActionOnDataURL(message.data, message.settings);
});
