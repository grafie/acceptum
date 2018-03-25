//https://github.com/ogt/slugify-url/
function slugify(url) {
	var sanitized = url.substr(0, url.indexOf('?') === -1 ? url.length : url.indexOf('?'));
  sanitized = sanitized.replace(/^[\w]+:\/\//, '');
	sanitized = sanitized.replace(/[\w\-_\.]+(:[^@]+)?@/, '');
	sanitized = sanitized.replace(/\//g, '!');
  sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '!');
	sanitized = sanitized.replace(new RegExp('[!]{2,}','g'),'!');
	sanitized = sanitized.replace(new RegExp('[!]$'),'');
	sanitized = sanitized.substr(0, 128);
	return sanitized;
}

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
        const initializationVector = crypto.getRandomValues(new Uint8Array(ivLen));
				const ad = "Saved by Acceptum";
				const adBuf = new ArrayBuffer(ad.length);
			  const bufView = new Uint8Array(adBuf);

			  for (var i=0, strLen=ad.length; i<strLen; i++) {
			    bufView[i] = ad.charCodeAt(i);
			  }

        crypto.subtle.encrypt({// https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
              name: "AES-GCM",
              iv: initializationVector,
							additionalData: adBuf,
							tagLength: 128
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

function notifyOfSuccess() {
  browser.notifications.create({
    type: "basic",
    iconUrl: 'icons/check.png',
    title: "Acceptum",
    message: "Screencapture successfully downloaded!"
  });
}

function downloadDataURL(dataURL, filename) {
  let d = new Date();
  let filenamePreamble = d.getFullYear() + "_" + d.getMonth() + "_" + d.getDate()+ "_";

  browser.downloads.download({
    'url': dataURL,
    'incognito': true,
    'conflictAction': 'uniquify',
    'filename': filenamePreamble + filename + '.png'
  })
    .then(notifyOfSuccess)
    .catch(reportError);
}

function storeBlobInDatabase(blob, url) {
  // TODO: implement?
}

function doStorage(blob, settings) {
  switch (settings.storage) {
    case "download":
      downloadDataURL(window.URL.createObjectURL(blob), settings.url);
      break;
    case "database":
      storeBlobInDatabase(blob, settings.url);
      break;
  }
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

  if (settings.encrypt === "encrypt") {
    let password = document.querySelector('input#password').value;
    document.querySelector('input#password').value = "";

    encryptUint8Array(rawData, password, 16, 16).then(function(encryptedData) {
        var blob = new Blob([encryptedData], {
          type: 'image/png'
        });
        doStorage(blob, settings);
    });
  } else {
    var blob = new Blob([ab], {
      type: 'image/png'
    });
    doStorage(blob, settings);
  }
}

function reportError(error) {

	if (typeof(error) === 'string') {
	  browser.notifications.create({
      type: "basic",
      title: "Error Occured",
      message: error
	  });
	} else {
		console.log(error);
	}
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
        "storage": document.querySelector('select#captureStorageSetting').value,
        "url": slugify(tabs[0].url)
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
        let storageSetting = settings.storage || "download";
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
